import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

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
      
      const yearDiff = (parseInt(aYear) || 0) - (parseInt(bYear) || 0);
      if (yearDiff !== 0) return yearDiff;
      
      return (monthOrder[aMonth] || 0) - (monthOrder[bMonth] || 0);
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

    const workbook = XLSX.utils.book_new();

    // Get unique program groups
    const programGroups = [...new Set(filteredInvoices.map(inv => inv.program_group).filter(Boolean))].sort();

    programGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
      
      // Determine if this group needs Directorship/On-Call separation
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      
      if (needsSeparation) {
        const rows = [];
        // Separate by program type
        const directorshipLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'Directorship'
        );
        const onCallLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'On-Call'
        );

        // DIRECTORSHIP SECTION
        if (directorshipLocation) {
          const directorshipRows = [];
          directorshipRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const directorshipRate = programGroup === 'Hartford Hospital' ? 3250 : 1750;
          
          const directorshipInvoices = groupInvoices.filter(inv => {
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            // Check if any linked income is from directorship
            const hasDirectorshipIncome = linkedIncomes.some(income => {
              // Check facility_name for "Directorship" keyword
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              
              // Check program_location_id for Directorship type
              if (income.program_location_id) {
                const incomeLocation = programLocations.find(pl => pl.id === income.program_location_id);
                if (incomeLocation?.program_type === 'Directorship') {
                  return true;
                }
              }
              
              return false;
            });
            
            // If has directorship income, it's directorship
            if (hasDirectorshipIncome) return true;
            
            // If no linked income or amount matches directorship rate, classify as directorship
            if (linkedIncomes.length === 0) {
              const amount = inv.amount_expected || inv.total || 0;
              return Math.abs(amount - directorshipRate) < 1;
            }
            
            return false;
          });

          // Sort by month
          sortByMonth(directorshipInvoices);

          let directorshipTotal = { expected: 0, received: 0 };

          directorshipInvoices.forEach(invoice => {
            const provider = providers.find(p => p.id === invoice.staff_member_id);
            const providerName = provider?.full_name || 'Unknown';

            // Find payment info
            let paymentInfo = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const payDate = format(parseISO(payment.payment_date), 'MM/dd/yyyy');
                  const voucher = payment.reference_number || '';
                  paymentInfo = `${payDate} / ${voucher}`;
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;
            
            directorshipTotal.expected += expectedAmount;
            directorshipTotal.received += receivedAmount;

            directorshipRows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount,
              receivedAmount,
              paymentInfo,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              invoice.notes || ''
            ]);
          });

          directorshipRows.push(['TOTAL', '', '', directorshipTotal.expected, directorshipTotal.received, '', '', '']);
          
          // Create worksheet for directorship
          const directorshipSheet = XLSX.utils.aoa_to_sheet(directorshipRows);
          
          // Set column widths
          directorshipSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          // Format currency columns
          const range = XLSX.utils.decode_range(directorshipSheet['!ref']);
          for (let R = 1; R <= range.e.r; R++) {
            ['D', 'E'].forEach(col => {
              const cellRef = col + (R + 1);
              if (directorshipSheet[cellRef] && typeof directorshipSheet[cellRef].v === 'number') {
                directorshipSheet[cellRef].z = '$#,##0.00';
              }
            });
          }
          
          const sheetName = programGroup === 'Hartford Hospital' ? 'HH Directorship' : 'SF Directorship';
          XLSX.utils.book_append_sheet(workbook, directorshipSheet, sheetName);
        }

        // ON-CALL SECTION
        if (onCallLocation) {
          const onCallRows = [];
          onCallRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const onCallInvoices = groupInvoices.filter(inv => {
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            // Exclude invoices that have directorship income
            const hasDirectorshipIncome = linkedIncomes.some(income => {
              // Check facility_name for "Directorship" keyword
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              
              // Check program_location_id for Directorship type
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
            let paymentInfo = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const payDate = format(parseISO(payment.payment_date), 'MM/dd/yyyy');
                  const voucher = payment.reference_number || '';
                  paymentInfo = `${payDate} / ${voucher}`;
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;

            onCallTotal.expected += expectedAmount;
            onCallTotal.received += receivedAmount;

            onCallRows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount,
              receivedAmount,
              paymentInfo,
              invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
              invoice.notes || ''
            ]);
          });

          onCallRows.push(['TOTAL', '', '', onCallTotal.expected, onCallTotal.received, '', '', '']);
          
          // Create worksheet for on-call
          const onCallSheet = XLSX.utils.aoa_to_sheet(onCallRows);
          
          // Set column widths
          onCallSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          // Format currency columns
          const range = XLSX.utils.decode_range(onCallSheet['!ref']);
          for (let R = 1; R <= range.e.r; R++) {
            ['D', 'E'].forEach(col => {
              const cellRef = col + (R + 1);
              if (onCallSheet[cellRef] && typeof onCallSheet[cellRef].v === 'number') {
                onCallSheet[cellRef].z = '$#,##0.00';
              }
            });
          }
          
          const sheetName = programGroup === 'Hartford Hospital' ? 'HH On-Call' : 'SF On-Call';
          XLSX.utils.book_append_sheet(workbook, onCallSheet, sheetName);
        }

      } else {
        // Standard tracking for other locations
        const standardRows = [];
        standardRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

        sortByMonth(groupInvoices);

        let groupTotal = { expected: 0, received: 0 };

        groupInvoices.forEach(invoice => {
          const provider = providers.find(p => p.id === invoice.staff_member_id);
          const providerName = provider?.full_name || 'Unknown';

          // Find payment info
          let paymentInfo = '';
          payments.forEach(payment => {
            payment.allocations?.forEach(allocation => {
              if (allocation.invoice_id === invoice.id) {
                const payDate = format(parseISO(payment.payment_date), 'MM/dd/yyyy');
                const voucher = payment.reference_number || '';
                paymentInfo = `${payDate} / ${voucher}`;
              }
            });
          });

          const expectedAmount = invoice.amount_expected || invoice.total || 0;
          const receivedAmount = invoice.amount_received || 0;

          groupTotal.expected += expectedAmount;
          groupTotal.received += receivedAmount;

          standardRows.push([
            providerName,
            invoice.invoice_number || '',
            invoice.month || '',
            expectedAmount,
            receivedAmount,
            paymentInfo,
            invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
            invoice.notes || ''
          ]);
        });

        standardRows.push(['TOTAL', '', '', groupTotal.expected, groupTotal.received, '', '', '']);
        
        // Create worksheet
        const standardSheet = XLSX.utils.aoa_to_sheet(standardRows);
        
        // Set column widths
        standardSheet['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
          { wch: 25 }, { wch: 18 }, { wch: 30 }
        ];
        
        // Format currency columns
        const range = XLSX.utils.decode_range(standardSheet['!ref']);
        for (let R = 1; R <= range.e.r; R++) {
          ['D', 'E'].forEach(col => {
            const cellRef = col + (R + 1);
            if (standardSheet[cellRef] && typeof standardSheet[cellRef].v === 'number') {
              standardSheet[cellRef].z = '$#,##0.00';
            }
          });
        }
        
        // Truncate sheet name if too long (Excel limit is 31 characters)
        let sheetName = programGroup;
        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }
        XLSX.utils.book_append_sheet(workbook, standardSheet, sheetName);
      }
    });

    // Export workbook
    XLSX.writeFile(workbook, `payment_tracking_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const programGroupOptions = ['all', ...new Set(invoices.map(inv => inv.program_group).filter(Boolean))].sort();

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
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-slate-900 mb-2">Report Structure:</p>
            <ul className="text-sm text-slate-700 space-y-1 ml-4 list-disc">
              <li>Hartford Hospital: Separate Directorship ($3,250/month) and On-Call tracking</li>
              <li>St. Francis: Separate Directorship ($1,750/month) and On-Call tracking</li>
              <li>Other locations: Combined tracking</li>
              <li>Export opens in Excel with clear sections and totals</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}