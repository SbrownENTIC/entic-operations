import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, DollarSign, Clock, Users, Package, X, AlertCircle, Calendar, ShieldCheck, Badge as BadgeIcon } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PaymentTrackingReport from "../components/reports/PaymentTrackingReport";
import MonthlyFinancialsReport from "../components/reports/MonthlyFinancialsReport";
import YearlyFinancialsReport from "../components/reports/YearlyFinancialsReport";
import SupplyOrderReportView from "../components/reports/SupplyOrderReportView";
import ProviderCredentialingReport from "../components/reports/ProviderCredentialingReport";
import ProviderLicensesReport from "../components/reports/ProviderLicensesReport";
import { PaymentTrendChart, InvoiceAgingChart, IncomeDistributionChart, SupplySpendingChart } from "../components/reports/ReportCharts";
import OfficeSupplyAnalytics from "../components/reports/OfficeSupplyAnalytics";
import PaymentQuarterView from "../components/reports/PaymentQuarterView";
import CallLogTabTrigger from "../components/reports/CallLogTabTrigger";
import CallLogReportSection from "../components/reports/CallLogReportSection";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedAgingCategory, setSelectedAgingCategory] = useState(null);
  const [allocationView, setAllocationView] = useState('standard'); // 'standard' | 'quarter'
  const [activeReportTab, setActiveReportTab] = useState('payment-tracking');
  const [callLogMounted, setCallLogMounted] = useState(false);
  // supplyOrderDetail state moved to SupplyOrderReportView component

  const handleReportTabChange = (value) => {
    setActiveReportTab(value);
    if (value === 'call-log') {
      setCallLogMounted(true);
    }
  };

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

  const { data: audiologyOrders = [], isLoading: audiologyOrdersLoading } = useQuery({
    queryKey: ['audiology-supply-orders'],
    queryFn: () => base44.entities.AudiologySupplyOrder.list('-order_date')
  });

  const { data: programLocations = [], isLoading: programLocationsLoading } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list()
  });

  const { data: vendorInvoices = [], isLoading: vendorInvoicesLoading } = useQuery({
    queryKey: ['vendor-invoices-report'],
    queryFn: () => base44.entities.VendorInvoice.list('-invoice_date', 1000)
  });

  const { data: officeSupplies = [], isLoading: officeSuppliesLoading } = useQuery({
    queryKey: ['office-supplies-catalog'],
    queryFn: () => base44.entities.Supply.filter({ category: 'office' })
  });

  const isLoading = paymentsLoading || invoicesLoading || providersLoading || incomesLoading || ordersLoading || programLocationsLoading || audiologyOrdersLoading || vendorInvoicesLoading || officeSuppliesLoading;

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const normalizeVendorName = (vendorName) => {
    const cleaned = (vendorName || 'Unknown').trim().replace(/\.+$/, '');
    return cleaned.toLowerCase().replace(/\s+/g, '') === 'staplesbusiness' ? 'Staples Business' : cleaned;
  };

  const getAgingCategory = (invoice) => {
    const days = differenceInDays(new Date(), parseISO(invoice.invoice_date));
    if (days > 90) return '90plus';
    if (days > 60) return '90days'; // 61-90
    if (days > 30) return '60days'; // 31-60
    return 'current'; // 0-30
  };

  const exportToCSV = (data, filename) => {
    // Add export date at the top
    const exportDate = format(new Date(), 'MMMM dd, yyyy');
    const dataWithDate = [
      [`Exported: ${exportDate}`, '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ...data
    ];
    
    const csvContent = dataWithDate.map(row => 
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
  const generateSupplyOrderReport = (ordersToExport, reportTitle, filename) => {
    const filteredOrders = filterByDateRange(ordersToExport, 'order_date');

    const rows = [
      [reportTitle, '', '', '', '', '', '', '', ''],
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

    exportToCSV(rows, filename);
  };

  // REPORT 6: Unlinked Invoices Report
  const generateUnlinkedInvoicesReport = () => {
    // Filter for invoices with 0 amount received (no payments linked)
    // Optionally filter out 'not_started' or 'draft' if user only wants finalized ones, 
    // but assuming they want to see all for now or filtering by date.
    const unlinkedInvoices = invoices.filter(inv => (inv.amount_received || 0) === 0);
    const filteredUnlinked = filterByDateRange(unlinkedInvoices, 'invoice_date');

    const rows = [
      ['Unlinked Invoices Report (No Payments Applied)', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Invoice Number', 'Program Group', 'Provider', 'Invoice Date', 'Total Amount', 'Status', 'Days Outstanding']
    ];

    filteredUnlinked.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      const daysOutstanding = inv.invoice_date ? differenceInDays(new Date(), parseISO(inv.invoice_date)) : 0;
      
      rows.push([
        inv.invoice_number || '',
        inv.program_group || '',
        provider?.full_name || '',
        inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '',
        inv.total || 0,
        inv.status || '',
        daysOutstanding
      ]);
    });

    rows.push(['', '', '', '', '', '', '']);
    rows.push(['TOTAL OUTSTANDING', '', '', '', filteredUnlinked.reduce((sum, inv) => sum + (inv.total || 0), 0), '', '']);

    exportToCSV(rows, 'unlinked_invoices_report');
  };

  // REPORT 7: Vendor Expenses Report
  const generateVendorExpensesReport = () => {
    const filteredInvoices = filterByDateRange(vendorInvoices, 'invoice_date');
    
    const rows = [
      ['Vendor Expenses by Entity', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Vendor', 'Invoice Number', 'Date', 'Billed To', 'Status', 'Total Amount']
    ];

    filteredInvoices.forEach(inv => {
      rows.push([
        normalizeVendorName(inv.vendor_name),
        inv.invoice_number || '',
        inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '',
        inv.billed_to || 'ENTIC',
        inv.status || '',
        inv.total_amount || 0
      ]);
    });

    // Summaries
    const enticTotal = filteredInvoices
      .filter(inv => (inv.billed_to || 'ENTIC') === 'ENTIC')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
      
    const thiTotal = filteredInvoices
      .filter(inv => inv.billed_to === 'The Hearing Institute')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    rows.push(['', '', '', '', '', '']);
    rows.push(['SUMMARY', '', '', '', '', '']);
    rows.push(['ENTIC Total', '', '', '', '', enticTotal]);
    rows.push(['The Hearing Institute Total', '', '', '', '', thiTotal]);
    rows.push(['GRAND TOTAL', '', '', '', '', enticTotal + thiTotal]);

    exportToCSV(rows, 'vendor_expenses_by_entity');
  };

  if (isLoading) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden overflow-x-hidden bg-slate-50">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <div className="text-center py-12 text-slate-500">Loading reports...</div>
          </div>
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

  const officeSupplyOrders = supplyOrders.filter(o => !o.category || o.category === 'office');
  const clinicalSupplyOrders = supplyOrders.filter(o => o.category === 'clinical');

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden overflow-x-hidden bg-slate-50">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-6 md:p-8">
        <div className="max-w-7xl mx-auto w-full min-w-0 flex flex-col gap-4">
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

        <Tabs value={activeReportTab} onValueChange={handleReportTabChange} className="flex flex-col gap-4 min-w-0 [&_[role=tabpanel]]:min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3 w-full h-auto bg-transparent p-0">
              <TabsTrigger value="payment-tracking" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <FileText className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Payment Tracking</span>
              </TabsTrigger>
              <TabsTrigger value="allocation" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <DollarSign className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Payment Allocations</span>
              </TabsTrigger>
              <TabsTrigger value="aging" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Clock className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Invoice Aging</span>
              </TabsTrigger>
              <TabsTrigger value="income" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <FileText className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Outside Income</span>
              </TabsTrigger>
              <TabsTrigger value="provider" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Users className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Invoice by Provider</span>
              </TabsTrigger>
              <TabsTrigger value="office-supplies" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Package className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Office Supplies</span>
              </TabsTrigger>
              <TabsTrigger value="office-supply-analytics" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Package className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Supply Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="clinical-supplies" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Package className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Clinical Supplies</span>
              </TabsTrigger>
              <TabsTrigger value="audiology-supplies" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Package className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Audiology Supplies</span>
              </TabsTrigger>
              <TabsTrigger value="unlinked" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Unlinked Invoices</span>
              </TabsTrigger>
              <TabsTrigger value="vendor-expenses" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <DollarSign className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Vendor Expenses</span>
              </TabsTrigger>
              <TabsTrigger value="credentialing" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Users className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Credentialing</span>
              </TabsTrigger>
              <TabsTrigger value="licenses" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Licenses</span>
              </TabsTrigger>
              <TabsTrigger value="monthly-financials" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Calendar className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Monthly Financials</span>
              </TabsTrigger>
              <TabsTrigger value="yearly-financials" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm">
                <Calendar className="w-5 h-5 shrink-0" />
                <span className="text-xs font-medium">Yearly Financials</span>
              </TabsTrigger>
              <CallLogTabTrigger />

            </TabsList>
          </div>

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
                  <div className="flex items-center gap-2">
                    {allocationView === 'standard' && (
                      <Button onClick={generateAllocationReport} variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export to CSV
                      </Button>
                    )}
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setAllocationView('standard')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${allocationView === 'standard' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Standard View
                      </button>
                      <button
                        onClick={() => setAllocationView('quarter')}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${allocationView === 'quarter' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Payment Quarter View
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {allocationView === 'standard' ? (
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
                    <PaymentTrendChart payments={filterByDateRange(payments, 'payment_date')} />
                  </div>
                ) : (
                  <PaymentQuarterView
                    payments={filterByDateRange(payments, 'payment_date')}
                    invoices={invoices}
                    providers={providers}
                    outsideIncome={incomes}
                    programLocations={programLocations}
                    formatCurrency={formatCurrency}
                    onExport={exportToCSV}
                  />
                )}
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
                      { label: '0-30 days', key: 'current', classes: { bg: 'bg-blue-50', text: 'text-blue-700', selected: 'border-blue-500 ring-2 ring-blue-200' } },
                      { label: '31-60 days', key: '60days', classes: { bg: 'bg-yellow-50', text: 'text-yellow-700', selected: 'border-yellow-500 ring-2 ring-yellow-200' } },
                      { label: '61-90 days', key: '90days', classes: { bg: 'bg-orange-50', text: 'text-orange-700', selected: 'border-orange-500 ring-2 ring-orange-200' } },
                      { label: '90+ days', key: '90plus', classes: { bg: 'bg-red-50', text: 'text-red-700', selected: 'border-red-500 ring-2 ring-red-200' } }
                    ].map(({ label, key, classes }) => {
                      const count = invoices.filter(inv => {
                         const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                         return balance > 0 && getAgingCategory(inv) === key;
                      }).length;
                      
                      return (
                        <div 
                          key={key} 
                          onClick={() => setSelectedAgingCategory(selectedAgingCategory === key ? null : key)}
                          className={`${classes.bg} p-4 rounded-lg cursor-pointer transition-all border-2 ${selectedAgingCategory === key ? classes.selected : 'border-transparent hover:scale-105'}`}
                        >
                          <p className="text-sm text-slate-600">{label}</p>
                          <p className={`text-2xl font-bold ${classes.text}`}>{count}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 mb-4">
                        This report categorizes outstanding invoices by age, helping you prioritize 
                        collections and identify problematic accounts. Click on a category above to filter the list below.
                      </p>
                    </div>
                    <InvoiceAgingChart 
                      agingData={{
                        current: invoices.filter(inv => {
                            const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                            return balance > 0 && getAgingCategory(inv) === 'current';
                        }).reduce((sum, inv) => sum + ((inv.amount_expected || inv.total || 0) - (inv.amount_received || 0)), 0),
                        '30days': invoices.filter(inv => {
                            const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                            return balance > 0 && getAgingCategory(inv) === '60days';
                        }).reduce((sum, inv) => sum + ((inv.amount_expected || inv.total || 0) - (inv.amount_received || 0)), 0),
                        '60days': invoices.filter(inv => {
                            const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                            return balance > 0 && getAgingCategory(inv) === '90days';
                        }).reduce((sum, inv) => sum + ((inv.amount_expected || inv.total || 0) - (inv.amount_received || 0)), 0),
                        '90plus': invoices.filter(inv => {
                            const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                            return balance > 0 && getAgingCategory(inv) === '90plus';
                        }).reduce((sum, inv) => sum + ((inv.amount_expected || inv.total || 0) - (inv.amount_received || 0)), 0)
                      }} 
                    />
                  </div>
                  
                  {/* Filtered List Section */}
                  {selectedAgingCategory && (
                    <div className="mt-8 border-t border-slate-100 pt-6">
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-lg font-semibold text-slate-900">
                           Invoices: {[
                             { label: '0-30 days', key: 'current' },
                             { label: '31-60 days', key: '60days' },
                             { label: '61-90 days', key: '90days' },
                             { label: '90+ days', key: '90plus' }
                           ].find(c => c.key === selectedAgingCategory)?.label}
                         </h3>
                         <Button variant="ghost" size="sm" onClick={() => setSelectedAgingCategory(null)}>
                           <X className="w-4 h-4 mr-2" /> Clear Filter
                         </Button>
                       </div>
                       
                       <div className="overflow-x-auto overflow-y-auto max-h-96 border rounded-lg">
                          <table className="w-full min-w-max text-sm">
                            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="text-left p-3 font-semibold text-slate-700">Invoice #</th>
                                <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                                <th className="text-left p-3 font-semibold text-slate-700">Provider</th>
                                <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                                <th className="text-right p-3 font-semibold text-slate-700">Balance</th>
                                <th className="text-right p-3 font-semibold text-slate-700">Days</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.filter(inv => {
                                const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                                return balance > 0 && getAgingCategory(inv) === selectedAgingCategory;
                              }).map(inv => {
                                const provider = providers.find(p => p.id === inv.staff_member_id);
                                const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                                const days = differenceInDays(new Date(), parseISO(inv.invoice_date));
                                return (
                                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-medium">
                                      <Link to={`${createPageUrl("Invoices")}?edit=${inv.id}`} className="text-blue-600 hover:underline">
                                        {inv.invoice_number || '(No Number)'}
                                      </Link>
                                    </td>
                                    <td className="p-3 text-slate-600">
                                      {format(parseISO(inv.invoice_date), 'MMM d, yyyy')}
                                    </td>
                                    <td className="p-3 text-slate-900">{provider?.full_name || '-'}</td>
                                    <td className="p-3 text-slate-600">{inv.program_group || '-'}</td>
                                    <td className="p-3 text-right font-medium text-red-600">{formatCurrency(balance)}</td>
                                    <td className="p-3 text-right text-slate-600">{days}</td>
                                  </tr>
                                );
                              })}
                              {invoices.filter(inv => {
                                const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                                return balance > 0 && getAgingCategory(inv) === selectedAgingCategory;
                              }).length === 0 && (
                                <tr>
                                  <td colSpan="6" className="p-8 text-center text-slate-500">No invoices found in this category.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                       </div>
                    </div>
                  )}
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
                <IncomeDistributionChart incomes={incomes} providers={providers} />
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

          <TabsContent value="office-supplies">
            <SupplyOrderReportView 
              orders={officeSupplyOrders}
              title="Office Supply Orders Report"
              subtitle="Supply spending analysis for office supplies"
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              onExport={() => generateSupplyOrderReport(officeSupplyOrders, 'Office Supply Orders Report', 'office_supply_orders_report')}
            />
          </TabsContent>

          <TabsContent value="office-supply-analytics">
            <OfficeSupplyAnalytics
              orders={officeSupplyOrders}
              supplies={officeSupplies}
              dateRange={dateRange}
            />
          </TabsContent>

          <TabsContent value="clinical-supplies">
            <SupplyOrderReportView 
              orders={clinicalSupplyOrders}
              title="Clinical Supply Orders Report"
              subtitle="Supply spending analysis for clinical supplies"
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              onExport={() => generateSupplyOrderReport(clinicalSupplyOrders, 'Clinical Supply Orders Report', 'clinical_supply_orders_report')}
            />
          </TabsContent>

          <TabsContent value="audiology-supplies">
            <SupplyOrderReportView 
              orders={audiologyOrders}
              title="Audiology Supply Orders Report"
              subtitle="Supply spending analysis for audiology supplies"
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              onExport={() => generateSupplyOrderReport(audiologyOrders, 'Audiology Supply Orders Report', 'audiology_supply_orders_report')}
              linkDestination="AudiologySupplyOrders"
            />
          </TabsContent>

          <TabsContent value="unlinked">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Unlinked Invoices Report</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Invoices with no payments applied (Amount Received = $0)
                    </p>
                  </div>
                  <Button onClick={generateUnlinkedInvoicesReport} className="gap-2 bg-red-600 hover:bg-red-700">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const unlinkedInvoices = invoices.filter(inv => (inv.amount_received || 0) === 0);
                    const filtered = filterByDateRange(unlinkedInvoices, 'invoice_date');
                    const totalAmount = filtered.reduce((sum, inv) => sum + (inv.total || 0), 0);
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <p className="text-sm text-slate-600">Unlinked Invoices</p>
                            <p className="text-2xl font-bold text-red-700">{filtered.length}</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <p className="text-sm text-slate-600">Total Unlinked Amount</p>
                            <p className="text-2xl font-bold text-red-700">{formatCurrency(totalAmount)}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <p className="text-sm text-slate-600">Date Range</p>
                            <p className="text-lg font-semibold text-slate-700">
                              {dateRange.start || dateRange.end ? 
                                `${dateRange.start || 'Start'} to ${dateRange.end || 'End'}` : 
                                'All Time'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-md font-semibold text-slate-900 mb-3">Recent Unlinked Invoices</h3>
                          <div className="overflow-x-auto overflow-y-auto max-h-96 border rounded-lg">
                            <table className="w-full min-w-max text-sm">
                              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="text-left p-3 font-semibold text-slate-700">Invoice #</th>
                                  <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                                  <th className="text-left p-3 font-semibold text-slate-700">Provider</th>
                                  <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                                  <th className="text-right p-3 font-semibold text-slate-700">Total</th>
                                  <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.length > 0 ? filtered.slice(0, 50).map(inv => {
                                  const provider = providers.find(p => p.id === inv.staff_member_id);
                                  return (
                                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                                      <td className="p-3 font-medium">
                                        <Link to={`${createPageUrl("Invoices")}?edit=${inv.id}`} className="text-blue-600 hover:underline">
                                          {inv.invoice_number || '(No Number)'}
                                        </Link>
                                      </td>
                                      <td className="p-3 text-slate-600">
                                        {inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '-'}
                                      </td>
                                      <td className="p-3 text-slate-900">{provider?.full_name || '-'}</td>
                                      <td className="p-3 text-slate-600">{inv.program_group || '-'}</td>
                                      <td className="p-3 text-right font-medium text-red-600">{formatCurrency(inv.total || 0)}</td>
                                      <td className="p-3">
                                        <Badge variant="outline" className="bg-white">
                                          {inv.status}
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                }) : (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">No unlinked invoices found in this period.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          {filtered.length > 50 && (
                            <p className="text-xs text-slate-500 mt-2 text-center">Showing first 50 records. Export to CSV to view all {filtered.length} records.</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendor-expenses">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Vendor Expenses by Entity</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Breakdown of vendor invoices billed to ENTIC vs The Hearing Institute
                    </p>
                  </div>
                  <Button onClick={generateVendorExpensesReport} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {(() => {
                    const filtered = filterByDateRange(vendorInvoices, 'invoice_date');
                    const enticInvoices = filtered.filter(inv => (inv.billed_to || 'ENTIC') === 'ENTIC');
                    const thiInvoices = filtered.filter(inv => inv.billed_to === 'The Hearing Institute');
                    
                    const enticTotal = enticInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                    const thiTotal = thiInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                            <h3 className="text-lg font-semibold text-blue-900 mb-2">ENTIC</h3>
                            <p className="text-sm text-blue-600 mb-4">Total Billed Expenses</p>
                            <p className="text-4xl font-bold text-blue-700">{formatCurrency(enticTotal)}</p>
                            <p className="text-sm text-blue-600 mt-2">{enticInvoices.length} invoices</p>
                          </div>
                          <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                            <h3 className="text-lg font-semibold text-purple-900 mb-2">The Hearing Institute</h3>
                            <p className="text-sm text-purple-600 mb-4">Total Billed Expenses</p>
                            <p className="text-4xl font-bold text-purple-700">{formatCurrency(thiTotal)}</p>
                            <p className="text-sm text-purple-600 mt-2">{thiInvoices.length} invoices</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                          <h3 className="font-semibold text-slate-900 mb-4">Top Vendors Breakdown</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                              <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase">ENTIC Vendors</h4>
                              <div className="space-y-2">
                                {Object.entries(enticInvoices.reduce((acc, inv) => {
                                  const vendor = normalizeVendorName(inv.vendor_name);
                                  if (!acc[vendor]) acc[vendor] = 0;
                                  acc[vendor] += (inv.total_amount || 0);
                                  return acc;
                                }, {}))
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 10)
                                .map(([vendor, amount]) => (
                                  <div key={vendor} className="flex justify-between items-center text-sm p-2 bg-white rounded border border-slate-100">
                                    <span className="font-medium text-slate-700">{vendor}</span>
                                    <span className="text-slate-900">{formatCurrency(amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase">Hearing Institute Vendors</h4>
                              <div className="space-y-2">
                                {Object.entries(thiInvoices.reduce((acc, inv) => {
                                  const vendor = normalizeVendorName(inv.vendor_name);
                                  if (!acc[vendor]) acc[vendor] = 0;
                                  acc[vendor] += (inv.total_amount || 0);
                                  return acc;
                                }, {}))
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 10)
                                .map(([vendor, amount]) => (
                                  <div key={vendor} className="flex justify-between items-center text-sm p-2 bg-white rounded border border-slate-100">
                                    <span className="font-medium text-slate-700">{vendor}</span>
                                    <span className="text-slate-900">{formatCurrency(amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentialing">
            <ProviderCredentialingReport />
          </TabsContent>

          <TabsContent value="licenses">
            <ProviderLicensesReport />
          </TabsContent>

          <TabsContent value="monthly-financials">
            <MonthlyFinancialsReport 
              payments={payments}
              invoices={invoices}
              providers={providers}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="yearly-financials">
            <YearlyFinancialsReport 
              payments={payments}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="call-log" className="p-0">
            {callLogMounted && (
              <CallLogReportSection isTabActive={activeReportTab === 'call-log'} />
            )}
          </TabsContent>

        </Tabs>

        </div>
      </div>
    </div>
  );
}