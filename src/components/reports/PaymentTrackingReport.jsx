import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

export default function PaymentTrackingReport({ invoices, payments, providers, programLocations, outsideIncome, dateRange, formatCurrency, exportToCSV }) {
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('all');

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

    const rows = [];

    // Get unique program groups
    const invoiceGroups = [...new Set(filteredInvoices.map(inv => inv.program_group).filter(Boolean))];
    const directGroups = [...new Set(filteredDirectIncome.map(inc => inc.facility_name).filter(Boolean))];
    const programGroups = [...new Set([...invoiceGroups, ...directGroups])].sort();

    programGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
      const groupDirectIncome = filteredDirectIncome.filter(inc => inc.facility_name === programGroup);

      // Hartford Hospital and St. Francis need Directorship/On-Call separation
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      const isDirectPayer = directPayers.includes(programGroup);

      if (isDirectPayer) {
        rows.push([`${programGroup} - TRACKING`, '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
        rows.push(['Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', '', 'Notes']);

        let groupTotal = { expected: 0, received: 0 };

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
           
           groupTotal.expected += expectedAmount;
           groupTotal.received += amountReceived;

           rows.push([
             item.external_invoice_number || '-',
             item.month,
             formatCurrency(expectedAmount),
             formatCurrency(amountReceived),
             paymentDate,
             paymentQuarter,
             voucherNumber,
             '', // Date Paid Provider (N/A)
             item.notes || ''
           ]);
        });

        rows.push(['TOTAL', '', '', formatCurrency(groupTotal.expected), formatCurrency(groupTotal.received), '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);

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
          rows.push([`${programGroup} - DIRECTORSHIP TRACKING`, '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
          rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes']);

          const directorshipRate = programGroup === 'Hartford Hospital' ? 3250 : 1750;
          
          const directorshipInvoices = groupInvoices.filter(inv => {
            // For Hartford Hospital, ONLY use invoice number
            if (programGroup === 'Hartford Hospital') {
              return inv.invoice_number && inv.invoice_number.includes('(Directorship)');
            }
            
            // For other programs (St. Francis), check invoice number first
            if (inv.invoice_number && inv.invoice_number.includes('(Directorship)')) {
              return true;
            }
            
            // Then check linked outside income for directorship
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

          let directorshipTotal = { expected: 0, received: 0 };

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
                  paymentNotes = (payment.notes && payment.notes.toLowerCase().includes('auto-generated')) ? '' : (payment.notes || '');
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;
            
            directorshipTotal.expected += expectedAmount;
            directorshipTotal.received += receivedAmount;

            const shouldHideNotes = invoice.auto_generated || (invoice.notes && invoice.notes.toLowerCase().includes('auto-generated'));
            rows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              formatCurrency(expectedAmount),
              formatCurrency(receivedAmount),
              paymentDate,
              paymentQuarter,
              voucherNumber,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              [shouldHideNotes ? '' : (invoice.notes || ''), paymentNotes].filter(Boolean).join('; ')
            ]);
          });

          rows.push(['TOTAL', '', '', formatCurrency(directorshipTotal.expected), formatCurrency(directorshipTotal.received), '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '', '', '']);
        }

        // ON-CALL SECTION
        if (onCallLocation) {
          rows.push([`${programGroup} - ON-CALL TRACKING`, '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
          rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes']);

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

          let onCallTotal = { expected: 0, received: 0 };

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
                  paymentNotes = (payment.notes && payment.notes.toLowerCase().includes('auto-generated')) ? '' : (payment.notes || '');
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;

            onCallTotal.expected += expectedAmount;
            onCallTotal.received += receivedAmount;

            const shouldHideNotes = invoice.auto_generated || (invoice.notes && invoice.notes.toLowerCase().includes('auto-generated'));
            rows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              formatCurrency(expectedAmount),
              formatCurrency(receivedAmount),
              paymentDate,
              paymentQuarter,
              voucherNumber,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              [shouldHideNotes ? '' : (invoice.notes || ''), paymentNotes].filter(Boolean).join('; ')
            ]);
          });

          rows.push(['TOTAL', '', '', formatCurrency(onCallTotal.expected), formatCurrency(onCallTotal.received), '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
        }

      } else {
        // Standard tracking for other locations
        rows.push([`${programGroup} - TRACKING`, '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
        rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Quarter', 'Voucher Number', 'Date Paid Provider', 'Notes']);

        sortByMonth(groupInvoices);

        let groupTotal = { expected: 0, received: 0 };

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

          groupTotal.expected += expectedAmount;
          groupTotal.received += receivedAmount;

          const shouldHideNotes = invoice.auto_generated || (invoice.notes && invoice.notes.toLowerCase().includes('auto-generated'));
          rows.push([
            providerName,
            invoice.invoice_number || '',
            invoice.month || '',
            formatCurrency(expectedAmount),
            formatCurrency(receivedAmount),
            paymentDate,
            paymentQuarter,
            voucherNumber,
            invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
            shouldHideNotes ? '' : (invoice.notes || '')
          ]);
        });

        rows.push(['TOTAL', '', '', formatCurrency(groupTotal.expected), formatCurrency(groupTotal.received), '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
      }
    });

    exportToCSV(rows, 'payment_tracking_report');
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
          <Button onClick={generateReport} className="gap-2">
            <Download className="w-4 h-4" />
            Export to CSV
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