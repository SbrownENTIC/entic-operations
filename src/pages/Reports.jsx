import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, DollarSign, Clock, Users, Package, X } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PaymentTrackingReport from "../components/reports/PaymentTrackingReport";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [supplyOrderDetail, setSupplyOrderDetail] = useState(null);

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

  const { data: supplyOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['supply-orders'],
    queryFn: () => base44.entities.SupplyOrder.list('-order_date')
  });

  const { data: programLocations = [], isLoading: programLocationsLoading } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list()
  });

  const isLoading = paymentsLoading || invoicesLoading || providersLoading || incomesLoading || ordersLoading || programLocationsLoading;

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
    const grandBalance = filteredInvoices.reduce((sum, inv) => {
      const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + balance;
    }, 0);

    rows.push(['GRAND TOTAL', '', '', '', '', grandTotal, grandReceived, grandBalance, '']);

    exportToCSV(rows, 'invoice_by_provider_report');
  };

  // REPORT 5: Supply Orders Report
  const generateSupplyOrderReport = () => {
    const filteredOrders = filterByDateRange(supplyOrders, 'order_date');

    const rows = [
      ['Supply Orders Report', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['AVERAGE BY LOCATION', '', '', '', '', '', '', '', ''],
      ['Location', 'Number of Orders', 'Total Spent', 'Average Order Value', '', '', '', '', '']
    ];

    // Calculate by location
    const byLocation = {};
    filteredOrders.forEach(order => {
      const location = order.location || 'Unknown';
      if (!byLocation[location]) {
        byLocation[location] = { count: 0, total: 0 };
      }
      byLocation[location].count++;
      byLocation[location].total += order.total_amount || 0;
    });

    Object.entries(byLocation).sort(([a], [b]) => a.localeCompare(b)).forEach(([location, data]) => {
      rows.push([
        location,
        data.count,
        data.total,
        data.count > 0 ? data.total / data.count : 0,
        '', '', '', '', ''
      ]);
    });

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['AVERAGE BY MONTH', '', '', '', '', '', '', '', '']);
    rows.push(['Month', 'Number of Orders', 'Total Spent', 'Average Order Value', '', '', '', '', '']);

    // Calculate by month
    const byMonth = {};
    filteredOrders.forEach(order => {
      const month = format(parseISO(order.order_date), 'yyyy-MM');
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, total: 0 };
      }
      byMonth[month].count++;
      byMonth[month].total += order.total_amount || 0;
    });

    Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).forEach(([month, data]) => {
      rows.push([
        format(parseISO(month + '-01'), 'MMMM yyyy'),
        data.count,
        data.total,
        data.count > 0 ? data.total / data.count : 0,
        '', '', '', '', ''
      ]);
    });

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['AVERAGE BY YEAR', '', '', '', '', '', '', '', '']);
    rows.push(['Year', 'Number of Orders', 'Total Spent', 'Average Order Value', '', '', '', '', '']);

    // Calculate by year
    const byYear = {};
    filteredOrders.forEach(order => {
      const year = format(parseISO(order.order_date), 'yyyy');
      if (!byYear[year]) {
        byYear[year] = { count: 0, total: 0 };
      }
      byYear[year].count++;
      byYear[year].total += order.total_amount || 0;
    });

    Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a)).forEach(([year, data]) => {
      rows.push([
        year,
        data.count,
        data.total,
        data.count > 0 ? data.total / data.count : 0,
        '', '', '', '', ''
      ]);
    });

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['GRAND TOTAL', '', '', '', '', '', '', '', '']);
    const grandTotal = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const grandAverage = filteredOrders.length > 0 ? grandTotal / filteredOrders.length : 0;
    rows.push(['All Orders', filteredOrders.length, grandTotal, grandAverage, '', '', '', '', '']);

    exportToCSV(rows, 'supply_orders_report');
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
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-slate-700">Date Range:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-40"
                  placeholder="Start"
                />
                <span className="text-slate-500">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-40"
                  placeholder="End"
                />
              </div>
              <Button
                onClick={() => setDateRange({ start: '', end: '' })}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
              <span className="text-xs text-slate-500 ml-2">Leave blank for all data</span>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="payment-tracking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto">
            <TabsTrigger value="payment-tracking" className="gap-2 py-3">
              <FileText className="w-4 h-4" />
              Payment Tracking
            </TabsTrigger>
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
            <TabsTrigger value="supplies" className="gap-2 py-3">
              <Package className="w-4 h-4" />
              Supply Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payment-tracking">
            <PaymentTrackingReport
              invoices={invoices}
              payments={payments}
              providers={providers}
              programLocations={programLocations}
              outsideIncome={incomes}
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              exportToCSV={exportToCSV}
            />
          </TabsContent>

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

          <TabsContent value="supplies">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Supply Orders Report</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Supply spending analysis by location, month, and year
                    </p>
                  </div>
                  <Button onClick={generateSupplyOrderReport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    {(() => {
                      const filtered = filterByDateRange(supplyOrders, 'order_date');
                      return (
                        <>
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">Order Status Summary ({filtered.length})</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {(() => {
                        const orderPlaced = filtered.filter(o => o.status === 'order_placed');
                        const partiallyReceived = filtered.filter(o => o.status === 'partially_received');
                        const received = filtered.filter(o => o.status === 'received');
                        
                        return (
                          <>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Order Placed', 
                                data: { 
                                  count: orderPlaced.length, 
                                  total: orderPlaced.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: orderPlaced 
                                }
                              })}
                              className="bg-blue-50 p-3 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Order Placed</p>
                              <p className="text-xl font-bold text-blue-700 mt-1">{orderPlaced.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(orderPlaced.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Partially Received', 
                                data: { 
                                  count: partiallyReceived.length, 
                                  total: partiallyReceived.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: partiallyReceived 
                                }
                              })}
                              className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Partially Received</p>
                              <p className="text-xl font-bold text-yellow-700 mt-1">{partiallyReceived.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(partiallyReceived.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Received', 
                                data: { 
                                  count: received.length, 
                                  total: received.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: received 
                                }
                              })}
                              className="bg-green-50 p-3 rounded-lg border border-green-200 hover:bg-green-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Received</p>
                              <p className="text-xl font-bold text-green-700 mt-1">{received.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(received.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                            </>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}
              </div>

                  <div>
                    <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(() => {
                        const byLocation = {};
                        const filtered = filterByDateRange(supplyOrders, 'order_date');
                        filtered.forEach(order => {
                          const location = order.location || 'Unknown';
                          if (!byLocation[location]) {
                            byLocation[location] = { count: 0, total: 0, orders: [] };
                          }
                          byLocation[location].count++;
                          byLocation[location].total += order.total_amount || 0;
                          byLocation[location].orders.push(order);
                        });

                        return Object.entries(byLocation).sort(([a], [b]) => a.localeCompare(b)).map(([location, data]) => (
                          <button
                            key={location}
                            onClick={() => setSupplyOrderDetail({ type: 'location', name: location, data })}
                            className="bg-blue-50 p-4 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors text-left"
                          >
                            <p className="text-sm font-medium text-slate-700">{location}</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">
                              {formatCurrency(data.count > 0 ? data.total / data.count : 0)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{data.count} orders • {formatCurrency(data.total)} total</p>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Month & Location (Last 12 Months)</h3>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Month</th>
                            {(() => {
                              const locations = [...new Set(supplyOrders.map(o => o.location || 'Unknown'))].sort();
                              return locations.map(loc => (
                                <th key={loc} className="text-right p-3 font-semibold text-slate-700">{loc}</th>
                              ));
                            })()}
                            <th className="text-right p-3 font-semibold text-slate-700 bg-slate-200">Month Order Average</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const byMonthLocation = {};
                            const filtered = filterByDateRange(supplyOrders, 'order_date');
                            filtered.forEach(order => {
                              const month = format(parseISO(order.order_date), 'yyyy-MM');
                              const location = order.location || 'Unknown';
                              if (!byMonthLocation[month]) byMonthLocation[month] = {};
                              if (!byMonthLocation[month][location]) {
                                byMonthLocation[month][location] = { count: 0, total: 0, orders: [] };
                              }
                              byMonthLocation[month][location].count++;
                              byMonthLocation[month][location].total += order.total_amount || 0;
                              byMonthLocation[month][location].orders.push(order);
                            });

                            const locations = [...new Set(supplyOrders.map(o => o.location || 'Unknown'))].sort();
                            
                            const monthRows = Object.entries(byMonthLocation)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .slice(0, 12)
                              .map(([month, locationData]) => {
                                const monthTotal = Object.values(locationData).reduce((sum, d) => sum + d.total, 0);
                                const monthCount = Object.values(locationData).reduce((sum, d) => sum + d.count, 0);
                                const monthAvg = monthCount > 0 ? monthTotal / monthCount : 0;

                                return (
                                  <tr key={month} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-900">{format(parseISO(month + '-01'), 'MMM yyyy')}</td>
                                    {locations.map(loc => {
                                      const data = locationData[loc];
                                      return (
                                        <td key={loc} className="p-3 text-right">
                                          {data ? (
                                            <button
                                              onClick={() => setSupplyOrderDetail({ type: 'month-location', name: `${format(parseISO(month + '-01'), 'MMM yyyy')} - ${loc}`, data })}
                                              className="text-green-700 font-medium hover:text-green-900 hover:underline"
                                            >
                                              {formatCurrency(data.total / data.count)}
                                            </button>
                                          ) : (
                                            <span className="text-slate-400">{formatCurrency(0)}</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="p-3 text-right font-bold bg-slate-50 text-slate-900">
                                      {formatCurrency(monthAvg)}
                                    </td>
                                  </tr>
                                );
                              });

                            return monthRows;
                            })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Year & Location</h3>
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Year</th>
                            {(() => {
                              const locations = [...new Set(supplyOrders.map(o => o.location || 'Unknown'))].sort();
                              return locations.map(loc => (
                                <th key={loc} className="text-right p-3 font-semibold text-slate-700">{loc}</th>
                              ));
                            })()}
                            <th className="text-right p-3 font-semibold text-slate-700 bg-slate-200">Yearly Order Average</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const byYearLocation = {};
                            const filtered = filterByDateRange(supplyOrders, 'order_date');
                            filtered.forEach(order => {
                              const year = format(parseISO(order.order_date), 'yyyy');
                              const location = order.location || 'Unknown';
                              if (!byYearLocation[year]) byYearLocation[year] = {};
                              if (!byYearLocation[year][location]) {
                                byYearLocation[year][location] = { count: 0, total: 0, orders: [] };
                              }
                              byYearLocation[year][location].count++;
                              byYearLocation[year][location].total += order.total_amount || 0;
                              byYearLocation[year][location].orders.push(order);
                            });

                            const locations = [...new Set(supplyOrders.map(o => o.location || 'Unknown'))].sort();
                            
                            return Object.entries(byYearLocation)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .map(([year, locationData]) => {
                                const yearTotal = Object.values(locationData).reduce((sum, d) => sum + d.total, 0);
                                const yearCount = Object.values(locationData).reduce((sum, d) => sum + d.count, 0);
                                const yearAvg = yearCount > 0 ? yearTotal / yearCount : 0;

                                return (
                                  <tr key={year} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-900">{year}</td>
                                    {locations.map(loc => {
                                      const data = locationData[loc];
                                      return (
                                        <td key={loc} className="p-3 text-right">
                                          {data ? (
                                            <button
                                              onClick={() => setSupplyOrderDetail({ type: 'year-location', name: `${year} - ${loc}`, data })}
                                              className="text-purple-700 font-medium hover:text-purple-900 hover:underline"
                                            >
                                              {formatCurrency(data.total / data.count)}
                                            </button>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="p-3 text-right font-bold bg-slate-50 text-slate-900">
                                      {formatCurrency(yearAvg)}
                                    </td>
                                  </tr>
                                );
                              });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600">
                    Click on any value to see detailed order breakdown. Average values help identify spending trends and budget planning.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {supplyOrderDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSupplyOrderDetail(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{supplyOrderDetail.name} - Order Details</h3>
                <button onClick={() => setSupplyOrderDetail(null)} className="text-slate-500 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">Total Orders</p>
                    <p className="text-2xl font-bold text-blue-700">{supplyOrderDetail.data.count}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">Total Spent</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(supplyOrderDetail.data.total)}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">Average Order</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(supplyOrderDetail.data.count > 0 ? supplyOrderDetail.data.total / supplyOrderDetail.data.count : 0)}
                    </p>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-3 font-semibold text-slate-700">Order #</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                        <th className="text-right p-3 font-semibold text-slate-700">Items</th>
                        <th className="text-right p-3 font-semibold text-slate-700">Total</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                     {supplyOrderDetail.data.orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date)).map(order => (
                       <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                         <td className="p-3">
                           <Link 
                             to={createPageUrl('SupplyOrderDetail') + '?id=' + order.id}
                             className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                           >
                             {order.order_number || '-'}
                           </Link>
                         </td>
                         <td className="p-3 text-slate-600">{format(parseISO(order.order_date), 'MMM d, yyyy')}</td>
                         <td className="p-3 text-slate-600">{order.location}</td>
                         <td className="p-3 text-right text-slate-600">{order.items?.length || 0}</td>
                         <td className="p-3 text-right font-medium text-green-700">{formatCurrency(order.total_amount || 0)}</td>
                         <td className="p-3">
                           <Badge className={
                             order.status === 'received' ? 'bg-green-100 text-green-800' :
                             order.status === 'partially_received' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-blue-100 text-blue-800'
                           }>
                             {order.status === 'order_placed' ? 'Order Placed' :
                              order.status === 'partially_received' ? 'Partially Received' :
                              'Received'}
                           </Badge>
                         </td>
                       </tr>
                     ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}