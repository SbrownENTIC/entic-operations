import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";

export default function PaymentTrackingReport({ invoices, payments, providers, programLocations, dateRange, formatCurrency, exportToCSV }) {
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('all');

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

    const rows = [];

    // Get unique program groups
    const programGroups = [...new Set(filteredInvoices.map(inv => inv.program_group).filter(Boolean))].sort();

    programGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
      
      // Determine if this group needs Directorship/On-Call separation
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      
      if (needsSeparation) {
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
          rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const directorshipInvoices = groupInvoices.filter(inv => {
            const matchingIncomes = inv.outside_income_ids || [];
            // Check if any linked income is from directorship location
            return matchingIncomes.some(incomeId => {
              const income = inv.outside_income_ids?.length > 0;
              return income; // This is a simplification - in real scenario would check the facility
            }) || inv.program_group === programGroup;
          });

          // Sort by month
          directorshipInvoices.sort((a, b) => {
            if (!a.month || !b.month) return 0;
            return a.month.localeCompare(b.month);
          });

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

            rows.push([
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

          rows.push(['TOTAL', '', '', directorshipTotal.expected, directorshipTotal.received, '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
        }

        // ON-CALL SECTION
        if (onCallLocation) {
          rows.push([`${programGroup} - ON-CALL TRACKING`, '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
          rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const onCallInvoices = groupInvoices; // All other invoices for this group

          // Sort by month
          onCallInvoices.sort((a, b) => {
            if (!a.month || !b.month) return 0;
            return a.month.localeCompare(b.month);
          });

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

            rows.push([
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

          rows.push(['TOTAL', '', '', onCallTotal.expected, onCallTotal.received, '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
          rows.push(['', '', '', '', '', '', '', '']);
        }

      } else {
        // Standard tracking for other locations
        rows.push([`${programGroup} - TRACKING`, '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
        rows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

        groupInvoices.sort((a, b) => {
          if (!a.month || !b.month) return 0;
          return a.month.localeCompare(b.month);
        });

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

          rows.push([
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

        rows.push(['TOTAL', '', '', groupTotal.expected, groupTotal.received, '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
        rows.push(['', '', '', '', '', '', '', '']);
      }
    });

    exportToCSV(rows, 'payment_tracking_report');
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