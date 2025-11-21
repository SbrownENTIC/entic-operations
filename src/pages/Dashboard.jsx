import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, AlertTriangle, Award, FileText, GraduationCap, DollarSign, CheckCircle2, Clock, Building2, RefreshCw, Wallet, Download, Package } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FinancialDetailModal from "../components/dashboard/FinancialDetailModal";

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [invoiceLocationFilter, setInvoiceLocationFilter] = useState('all');
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    invoices: [],
    type: '',
    programGroup: null
  });

  const queryClient = useQueryClient();

  // Common error handler for all queries
  const handleQueryError = (error) => {
    console.error('Dashboard query error:', error);
    // Don't redirect or throw - just log and let the query return empty data
    return [];
  };

  const { data: providers = [], isLoading: providersLoading, isError: providersError } = useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      try {
        return await base44.entities.Provider.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: licenses = [], isLoading: licensesLoading, isError: licensesError } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      try {
        return await base44.entities.License.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: privileges = [], isLoading: privilegesLoading, isError: privilegesError } = useQuery({
    queryKey: ['privileges'],
    queryFn: async () => {
      try {
        return await base44.entities.ClinicalPrivilege.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      try {
        return await base44.entities.Invoice.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: cmeRecords = [], isLoading: cmeLoading, isError: cmeError } = useQuery({
    queryKey: ['cme'],
    queryFn: async () => {
      try {
        return await base44.entities.CME.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: payments = [], isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        return await base44.entities.Payment.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: supplyOrders = [], isLoading: supplyOrdersLoading } = useQuery({
    queryKey: ['flagged-supply-orders'],
    queryFn: async () => {
      try {
        const allOrders = await base44.entities.SupplyOrder.list('-order_date');
        return allOrders.filter(order => 
          order.status === 'pending_review' || order.status === 'pending_fulfillment'
        );
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const handleSyncPaymentsAndInvoices = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await base44.functions.invoke('syncPaymentsAndInvoices', {});
      setSyncMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      setSyncMessage('Error syncing: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Check if there were any errors loading critical data
  const hasErrors = providersError || licensesError || privilegesError || invoicesError || cmeError || paymentsError;
  
  if (hasErrors) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Dashboard</h3>
            <p className="text-slate-600 mb-6">There was an issue loading your dashboard data. This might be a temporary connectivity problem.</p>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = createPageUrl("Providers")}
                variant="outline"
                className="w-full"
              >
                Go to Providers Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openFinancialDetail = (type, programGroup = null) => {
    let filteredInvoices = [];
    let title = '';

    if (type === 'paidToENTIC') {
      filteredInvoices = invoices.filter(inv => 
        inv.status === 'paid_to_entic' || inv.status === 'provider_paid'
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Paid to ENTIC - ${programGroup}`;
      } else {
        title = 'Total Paid to ENTIC';
      }
    } else if (type === 'owedToProviders') {
      filteredInvoices = invoices.filter(inv => 
        (inv.amount_received > 0) && !inv.provider_paid
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Owed to Providers - ${programGroup}`;
      } else {
        title = 'Total Owed to Providers';
      }
    } else if (type === 'outstanding') {
      filteredInvoices = invoices.filter(inv => 
        inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid' && (inv.amount_expected > (inv.amount_received || 0))
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Outstanding to ENTIC - ${programGroup}`;
      } else {
        title = 'Total Outstanding to ENTIC';
      }
    }

    setModalState({
      isOpen: true,
      title,
      invoices: filteredInvoices,
      type,
      programGroup
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      invoices: [],
      type: '',
      programGroup: null
    });
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

  // Show loading state
  const isLoading = providersLoading || licensesLoading || privilegesLoading || 
                    invoicesLoading || cmeLoading || paymentsLoading || supplyOrdersLoading;

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Provider counts
  const activeProviders = providers.filter(p => p.status === 'active').length;

  // License expiration tracking
  const today = new Date();
  const licensesExpiring60Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (provider?.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 60;
  });
  const licensesExpiring30Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (provider?.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 30;
  });
  const licensesExpiring14Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (provider?.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 14;
  });
  const licensesExpiring7Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (provider?.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 7;
  });

  // Privilege expiration tracking
  const privilegesExpiring30Days = privileges.filter(p => {
    const days = differenceInDays(parseISO(p.expiration_date), today);
    return days > 0 && days <= 30;
  });

  // Financial metrics - Total
  const totalAllocatedToInvoices = payments.reduce((sum, payment) => {
    const allocatedAmount = payment.allocations?.reduce((allocSum, allocation) => {
      if (allocation.invoice_id) {
        return allocSum + (allocation.amount || 0);
      }
      return allocSum;
    }, 0) || 0;
    return sum + allocatedAmount;
  }, 0);

  // totalPaidToENTIC should reflect actual amount received against invoices
  // For simplicity and matching current logic, using amount_received from invoices directly, or a more precise calculation.
  // The current `totalAllocatedToInvoices` sums up allocated payment amounts. Let's align `totalPaidToENTIC` to reflect this.
  // Or, if we want to reflect total amount received for invoices regardless of allocation:
  const totalPaidToENTIC = invoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const totalOwedToProviders = invoices
    .filter(inv => (inv.amount_received > 0) && !inv.provider_paid)
    .reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const outstandingToENTIC = invoices
    .reduce((sum, inv) => {
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + (outstanding > 0 ? outstanding : 0);
    }, 0);

  const unallocatedPayments = payments.reduce((sum, payment) => sum + (payment.unallocated_amount || 0), 0);

  // Financial metrics by Program/Location
  const financialsByProgram = {};
  invoices.forEach(inv => {
    const program = inv.program_group || 'Unassigned';
    
    if (!financialsByProgram[program]) {
      financialsByProgram[program] = {
        paidToENTIC: 0,
        owedToProviders: 0,
        outstanding: 0
      };
    }
    
    if (inv.amount_received > 0) {
      financialsByProgram[program].paidToENTIC += (inv.amount_received || 0);
      
      if (!inv.provider_paid) {
        financialsByProgram[program].owedToProviders += (inv.amount_received || 0);
      }
    }
    
    const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
    if (outstanding > 0) {
      financialsByProgram[program].outstanding += outstanding;
    }
  });

  const programsSorted = Object.keys(financialsByProgram).sort();

  // Invoice tracking
  // The previous calculation for pendingInvoices only included a subset.
  // The new detailed invoice summary by status will make this specific pending calculation less critical for display,
  // but keeping it for the summary card.
  const pendingInvoices = invoices.filter(inv => 
    inv.status === 'not_started' ||
    inv.status === 'draft' ||
    inv.status === 'pending_providers_approval' || 
    inv.status === 'pending_providers_time' ||
    inv.status === 'sent_for_approval'
  ).length;

  const overdueInvoices = invoices.filter(inv => {
    if (!inv.sent_to_vendor_at) return false;
    const daysSinceSent = differenceInDays(today, parseISO(inv.sent_to_vendor_at));
    return daysSinceSent > 30 && inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid';
  }).length;

  // CME compliance for doctors
  const doctors = providers.filter(p => p.role === 'ENT MD' && p.status === 'active');
  const cmeByProvider = {};
  cmeRecords.forEach(record => {
    if (!cmeByProvider[record.provider_id]) {
      cmeByProvider[record.provider_id] = 0;
    }
    cmeByProvider[record.provider_id] += record.credits || 0;
  });

  const doctorsCompliant = doctors.filter(doc => (cmeByProvider[doc.id] || 0) >= 3).length;
  const doctorsNonCompliant = doctors.filter(doc => (cmeByProvider[doc.id] || 0) < 3);

  // Format currency with commas
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportFinancialOverview = () => {
    const rows = [
      ['Financial Overview Summary', '', '', ''],
      ['Category', 'Amount', '', ''],
      ['Outstanding to ENTIC', formatCurrency(outstandingToENTIC), '', ''],
      ['Total Paid to ENTIC', formatCurrency(totalPaidToENTIC), '', ''],
      ['Owed to Providers', formatCurrency(totalOwedToProviders), '', ''],
      ['Unallocated Payments', formatCurrency(unallocatedPayments), '', ''],
      ['', '', '', ''],
      ['Program/Location', 'Outstanding to ENTIC', 'Paid to ENTIC', 'Owed to Providers']
    ];
    
    programsSorted.forEach(program => {
      const data = financialsByProgram[program];
      rows.push([
        program,
        formatCurrency(data.outstanding),
        formatCurrency(data.paidToENTIC),
        formatCurrency(data.owedToProviders)
      ]);
    });
    
    rows.push([
      'Total',
      formatCurrency(outstandingToENTIC),
      formatCurrency(totalPaidToENTIC),
      formatCurrency(totalOwedToProviders)
    ]);
    
    exportToCSV(rows, 'financial_overview');
  };

  const exportLicenseExpirations = () => {
    const rows = [
      ['Provider Name', 'License Type', 'Internal Number', 'Expiration Date', 'Days Until Expiration', 'Status']
    ];
    
    licensesExpiring60Days.forEach(license => {
      const provider = providers.find(p => p.id === license.provider_id);
      const daysUntil = differenceInDays(parseISO(license.expiration_date), today);
      rows.push([
        provider?.full_name || '',
        license.license_type,
        license.internal_license_number,
        format(parseISO(license.expiration_date), 'yyyy-MM-dd'),
        daysUntil,
        daysUntil <= 7 ? 'Critical (7 days)' : 
        daysUntil <= 14 ? 'High Priority (14 days)' : 
        daysUntil <= 30 ? 'Medium Priority (30 days)' : 
        'Low Priority (60 days)'
      ]);
    });
    
    exportToCSV(rows, 'license_expirations');
  };

  const exportCMECompliance = () => {
    const rows = [
      ['Provider Name', 'Total CME Credits', 'Compliance Status']
    ];
    
    doctors.forEach(doctor => {
      const credits = cmeByProvider[doctor.id] || 0;
      rows.push([
        doctor.full_name,
        credits,
        credits >= 3 ? 'Compliant' : 'Non-Compliant'
      ]);
    });
    
    exportToCSV(rows, 'cme_compliance');
  };

  const exportInvoiceSummary = () => {
    const rows = [
      ['Invoice Summary', '', ''],
      ['Category', 'Count', ''],
      ['Pending Invoices (Overall)', pendingInvoices, ''], // Refers to the broader "pending" definition
      ['Overdue Invoices (30+ days)', overdueInvoices, ''],
      ['Paid Invoices', invoices.filter(inv => inv.status === 'paid_to_entic' || inv.status === 'provider_paid').length, ''],
      ['', '', ''],
      ['Invoice Number', 'Program Group', 'Provider', 'Date', 'Status', 'Total', 'Amount Received']
    ];
    
    // Filter invoices for export based on the current UI filter
    const invoicesToExport = invoiceLocationFilter === 'all' 
      ? invoices
      : invoices.filter(inv => inv.program_group === invoiceLocationFilter);

    invoicesToExport.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      rows.push([
        inv.invoice_number || '',
        inv.program_group || '',
        provider?.full_name || '',
        inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '',
        inv.status,
        inv.total || 0,
        inv.amount_received || 0
      ]);
    });
    
    exportToCSV(rows, 'invoice_summary');
  };

  // Get unique program groups from invoices for the filter
  const availableLocations = ['all', ...new Set(invoices.map(inv => inv.program_group).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1; // 'all' always first
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <style>{`
        @keyframes slow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-slow-pulse {
          animation: slow-pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes alert-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(220, 38, 38, 0.4), 0 0 40px rgba(220, 38, 38, 0.2);
          }
          50% { 
            box-shadow: 0 0 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3);
          }
        }
        @keyframes yellow-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(202, 138, 4, 0.4), 0 0 40px rgba(202, 138, 4, 0.2);
          }
          50% { 
            box-shadow: 0 0 30px rgba(202, 138, 4, 0.6), 0 0 60px rgba(202, 138, 4, 0.3);
          }
        }
        @keyframes alert-scale {
          0%, 100% { 
            transform: scale(1);
          }
          50% { 
            transform: scale(1.03);
          }
        }
        .animate-alert-glow {
          animation: alert-glow 3.2s ease-in-out infinite, alert-scale 3.2s ease-in-out infinite;
        }
        .animate-yellow-glow {
          animation: yellow-glow 3.2s ease-in-out infinite, alert-scale 3.2s ease-in-out infinite;
        }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of your medical practice</p>
        </div>

        {syncMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{syncMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className={`bg-gradient-to-br from-red-100 to-red-50 transition-all duration-300 ${supplyOrders.length > 0 ? 'border-[5px] border-red-600 animate-alert-glow' : 'border-3 border-red-300 shadow-xl shadow-red-300/60 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-red-400">
              <AlertTriangle className="w-6 h-6 text-red-700 animate-slow-pulse" />
              <CardTitle className="text-sm font-bold text-slate-900">Supply Order Requests</CardTitle>
              <AlertTriangle className="w-6 h-6 text-red-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-red-700 mb-1">{supplyOrders.length}</div>
              <Link to={createPageUrl("SupplyOrders") + "?filter=pending"} className="text-xs text-red-700 hover:text-red-900 font-semibold hover:underline">
                View requests →
              </Link>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br from-yellow-100 to-yellow-50 transition-all duration-300 ${pendingInvoices > 0 ? 'border-[5px] border-yellow-600 animate-yellow-glow' : 'border-3 border-yellow-300 shadow-xl shadow-yellow-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-yellow-300">
              <CardTitle className="text-sm font-bold text-slate-900">Invoices Sent for Approval</CardTitle>
              <FileText className="w-5 h-5 text-yellow-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-yellow-700 mb-1">{pendingInvoices}</div>
              <Link to={createPageUrl("Invoices")} className="text-xs text-yellow-700 hover:text-yellow-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br from-red-100 to-red-50 transition-all duration-300 ${licensesExpiring14Days.length > 0 ? 'border-[5px] border-red-600 animate-alert-glow' : 'border-3 border-red-300 shadow-xl shadow-red-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-red-300">
              <AlertTriangle className="w-6 h-6 text-red-700 animate-slow-pulse" />
              <CardTitle className="text-sm font-bold text-slate-900">Licenses Expiring (14d)</CardTitle>
              <AlertTriangle className="w-6 h-6 text-red-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-red-700 mb-1">{licensesExpiring14Days.length}</div>
              <Link to={createPageUrl("Licenses")} className="text-xs text-red-700 hover:text-red-900 font-semibold hover:underline">
                View licenses →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-3 border-purple-500 bg-gradient-to-br from-purple-100 to-purple-50 shadow-xl shadow-purple-200/50 hover:scale-105 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-purple-300">
              <CardTitle className="text-sm font-bold text-slate-900">Privileges Expiring (30d)</CardTitle>
              <Award className="w-5 h-5 text-purple-700 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-purple-700 mb-1">{privilegesExpiring30Days.length}</div>
              <Link to={createPageUrl("ClinicalPrivileges")} className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline">
                View privileges →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* License Expirations Detail */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">License Expirations</h2>
            <Button
              onClick={exportLicenseExpirations}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <LicenseExpirationCard
              title="Expiring in 7 Days"
              licenses={licensesExpiring7Days}
              providers={providers}
              severity="high"
            />
            <LicenseExpirationCard
              title="Expiring in 14 Days"
              licenses={licensesExpiring14Days}
              providers={providers}
              severity="medium"
            />
            <LicenseExpirationCard
              title="Expiring in 30 Days"
              licenses={licensesExpiring30Days}
              providers={providers}
              severity="low"
            />
            <LicenseExpirationCard
              title="Expiring in 60 Days"
              licenses={licensesExpiring60Days}
              providers={providers}
              severity="info"
            />
          </div>
        </div>

        {/* Invoice Summary */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Invoice Summary by Status ({invoices.length})</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={invoiceLocationFilter} onValueChange={setInvoiceLocationFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLocations.map(loc => (
                      <SelectItem key={loc} value={loc}>
                        {loc === 'all' ? 'All Locations' : loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={exportInvoiceSummary}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {Object.entries({
                'Not Started': { invoices: invoices.filter(inv => inv.status === 'not_started'), color: 'gray' },
                'Draft': { invoices: invoices.filter(inv => inv.status === 'draft'), color: 'slate' },
                'Sent for Approval': { invoices: invoices.filter(inv => inv.status === 'pending_providers_approval' || inv.status === 'pending_providers_time' || inv.status === 'sent_for_approval'), color: 'yellow' },
                'Sent To Vendor': { invoices: invoices.filter(inv => inv.status === 'sent_to_vendor'), color: 'blue' },
                'Partial': { invoices: invoices.filter(inv => inv.status === 'partial'), color: 'indigo' },
                'Paid To ENTIC': { invoices: invoices.filter(inv => inv.status === 'paid_to_entic'), color: 'emerald' },
                'Provider Paid': { invoices: invoices.filter(inv => inv.status === 'provider_paid'), color: 'purple' },
              }).map(([status, { invoices: statusInvoices, color }]) => {
                const filteredStatusInvoices = invoiceLocationFilter === 'all' 
                  ? statusInvoices 
                  : statusInvoices.filter(inv => inv.program_group === invoiceLocationFilter);

                return (
                  <Card key={status} className={`border-${color}-200 bg-${color}-50/30 shadow-sm`}>
                    <CardHeader className="pb-2 border-b border-slate-200 bg-white">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 text-xs">{status}</h3>
                        <Badge className={`bg-${color}-100 text-${color}-800 border-${color}-300 text-xs`}>
                          {filteredStatusInvoices.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2">
                      {filteredStatusInvoices.length > 0 ? (
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {filteredStatusInvoices.map(inv => {
                            const isUConn = inv.program_group === 'UConn';
                            return (
                              <Link 
                                key={inv.id} 
                                to={`${createPageUrl("Invoices")}?edit=${inv.id}`}
                                className={`block text-xs px-2 py-1.5 bg-white hover:bg-${color}-100 rounded border border-slate-200 hover:border-${color}-400 transition-all shadow-sm hover:shadow`}
                              >
                                <div className="font-medium text-slate-900 text-xs">
                                  {inv.invoice_number || 'N/A'}
                                </div>
                                <div className="text-[10px] text-slate-600 truncate">
                                  {providers.find(p => p.id === inv.staff_member_id)?.full_name || 'Unknown'}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {inv.program_group || 'No Location'}
                                </div>
                                {isUConn && inv.month && (
                                  <div className="text-[10px] text-blue-600 font-medium">
                                    {inv.month}
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center py-6 text-slate-400 text-xs">No invoices</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Financial Overview - Total */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Financial Overview</h2>
            <Button
              onClick={exportFinancialOverview}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card 
              className="border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => openFinancialDetail('outstanding')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Outstanding to ENTIC</CardTitle>
                <Clock className="w-5 h-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-700">{formatCurrency(outstandingToENTIC)}</div>
                <p className="text-xs text-slate-500 mt-1">Awaiting payment from clients</p>
                <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
              </CardContent>
            </Card>

            <Card 
              className="border-slate-200 shadow-sm bg-gradient-to-br from-green-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => openFinancialDetail('paidToENTIC')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Total Paid to ENTIC</CardTitle>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700">{formatCurrency(totalPaidToENTIC)}</div>
                <p className="text-xs text-slate-500 mt-1">Payments received from clients</p>
                <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
              </CardContent>
            </Card>

            <Card 
              className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => openFinancialDetail('owedToProviders')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Owed to Providers</CardTitle>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700">{formatCurrency(totalOwedToProviders)}</div>
                <p className="text-xs text-slate-500 mt-1">Received but not yet paid out</p>
                <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
              </CardContent>
            </Card>

            <Link to={createPageUrl("Payments")} className="block">
              <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-purple-50 to-white cursor-pointer hover:shadow-lg transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Unallocated Payments</CardTitle>
                  <Wallet className="w-5 h-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-700">{formatCurrency(unallocatedPayments)}</div>
                  <p className="text-xs text-slate-500 mt-1">Payments pending allocation</p>
                  <p className="text-xs text-blue-600 mt-2 hover:underline">Click to allocate →</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Financial Overview by Program/Location */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Financial Overview by Program/Location</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Detailed breakdown of finances per program (click amounts for details)</p>
              </div>
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Program/Location</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Outstanding to ENTIC</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Paid to ENTIC</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Owed to Providers</th>
                  </tr>
                </thead>
                <tbody>
                  {programsSorted.map((program) => {
                    const data = financialsByProgram[program];
                    return (
                      <tr key={program} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-900">{program}</td>
                        <td 
                          className="p-4 text-right font-medium text-orange-700 cursor-pointer hover:underline"
                          onClick={() => openFinancialDetail('outstanding', program)}
                        >
                          {formatCurrency(data.outstanding)}
                        </td>
                        <td 
                          className="p-4 text-right font-medium text-green-700 cursor-pointer hover:underline"
                          onClick={() => openFinancialDetail('paidToENTIC', program)}
                        >
                          {formatCurrency(data.paidToENTIC)}
                        </td>
                        <td 
                          className="p-4 text-right font-medium text-blue-700 cursor-pointer hover:underline"
                          onClick={() => openFinancialDetail('owedToProviders', program)}
                        >
                          {formatCurrency(data.owedToProviders)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="p-4 font-bold text-slate-900">Total</td>
                    <td 
                      className="p-4 text-right font-bold text-orange-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('outstanding')}
                    >
                      {formatCurrency(outstandingToENTIC)}
                    </td>
                    <td 
                      className="p-4 text-right font-bold text-green-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('paidToENTIC')}
                    >
                      {formatCurrency(totalPaidToENTIC)}
                    </td>
                    <td 
                      className="p-4 text-right font-bold text-blue-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('owedToProviders')}
                    >
                      {formatCurrency(totalOwedToProviders)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* CME Compliance - Only Non-Compliant Doctors */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">CME Non-Compliance - Doctors Requiring Attention</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Doctors must earn 3+ CME credits</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={exportCMECompliance}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <GraduationCap className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="mb-3">
              <div className="text-xl font-bold text-slate-900">
                {doctorsCompliant} / {doctors.length}
              </div>
              <p className="text-xs text-slate-600">Doctors compliant</p>
            </div>
            {doctorsNonCompliant.length > 0 ? (
              <div className="space-y-2">
                {doctorsNonCompliant.map(doctor => {
                  const credits = cmeByProvider[doctor.id] || 0;
                  return (
                    <div key={doctor.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-red-100 to-red-50 rounded-lg border-2 border-red-400 shadow-md hover:shadow-lg transition-all duration-200">
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 text-sm">{doctor.full_name}</p>
                        <p className="text-xs text-slate-700 font-medium">{credits} / 3 CME credits</p>
                      </div>
                      <Badge className="bg-red-600 text-white border-0 font-bold text-xs">
                        Non-compliant
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="text-green-700 font-medium text-sm">All doctors are CME compliant!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FinancialDetailModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        invoices={modalState.invoices}
        providers={providers}
        type={modalState.type}
        programGroup={modalState.programGroup}
      />
    </div>
  );
}

function LicenseExpirationCard({ title, licenses, providers, severity }) {
  const severityColors = {
    high: 'border-red-500 bg-gradient-to-br from-red-100 to-red-50 shadow-lg shadow-red-200/50',
    medium: 'border-orange-500 bg-gradient-to-br from-orange-100 to-orange-50 shadow-lg shadow-orange-200/50',
    low: 'border-yellow-500 bg-gradient-to-br from-yellow-100 to-yellow-50 shadow-lg shadow-yellow-200/50',
    info: 'border-blue-400 bg-gradient-to-br from-blue-50 to-slate-50 shadow-md'
  };

  const iconClasses = {
    high: 'text-red-700 w-5 h-5 animate-pulse',
    medium: 'text-orange-700 w-5 h-5',
    low: 'text-yellow-700 w-5 h-5',
    info: 'text-blue-600 w-4 h-4'
  };

  const itemColors = {
    high: 'bg-white border-red-300 hover:border-red-400 hover:shadow-md',
    medium: 'bg-white border-orange-300 hover:border-orange-400 hover:shadow-md',
    low: 'bg-white border-yellow-300 hover:border-yellow-400 hover:shadow-md',
    info: 'bg-white border-blue-200 hover:border-blue-300 hover:shadow-md'
  };

  return (
    <Card className={`border-2 ${severityColors[severity]} transition-all duration-300 hover:scale-105`}>
      <CardHeader className="border-b-2 border-slate-200 bg-white/80 backdrop-blur-sm py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={iconClasses[severity]} />
          <CardTitle className="text-xs font-bold text-slate-900">{title}</CardTitle>
        </div>
        <div className="text-xl font-bold text-slate-900 mt-1">{licenses.length}</div>
      </CardHeader>
      <CardContent className="p-3 bg-white/60 backdrop-blur-sm">
        {licenses.length > 0 ? (
          <div className="space-y-1.5">
            {licenses.slice(0, 3).map(license => {
              const provider = providers.find(p => p.id === license.provider_id);
              const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
              return (
                <div key={license.id} className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all duration-200 ${itemColors[severity]}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-xs truncate">{provider?.full_name}</p>
                    <p className="text-[10px] text-slate-700 font-medium">
                      {license.license_type}
                    </p>
                  </div>
                  <Badge className={`text-[10px] ml-2 font-bold ${
                    daysUntil <= 7 ? 'bg-red-600 text-white border-0' : 
                    daysUntil <= 14 ? 'bg-orange-600 text-white border-0' : 
                    daysUntil <= 30 ? 'bg-yellow-600 text-white border-0' :
                    'bg-blue-600 text-white border-0'
                  }`}>
                    {daysUntil}d
                  </Badge>
                </div>
              );
            })}
            {licenses.length > 3 && (
              <Link to={createPageUrl("Licenses")} className="block text-[10px] text-blue-600 hover:text-blue-800 font-semibold text-center pt-1 hover:underline">
                View all {licenses.length} →
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-green-700 font-medium">None expiring</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}