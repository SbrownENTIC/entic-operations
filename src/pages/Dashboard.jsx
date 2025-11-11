
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, Award, FileText, GraduationCap, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Dashboard() {
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

  // Financial metrics
  const totalPaidToENTIC = invoices
    .filter(inv => inv.status === 'paid_to_entic' || inv.status === 'provider_paid')
    .reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const totalOwedToProviders = invoices
    .filter(inv => (inv.status === 'paid_to_entic' || inv.status === 'provider_paid') && !inv.provider_paid)
    .reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const outstandingToENTIC = invoices
    .filter(inv => inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid')
    .reduce((sum, inv) => sum + ((inv.amount_expected || inv.total || 0) - (inv.amount_received || 0)), 0);

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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of your medical practice</p>
        </div>

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

        {/* Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Paid to ENTIC</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">{formatCurrency(totalPaidToENTIC)}</div>
              <p className="text-xs text-slate-500 mt-1">Payments received from clients</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Owed to Providers</CardTitle>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{formatCurrency(totalOwedToProviders)}</div>
              <p className="text-xs text-slate-500 mt-1">Received but not yet paid out</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Outstanding to ENTIC</CardTitle>
              <Clock className="w-5 h-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700">{formatCurrency(outstandingToENTIC)}</div>
              <p className="text-xs text-slate-500 mt-1">Awaiting payment from clients</p>
            </CardContent>
          </Card>
        </div>

        {/* License Expirations Detail */}
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

        {/* CME Compliance - Only Non-Compliant Doctors */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CME Non-Compliance - Doctors Requiring Attention</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Doctors must earn 3+ CME credits</p>
              </div>
              <GraduationCap className="w-6 h-6 text-slate-400" />
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
            <CardTitle>Invoice Summary</CardTitle>
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
