import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

export default function PaymentTrackingReport({ invoices, payments, providers, programLocations, outsideIncome, dateRange, formatCurrency, exportToCSV }) {
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const sortByMonth = (invoices) => {
    const monthOrder = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    return invoices.sort((a, b) => {
      if (!a.month || !b.month) return 0;
      const [aMonth, aYear] = a.month.split(' ');
      const [bMonth, bYear] = b.month.split(' ');

      const yearDiff = (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
      if (yearDiff !== 0) return yearDiff;

      return (monthOrder[bMonth] || 0) - (monthOrder[aMonth] || 0);
    });
  };

  const downloadBackendReport = async (sections) => {
    try {
      setIsGenerating(true);
      const exportDate = format(new Date(), 'MMMM dd, yyyy');
      
      const response = await base44.functions.invoke('generatePaymentTrackingReports', {
        sections,
        exportDate
      });

      if (response.data.error) throw new Error(response.data.error);

      // Decode base64 and download zip
      const byteCharacters = atob(response.data.zipContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/zip' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Outside_Income_Payment_Tracking_Reports_${format(new Date(), 'yyyy-MM-dd')}.zip`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate report:", error);
      const errorMessage = error.response?.data?.error || error.message || "Unknown error occurred";
      alert(`Failed to generate report: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateReport = () => {
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.invoice_date) return false;
      const invDate = parseISO(inv.invoice_date);
      const start = dateRange.start ? parseISO(dateRange.start) : null;
      const end = dateRange.end ? parseISO(dateRange.end) : null;

      if (start && invDate < start) return false;
      if (end && invDate > end) return false;
      
      if (selectedProgramGroup !== 'all' && inv.program_group !== selectedProgramGroup) {
        return false;
      }
      return true;
    });

    const directPayers = ['Quinnipiac University', 'Nations Hearing'];
    const filteredDirectIncome = outsideIncome.filter(inc => {
      if (!directPayers.includes(inc.facility_name)) return false;
      
      const dateStr = inc.work_dates?.[0] || inc.created_date; 
      if (!dateStr) return false;
      
      const incDate = parseISO(dateStr);
      const start = dateRange.start ? parseISO(dateRange.start) : null;
      const end = dateRange.end ? parseISO(dateRange.end) : null;

      if (start && incDate < start) return false;
      if (end && incDate > end) return false;
      
      if (selectedProgramGroup !== 'all' && inc.facility_name !== selectedProgramGroup) {
        return false;
      }
      return true;
    });

    const sections = [];

    // Helper to normalize program names (combines Manchester variations)
    const normalizeGroup = (name) => {
        if (!name) return '';
        const lower = name.toLowerCase();
        if (lower.includes('manchester') || lower.includes('echn')) return 'Manchester / ECHN';
        return name;
    };

    // Get unique normalized program groups
    const programGroups = new Set();
    filteredInvoices.forEach(inv => programGroups.add(normalizeGroup(inv.program_group)));
    filteredDirectIncome.forEach(inc => programGroups.add(normalizeGroup(inc.facility_name)));

    const sortedGroups = [...programGroups].filter(Boolean).sort((a, b) => {
      if (a === 'Nations Hearing') return 1;
      if (b === 'Nations Hearing') return -1;
      return a.localeCompare(b);
    });

    sortedGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => normalizeGroup(inv.program_group) === programGroup);
      const groupDirectIncome = filteredDirectIncome.filter(inc => normalizeGroup(inc.facility_name) === programGroup);

      // Hartford Hospital and St. Francis need Directorship/On-Call separation
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      const isDirectPayer = directPayers.includes(programGroup);

      if (isDirectPayer) {
        const isNationsHearing = programGroup === 'Nations Hearing';
        const headers = isNationsHearing
          ? ['Voucher Number', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Notes']
          : ['Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', '', 'Notes'];
          
        const section = {
          title: `${programGroup} - TRACKING`,
          headers: headers,
          rows: []
        };

        // Process Direct Income Items
        const processedItems = groupDirectIncome.map(item => {
           const dateStr = item.work_dates?.[0] || item.created_date;
           const dateObj = parseISO(dateStr);
           const monthStr = format(dateObj, 'MMMM yyyy');
           return { ...item, month: monthStr };
        });

        // Sort using existing helper
        sortByMonth(processedItems);

        processedItems.forEach(item => {
           // Find payment info
           let paymentDate = '';
           let voucherNumber = '';
           let paymentQuarter = '';
           let amountReceived = 0;

           payments.forEach(payment => {
             payment.allocations?.forEach(allocation => {
               if (allocation.outside_income_id === item.id) {
                 amountReceived += (allocation.amount || 0);
                 const pDate = parseISO(payment.payment_date);
                 paymentDate = format(pDate, 'MM/dd/yyyy');
                 const q = Math.floor(pDate.getMonth() / 3) + 1;
                 paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                 voucherNumber = payment.reference_number || '';
               }
             });
           });

           const expectedAmount = item.amount_due || item.total_amount || 0;

           const cleanNotes = (notes) => {
             if (!notes) return '';
             const lower = notes.toLowerCase();
             if (lower.includes('auto-generated') || lower.includes('auto-created')) return '';
             return notes;
           };

           if (isNationsHearing) {
             section.rows.push([
               voucherNumber,
               item.external_invoice_number || '-',
               item.month,
               expectedAmount, // Pass number
               amountReceived, // Pass number
               paymentDate,
               paymentQuarter,
               cleanNotes(item.notes)
             ]);
           } else {
             section.rows.push([
               item.external_invoice_number || '-',
               item.month,
               expectedAmount, // Pass number
               amountReceived, // Pass number
               paymentDate,
               paymentQuarter,
               voucherNumber,
               '', // Date Paid Provider (N/A)
               cleanNotes(item.notes)
             ]);
           }
        });
        
        sections.push(section);

      } else if (needsSeparation) {
        // Separate by program type
        const directorshipLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'Directorship'
        );
        const onCallLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'On-Call'
        );

        // DIRECTORSHIP SECTION
        if (directorshipLocation) {
          const section = {
            title: `${programGroup} - DIRECTORSHIP TRACKING`,
            headers: ['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes'],
            rows: []
          };

          const directorshipInvoices = groupInvoices.filter(inv => {
            // Check invoice number first (legacy naming)
            if (inv.invoice_number && inv.invoice_number.includes('(Directorship)')) {
              return true;
            }
            
            // Check linked outside income for directorship
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            return linkedIncomes.some(income => {
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              if (income.program_location_id) {
                const incomeLocation = programLocations.find(pl => pl.id === income.program_location_id);
                if (incomeLocation?.program_type === 'Directorship') {
                  return true;
                }
              }
              return false;
            });
          });

          // Sort by month
          sortByMonth(directorshipInvoices);

          directorshipInvoices.forEach(invoice => {
            const provider = providers.find(p => p.id === invoice.staff_member_id);
            const providerName = provider?.full_name || 'Unknown';

            // Find payment info
            let paymentDate = '';
            let voucherNumber = '';
            let paymentQuarter = '';
            let paymentNotes = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const pDate = parseISO(payment.payment_date);
                  paymentDate = format(pDate, 'MM/dd/yyyy');
                  const q = Math.floor(pDate.getMonth() / 3) + 1;
                  paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                  voucherNumber = payment.reference_number || '';
                  paymentNotes = (payment.notes && (payment.notes.toLowerCase().includes('auto-generated') || payment.notes.toLowerCase().includes('auto-created'))) ? '' : (payment.notes || '');
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;
            
            const shouldHideNotes = invoice.auto_generated || (invoice.notes && (invoice.notes.toLowerCase().includes('auto-generated') || invoice.notes.toLowerCase().includes('auto-created')));
            section.rows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount, // Number
              receivedAmount, // Number
              paymentDate,
              paymentQuarter,
              voucherNumber,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              [shouldHideNotes ? '' : (invoice.notes || ''), paymentNotes].filter(Boolean).join('; ')
            ]);
          });
          sections.push(section);
        }

        // ON-CALL SECTION
        if (onCallLocation) {
          const section = {
            title: `${programGroup} - ON-CALL TRACKING`,
            headers: ['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes'],
            rows: []
          };

          const onCallInvoices = groupInvoices.filter(inv => {
            // For Hartford Hospital, ONLY use invoice number
            if (programGroup === 'Hartford Hospital') {
              return !inv.invoice_number || !inv.invoice_number.includes('(Directorship)');
            }
            
            // For other programs (St. Francis), check invoice number first
            if (inv.invoice_number && inv.invoice_number.includes('(Directorship)')) {
              return false;
            }
            
            // Then check linked outside income to exclude directorship
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            const hasDirectorshipIncome = linkedIncomes.some(income => {
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              if (income.program_location_id) {
                const incomeLocation = programLocations.find(pl => pl.id === income.program_location_id);
                if (incomeLocation?.program_type === 'Directorship') {
                  return true;
                }
              }
              return false;
            });
            
            return !hasDirectorshipIncome;
          });

          // Sort by month
          sortByMonth(onCallInvoices);

          onCallInvoices.forEach(invoice => {
            const provider = providers.find(p => p.id === invoice.staff_member_id);
            const providerName = provider?.full_name || 'Unknown';

            // Find payment info
            let paymentDate = '';
            let voucherNumber = '';
            let paymentQuarter = '';
            let paymentNotes = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const pDate = parseISO(payment.payment_date);
                  paymentDate = format(pDate, 'MM/dd/yyyy');
                  const q = Math.floor(pDate.getMonth() / 3) + 1;
                  paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                  voucherNumber = payment.reference_number || '';
                  paymentNotes = (payment.notes && (payment.notes.toLowerCase().includes('auto-generated') || payment.notes.toLowerCase().includes('auto-created'))) ? '' : (payment.notes || '');
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;

            const shouldHideNotes = invoice.auto_generated || (invoice.notes && (invoice.notes.toLowerCase().includes('auto-generated') || invoice.notes.toLowerCase().includes('auto-created')));
            section.rows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount, // Number
              receivedAmount, // Number
              paymentDate,
              paymentQuarter,
              voucherNumber,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              [shouldHideNotes ? '' : (invoice.notes || ''), paymentNotes].filter(Boolean).join('; ')
            ]);
          });
          sections.push(section);
        }

      } else {
        // Standard tracking for other locations
        const section = {
          title: `${programGroup} - TRACKING`,
          headers: ['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes'],
          rows: []
        };

        sortByMonth(groupInvoices);

        groupInvoices.forEach(invoice => {
          const provider = providers.find(p => p.id === invoice.staff_member_id);
          const providerName = provider?.full_name || 'Unknown';

          // Find payment info
          let paymentDate = '';
          let voucherNumber = '';
          let paymentQuarter = '';
          payments.forEach(payment => {
            payment.allocations?.forEach(allocation => {
              if (allocation.invoice_id === invoice.id) {
                const pDate = parseISO(payment.payment_date);
                paymentDate = format(pDate, 'MM/dd/yyyy');
                const q = Math.floor(pDate.getMonth() / 3) + 1;
                paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                voucherNumber = payment.reference_number || '';
              }
            });
          });

          const expectedAmount = invoice.amount_expected || invoice.total || 0;
          const receivedAmount = invoice.amount_received || 0;

          const shouldHideNotes = invoice.auto_generated || (invoice.notes && (invoice.notes.toLowerCase().includes('auto-generated') || invoice.notes.toLowerCase().includes('auto-created')));
          section.rows.push([
            providerName,
            invoice.invoice_number || '',
            invoice.month || '',
            expectedAmount, // Number
            receivedAmount, // Number
            paymentDate,
            paymentQuarter,
            voucherNumber,
            invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
            shouldHideNotes ? '' : (invoice.notes || '')
          ]);
        });
        sections.push(section);
      }
    });

    if (sections.length === 0) {
       alert("No data found for the selected filters. Please adjust your filters and try again.");
       return;
    }
    downloadBackendReport(sections);
    };

  const directPayerOptions = ['Quinnipiac University', 'Nations Hearing'];
  const relevantDirectIncome = outsideIncome.filter(inc => directPayerOptions.includes(inc.facility_name));
  const directGroups = relevantDirectIncome.map(inc => inc.facility_name);
  
  const programGroupOptions = ['all', ...new Set([
    ...invoices.map(inv => inv.program_group).filter(Boolean),
    ...directGroups
  ])].sort();

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Tracking Report</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Track invoices by location with Directorship/On-Call breakdown for Hartford Hospital and St. Francis
            </p>
          </div>
          <Button onClick={generateReport} className="gap-2" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Export Reports (ZIP)'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Building2 className="w-5 h-5 text-slate-500" />
            <Select value={selectedProgramGroup} onValueChange={setSelectedProgramGroup}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {programGroupOptions.filter(g => g !== 'all').map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
      </CardContent>
    </Card>
  );
}