
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Added useQueryClient
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, Award, FileText, GraduationCap, DollarSign, CheckCircle2, Clock, Building2, RefreshCw, Wallet, Download } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FinancialDetailModal from "../components/dashboard/FinancialDetailModal";

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    invoices: [],
    type: '',
    programGroup: null
  });

  const queryClient = useQueryClient(); // Initialized useQueryClient

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list()
  });

  const { data: privileges = [] } = useQuery({
    queryKey: ['privileges'],
    queryFn: () => base44.entities.ClinicalPrivilege.list()
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: cmeRecords = [] } = useQuery({
    queryKey: ['cme'],
    queryFn: () => base44.entities.CME.list()
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list()
  });

  const handleSyncPaymentsAndInvoices = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await base44.functions.invoke('syncPaymentsAndInvoices', {});
      setSyncMessage(response.data.message);
      // Refresh data after sync
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      setSyncMessage('Error syncing: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

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
        (inv.status === 'paid_to_entic' || inv.status === 'provider_paid') && !inv.provider_paid
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Owed to Providers - ${programGroup}`;
      } else {
        title = 'Total Owed to Providers';
      }
    } else if (type === 'outstanding') {
      filteredInvoices = invoices.filter(inv => 
        inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid'
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

  // Export functions
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
      ['Pending Invoices', pendingInvoices, ''],
      ['Overdue Invoices (30+ days)', overdueInvoices, ''],
      ['Paid Invoices', invoices.filter(inv => inv.status === 'paid_to_entic' || inv.status === 'provider_paid').length, ''],
      ['', '', ''],
      ['Invoice Number', 'Program Group', 'Provider', 'Date', 'Status', 'Total', 'Amount Received']
    ];
    
    invoices.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      rows.push([
        inv.invoice_number || '',
        inv.program_group || '',
        provider?.full_name || '',
        format(parseISO(inv.invoice_date), 'yyyy-MM-dd'),
        inv.status,
        inv.total || 0,
        inv.amount_received || 0
      ]);
    });
    
    exportToCSV(rows, 'invoice_summary');
  };

  // Provider counts
  const activeProviders = providers.filter(p => p.status === 'active').length;

  // License expiration tracking
  const today = new Date();
  const licensesExpiring60Days = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 60;
  });
  const licensesExpiring30Days = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 30;
  });
  const licensesExpiring14Days = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 14;
  });
  const licensesExpiring7Days = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 7;
  });

  // Privilege expiration tracking
  const privilegesExpiring30Days = privileges.filter(p => {
    const days = differenceInDays(parseISO(p.expiration_date), today);
    return days > 0 && days <= 30;
  });

  // Financial metrics - Total
  // Calculate total allocated payments (money actually received and allocated to invoices)
  const totalAllocatedToInvoices = payments.reduce((sum, payment) => {
    const allocatedAmount = payment.allocations?.reduce((allocSum, allocation) => {
      // Only count allocations that are actually assigned to an invoice
      if (allocation.invoice_id) {
        return allocSum + (allocation.amount || 0);
      }
      return allocSum;
    }, 0) || 0;
    return sum + allocatedAmount;
  }, 0);

  // This is the actual "Total Paid to ENTIC" - money received and allocated
  const totalPaidToENTIC = totalAllocatedToInvoices;

  const totalOwedToProviders = invoices
    .filter(inv => (inv.amount_received > 0) && !inv.provider_paid)
    .reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const outstandingToENTIC = invoices
    .reduce((sum, inv) => {
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + (outstanding > 0 ? outstanding : 0);
    }, 0);

  // Calculate unallocated payments - use the unallocated_amount field from each payment
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
    
    // Paid to ENTIC
    // Using amount_received from invoice for program breakdown, as totalPaidToENTIC is calculated from payments now.
    // For consistency with how the modal details work based on invoice status.
    if (inv.status === 'paid_to_entic' || inv.status === 'provider_paid') {
      financialsByProgram[program].paidToENTIC += (inv.amount_received || 0);
      
      // Owed to Providers (received but not paid to provider yet)
      if (!inv.provider_paid) {
        financialsByProgram[program].owedToProviders += (inv.amount_received || 0);
      }
    } else {
      // Outstanding to ENTIC
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      financialsByProgram[program].outstanding += outstanding > 0 ? outstanding : 0; // Only sum positive outstanding
    }
  });

  // Sort programs by name
  const programsSorted = Object.keys(financialsByProgram).sort();

  // Invoice tracking
  const pendingInvoices = invoices.filter(inv => 
    inv.status === 'pending_providers_approval' || 
    inv.status === 'pending_providers_time' ||
    inv.status === 'sent_for_approval'
  ).length;

  const overdueInvoices = invoices.filter(inv => {
    if (!inv.sent_to_vendor_at) return false;
    const daysSinceSent = differenceInDays(today, parseISO(inv.sent_to_vendor_at));
    return daysSinceSent > 30 && inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid';
  }).length;

  // CME compliance for doctors - Filter by ENT MD role
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

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">Overview of your medical practice</p>
          </div>
          <Button 
            onClick={handleSyncPaymentsAndInvoices} // Changed function
            disabled={syncing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Payments & Invoices'} {/* Changed text */}
          </Button>
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
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Providers</CardTitle>
              <Users className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{activeProviders}</div>
              <Link to={createPageUrl("Providers")} className="text-xs text-blue-600 hover:underline">
                View all providers →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Licenses Expiring (60d)</CardTitle>
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{licensesExpiring60Days.length}</div>
              <Link to={createPageUrl("Licenses")} className="text-xs text-blue-600 hover:underline">
                View licenses →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Privileges Expiring (30d)</CardTitle>
              <Award className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{privilegesExpiring30Days.length}</div>
              <Link to={createPageUrl("ClinicalPrivileges")} className="text-xs text-blue-600 hover:underline">
                View privileges →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending Invoices</CardTitle>
              <FileText className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{pendingInvoices}</div>
              <Link to={createPageUrl("Invoices")} className="text-xs text-blue-600 hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        </div>

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

        {/* License Expirations Detail */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">License Expirations</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* CME Compliance - Only Non-Compliant Doctors */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CME Non-Compliance - Doctors Requiring Attention</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Doctors must earn 3+ CME credits</p>
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
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="text-2xl font-bold text-slate-900">
                {doctorsCompliant} / {doctors.length}
              </div>
              <p className="text-sm text-slate-600">Doctors compliant</p>
            </div>
            {doctorsNonCompliant.length > 0 ? (
              <div className="space-y-3">
                {doctorsNonCompliant.map(doctor => {
                  const credits = cmeByProvider[doctor.id] || 0;
                  return (
                    <div key={doctor.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{doctor.full_name}</p>
                        <p className="text-sm text-slate-600">{credits} CME credits</p>
                      </div>
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        Non-compliant
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p className="text-green-700 font-medium">All doctors are CME compliant!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Summary */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle>Invoice Summary</CardTitle>
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
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-700">{pendingInvoices}</div>
                <p className="text-sm text-slate-600 mt-1">Pending Invoices</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-700">{overdueInvoices}</div>
                <p className="text-sm text-slate-600 mt-1">Overdue (30+ days)</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-700">
                  {invoices.filter(inv => inv.status === 'paid_to_entic' || inv.status === 'provider_paid').length}
                </div>
                <p className="text-sm text-slate-600 mt-1">Paid Invoices</p>
              </div>
            </div>
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
    high: 'border-red-200 bg-red-50',
    medium: 'border-orange-200 bg-orange-50',
    low: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50'
  };

  return (
    <Card className={`border shadow-sm ${severityColors[severity]}`}>
      <CardHeader className="border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${
            severity === 'high' ? 'text-red-600' : 
            severity === 'medium' ? 'text-orange-600' : 
            severity === 'low' ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 bg-white">
        {licenses.length > 0 ? (
          <div className="space-y-2">
            {licenses.slice(0, 3).map(license => {
              const provider = providers.find(p => p.id === license.provider_id);
              const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
              return (
                <div key={license.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{provider?.full_name}</p>
                    <p className="text-xs text-slate-600">
                      {license.license_type}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-xs ml-2 ${
                    daysUntil <= 7 ? 'border-red-300 text-red-700' : 
                    daysUntil <= 14 ? 'border-orange-300 text-orange-700' : 
                    daysUntil <= 30 ? 'border-yellow-300 text-yellow-700' :
                    'border-blue-300 text-blue-700'
                  }`}>
                    {daysUntil}d
                  </Badge>
                </div>
              );
            })}
            {licenses.length > 3 && (
              <p className="text-xs text-slate-500 text-center pt-1">
                +{licenses.length - 3} more
              </p>
            )}
          </div>
        ) : (
          <p className="text-center py-4 text-slate-500 text-sm">None expiring</p>
        )}
      </CardContent>
    </Card>
  );
}
