
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, DollarSign, Clock, Users } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date')
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: incomes = [], isLoading: incomesLoading } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list()
  });

  const isLoading = paymentsLoading || invoicesLoading || providersLoading || incomesLoading;

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToCSV = (data, filename) => {
    const csvContent = data.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter data by date range if set
  const filterByDateRange = (items, dateField) => {
    if (!dateRange.start && !dateRange.end) return items;
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      
      if (start && itemDate < start) return false;
      if (end && itemDate > end) return false;
      return true;
    });
  };

  // REPORT 1: Payment Allocation Report
  const generateAllocationReport = () => {
    const filteredPayments = filterByDateRange(payments, 'payment_date');
    
    const rows = [
      ['Payment Allocation Report', '', '', '', '', '', '', '', ''],
      ['Payment Date', 'Payer', 'Payment Method', 'Reference Number', 'Total Payment', 'Invoice Number', 'Program Group', 'Provider', 'Allocated Amount', 'Allocation Notes']
    ];

    filteredPayments.forEach(payment => {
      if (payment.allocations && payment.allocations.length > 0) {
        payment.allocations.forEach(allocation => {
          const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
          const provider = providers.find(p => p.id === allocation.provider_id);
          
          rows.push([
            format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
            payment.payer || '',
            payment.payment_method || '',
            payment.reference_number || '',
            payment.total_amount || 0,
            invoice?.invoice_number || '',
            invoice?.program_group || '',
            provider?.full_name || '',
            allocation.amount || 0,
            allocation.notes || ''
          ]);
        });
      } else {
        rows.push([
          format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
          payment.payer || '',
          payment.payment_method || '',
          payment.reference_number || '',
          payment.total_amount || 0,
          'UNALLOCATED',
          '',
          '',
          0,
          ''
        ]);
      }
    });

    const totalPayments = filteredPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalAllocated = filteredPayments.reduce((sum, p) => {
      return sum + (p.allocations?.reduce((allocSum, a) => allocSum + (a.amount || 0), 0) || 0);
    }, 0);
    const totalUnallocated = filteredPayments.reduce((sum, p) => sum + (p.unallocated_amount || 0), 0);

    rows.push(['', '', '', '', '', '', '', '', '', '']);
    rows.push(['TOTALS', '', '', '', totalPayments, '', '', '', totalAllocated, '']);
    rows.push(['Unallocated Amount', '', '', '', totalUnallocated, '', '', '', '', '']);

    exportToCSV(rows, 'payment_allocation_report');
  };

  // REPORT 2: Invoice Aging Report
  const generateAgingReport = () => {
    const today = new Date();
    const outstandingInvoices = invoices.filter(inv => {
      const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return balance > 0;
    });

    const filteredInvoices = filterByDateRange(outstandingInvoices, 'invoice_date');

    const rows = [
      ['Invoice Aging Report', '', '', '', '', '', ''],
      ['Generated', format(today, 'yyyy-MM-dd'), '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Invoice Number', 'Program Group', 'Provider', 'Invoice Date', 'Days Outstanding', 'Total', 'Amount Received', 'Balance', 'Aging Category']
    ];

    const agingCategories = {
      current: [],
      '30days': [],
      '60days': [],
      '90days': [],
      '90plus': []
    };

    filteredInvoices.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      const daysOutstanding = differenceInDays(today, parseISO(inv.invoice_date));
      const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      
      let category = 'current';
      let categoryLabel = '0-30 days';
      
      if (daysOutstanding > 90) {
        category = '90plus';
        categoryLabel = '90+ days';
      } else if (daysOutstanding > 60) {
        category = '90days';
        categoryLabel = '61-90 days';
      } else if (daysOutstanding > 30) {
        category = '60days';
        categoryLabel = '31-60 days';
      }

      rows.push([
        inv.invoice_number || '',
        inv.program_group || '',
        provider?.full_name || '',
        format(parseISO(inv.invoice_date), 'yyyy-MM-dd'),
        daysOutstanding,
        inv.total || 0,
        inv.amount_received || 0,
        balance,
        categoryLabel
      ]);

      agingCategories[category].push({
        invoice: inv,
        provider,
        daysOutstanding,
        balance,
        categoryLabel
      });
    });

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['SUMMARY BY AGING CATEGORY', '', '', '', '', '', '', '', '']);
    rows.push(['Category', 'Count', 'Total Balance', '', '', '', '', '', '']);
    
    const summaryCategoryOrder = ['current', '60days', '90days', '90plus'];
    summaryCategoryOrder.forEach(key => {
      const items = agingCategories[key];
      const labels = {
        current: '0-30 days',
        '60days': '31-60 days',
        '90days': '61-90 days',
        '90plus': '90+ days'
      };
      const totalBalance = items.reduce((sum, item) => sum + item.balance, 0);
      if (items.length > 0) {
        rows.push([labels[key], items.length, totalBalance, '', '', '', '', '', '']);
      }
    });

    exportToCSV(rows, 'invoice_aging_report');
  };

  // REPORT 3: Outside Income Summary
  const generateIncomeReport = (groupBy = 'provider') => {
    const filteredIncomes = incomes.filter(inc => {
      if (!dateRange.start && !dateRange.end) return true;
      
      if (inc.work_dates && inc.work_dates.length > 0) {
        return inc.work_dates.some(date => {
          const workDate = new Date(date);
          const start = dateRange.start ? new Date(dateRange.start) : null;
          const end = dateRange.end ? new Date(dateRange.end) : null;
          
          if (start && workDate < start) return false;
          if (end && workDate > end) return false;
          return true;
        });
      }
      return true;
    });

    const rows = [
      ['Outside Income Summary Report', '', '', '', ''],
      [`Grouped By: ${groupBy === 'provider' ? 'Provider' : 'Program Location'}`, '', '', '', ''],
      ['', '', '', '', ''],
    ];

    if (groupBy === 'provider') {
      rows.push(['Provider', 'Total Days Worked', 'Total RVUs', 'Total Amount', 'Status Breakdown']);

      const providerSummary = {};
      
      filteredIncomes.forEach(inc => {
        const provider = providers.find(p => p.id === inc.provider_id);
        const providerName = provider?.full_name || 'Unknown';
        
        if (!providerSummary[providerName]) {
          providerSummary[providerName] = {
            daysWorked: 0,
            totalRVUs: 0,
            totalAmount: 0,
            pending: 0,
            invoiced: 0,
            paid: 0
          };
        }
        
        providerSummary[providerName].daysWorked += inc.days_worked || 0;
        providerSummary[providerName].totalRVUs += inc.total_rvus || 0;
        providerSummary[providerName].totalAmount += inc.total_amount || 0;
        
        if (inc.status === 'pending') providerSummary[providerName].pending++;
        if (inc.status === 'invoiced') providerSummary[providerName].invoiced++;
        if (inc.status === 'paid') providerSummary[providerName].paid++;
      });

      Object.entries(providerSummary).sort(([a], [b]) => a.localeCompare(b)).forEach(([providerName, data]) => {
        rows.push([
          providerName,
          data.daysWorked,
          data.totalRVUs > 0 ? data.totalRVUs : 'N/A',
          data.totalAmount,
          `Pending: ${data.pending}, Invoiced: ${data.invoiced}, Paid: ${data.paid}`
        ]);
      });

      const totals = Object.values(providerSummary).reduce((acc, data) => ({
        daysWorked: acc.daysWorked + data.daysWorked,
        totalRVUs: acc.totalRVUs + data.totalRVUs,
        totalAmount: acc.totalAmount + data.totalAmount
      }), { daysWorked: 0, totalRVUs: 0, totalAmount: 0 });

      rows.push(['', '', '', '', '']);
      rows.push(['TOTALS', totals.daysWorked, totals.totalRVUs, totals.totalAmount, '']);

    } else {
      rows.push(['Program Location', 'Total Days Worked', 'Total RVUs', 'Total Amount', 'Number of Providers']);

      const programSummary = {};
      
      filteredIncomes.forEach(inc => {
        const programName = inc.facility_name || 'Unknown';
        
        if (!programSummary[programName]) {
          programSummary[programName] = {
            daysWorked: 0,
            totalRVUs: 0,
            totalAmount: 0,
            providers: new Set()
          };
        }
        
        programSummary[programName].daysWorked += inc.days_worked || 0;
        programSummary[programName].totalRVUs += inc.total_rvus || 0;
        programSummary[programName].totalAmount += inc.total_amount || 0;
        programSummary[programName].providers.add(inc.provider_id);
      });

      Object.entries(programSummary).sort(([a], [b]) => a.localeCompare(b)).forEach(([programName, data]) => {
        rows.push([
          programName,
          data.daysWorked,
          data.totalRVUs > 0 ? data.totalRVUs : 'N/A',
          data.totalAmount,
          data.providers.size
        ]);
      });

      const totals = Object.values(programSummary).reduce((acc, data) => ({
        daysWorked: acc.daysWorked + data.daysWorked,
        totalRVUs: acc.totalRVUs + data.totalRVUs,
        totalAmount: acc.totalAmount + data.totalAmount
      }), { daysWorked: 0, totalRVUs: 0, totalAmount: 0 });

      rows.push(['', '', '', '', '']);
      rows.push(['TOTALS', totals.daysWorked, totals.totalRVUs, totals.totalAmount, '']);
    }

    exportToCSV(rows, `outside_income_by_${groupBy}_report`);
  };

  // REPORT 4: Invoice by Provider
  const generateInvoiceByProviderReport = () => {
    const filteredInvoices = filterByDateRange(invoices, 'invoice_date');

    const rows = [
      ['Invoice by Provider Report', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Provider', 'Invoice Number', 'Program Group', 'Month', 'Invoice Date', 'Total', 'Amount Received', 'Balance', 'Status']
    ];

    const invoicesByProvider = {};
    
    filteredInvoices.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      const providerName = provider?.full_name || 'Unknown';
      
      if (!invoicesByProvider[providerName]) {
        invoicesByProvider[providerName] = [];
      }
      
      invoicesByProvider[providerName].push(inv);
    });

    Object.keys(invoicesByProvider).sort().forEach(providerName => {
      const providerInvoices = invoicesByProvider[providerName];
      
      let providerTotal = 0;
      let providerReceived = 0;
      let providerBalance = 0;
      
      providerInvoices.forEach(inv => {
        const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
        
        providerTotal += inv.total || 0;
        providerReceived += inv.amount_received || 0;
        providerBalance += balance;
        
        rows.push([
          providerName,
          inv.invoice_number || '',
          inv.program_group || '',
          inv.month || '',
          format(parseISO(inv.invoice_date), 'yyyy-MM-dd'),
          inv.total || 0,
          inv.amount_received || 0,
          balance,
          inv.status || ''
        ]);
      });
      
      rows.push([
        `${providerName} SUBTOTAL`,
        '',
        '',
        '',
        '',
        providerTotal,
        providerReceived,
        providerBalance,
        ''
      ]);
      rows.push(['', '', '', '', '', '', '', '', '']);
    });

    const grandTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const grandReceived = filteredInvoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);
    const grandBalance = filteredInvoices.reduce((sum, inv => {
      const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + balance;
    }, 0);

    rows.push(['GRAND TOTAL', '', '', '', '', grandTotal, grandReceived, grandBalance, '']);

    exportToCSV(rows, 'invoice_by_provider_report');
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading reports...</div>
        </div>
      </div>
    );
  }

  // Calculate Invoice by Provider summary data
  const filteredInvoices = filterByDateRange(invoices, 'invoice_date');
  const invoicesByProvider = {};
  
  filteredInvoices.forEach(inv => {
    const provider = providers.find(p => p.id === inv.staff_member_id);
    const providerName = provider?.full_name || 'Unknown';
    
    if (!invoicesByProvider[providerName]) {
      invoicesByProvider[providerName] = {
        count: 0,
        total: 0
      };
    }
    
    invoicesByProvider[providerName].count++;
    invoicesByProvider[providerName].total += inv.total || 0;
  });

  const allProviders = Object.entries(invoicesByProvider)
    .sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-600 mt-1">Generate and export detailed reports</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Date Range Filter</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Filter all reports by date range (leave blank for all data)</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <Button
                onClick={() => setDateRange({ start: '', end: '' })}
                variant="outline"
              >
                Clear Dates
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="allocation" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="allocation" className="gap-2 py-3">
              <DollarSign className="w-4 h-4" />
              Payment Allocations
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-2 py-3">
              <Clock className="w-4 h-4" />
              Invoice Aging
            </TabsTrigger>
            <TabsTrigger value="income" className="gap-2 py-3">
              <FileText className="w-4 h-4" />
              Outside Income
            </TabsTrigger>
            <TabsTrigger value="provider" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              Invoice by Provider
            </TabsTrigger>
          </TabsList>

          <TabsContent value="allocation">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Allocation Report</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Detailed view of all payments and their allocations to invoices
                    </p>
                  </div>
                  <Button onClick={generateAllocationReport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Total Payments</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(filterByDateRange(payments, 'payment_date').reduce((sum, p) => sum + (p.total_amount || 0), 0))}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Total Allocated</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(filterByDateRange(payments, 'payment_date').reduce((sum, p) => {
                          return sum + (p.allocations?.reduce((allocSum, a) => allocSum + (a.amount || 0), 0) || 0);
                        }, 0))}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Total Unallocated</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {formatCurrency(filterByDateRange(payments, 'payment_date').reduce((sum, p) => sum + (p.unallocated_amount || 0), 0))}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    This report shows each payment received, how it's been allocated across invoices, 
                    and any unallocated amounts. Perfect for reconciliation and cash flow tracking.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aging">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoice Aging Report</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Outstanding invoices categorized by how long they've been unpaid
                    </p>
                  </div>
                  <Button onClick={generateAgingReport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: '0-30 days', color: 'blue', count: invoices.filter(inv => {
                        const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                        const days = differenceInDays(new Date(), parseISO(inv.invoice_date));
                        return balance > 0 && days <= 30;
                      }).length },
                      { label: '31-60 days', color: 'yellow', count: invoices.filter(inv => {
                        const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                        const days = differenceInDays(new Date(), parseISO(inv.invoice_date));
                        return balance > 0 && days > 30 && days <= 60;
                      }).length },
                      { label: '61-90 days', color: 'orange', count: invoices.filter(inv => {
                        const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                        const days = differenceInDays(new Date(), parseISO(inv.invoice_date));
                        return balance > 0 && days > 60 && days <= 90;
                      }).length },
                      { label: '90+ days', color: 'red', count: invoices.filter(inv => {
                        const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                        const days = differenceInDays(new Date(), parseISO(inv.invoice_date));
                        return balance > 0 && days > 90;
                      }).length }
                    ].map(({ label, color, count }) => (
                      <div key={label} className={`bg-${color}-50 p-4 rounded-lg`}>
                        <p className="text-sm text-slate-600">{label}</p>
                        <p className={`text-2xl font-bold text-${color}-700`}>{count}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">
                    This report categorizes outstanding invoices by age, helping you prioritize 
                    collections and identify problematic accounts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Outside Income Summary</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Revenue breakdown by provider or program location
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => generateIncomeReport('provider')} variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      By Provider
                    </Button>
                    <Button onClick={() => generateIncomeReport('program')} className="gap-2">
                      <Download className="w-4 h-4" />
                      By Program
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Total Income Records</p>
                      <p className="text-2xl font-bold text-purple-700">{incomes.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Total Amount</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency(incomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0))}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600">Active Providers</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {new Set(incomes.map(inc => inc.provider_id)).size}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    Export detailed summaries grouped by provider (to see individual earnings) or by 
                    program location (to see which programs generate the most revenue).
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provider">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoice by Provider Report</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      All invoices grouped and summarized by provider
                    </p>
                  </div>
                  <Button onClick={generateInvoiceByProviderReport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Total Invoice by Provider</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-3 md:grid-flow-col gap-3">
                      {allProviders.map(([providerName, data], index) => {
                        const lastName = providerName.split(' ').pop();
                        const displayName = `Dr. ${lastName}`;
                        
                        return (
                          <div key={providerName} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                {index + 1}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{displayName}</p>
                                <p className="text-xs text-slate-500">{data.count} invoice{data.count !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-blue-700">{formatCurrency(data.total)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    This report shows all invoices organized by provider, with subtotals for each provider 
                    and a grand total. Perfect for reviewing provider compensation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
