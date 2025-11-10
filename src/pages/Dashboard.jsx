import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, FileText, CheckCircle2, Clock, DollarSign, GraduationCap, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays, format, parseISO } from "date-fns";

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

  const activeProviders = providers.filter(p => p.status === 'active').length;
  
  const expiringLicenses = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;

  const expiringPrivileges = privileges.filter(p => {
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;

  const pendingInvoices = invoices.filter(i => 
    i.status === 'draft' || 
    i.status === 'pending_providers_approval' || 
    i.status === 'sent_for_approval'
  ).length;

  const overdueInvoices = invoices.filter(i => {
    if (!i.invoice_date) return false;
    const days = differenceInDays(new Date(), parseISO(i.invoice_date));
    return days > 30 && i.status !== 'paid_to_entic' && i.status !== 'provider_paid';
  }).length;

  // Calculate CME compliance for doctors
  const doctors = providers.filter(p => 
    p.full_name?.toLowerCase().startsWith('dr.') || 
    p.full_name?.toLowerCase().includes('dr ')
  );

  const cmeComplianceByProvider = doctors.map(doctor => {
    const doctorCME = cmeRecords.filter(c => c.provider_id === doctor.id);
    const totalCredits = doctorCME.reduce((sum, cme) => sum + (cme.credits || 0), 0);
    return {
      provider: doctor,
      totalCredits,
      isCompliant: totalCredits >= 3
    };
  });

  const compliantDoctors = cmeComplianceByProvider.filter(d => d.isCompliant).length;
  const nonCompliantDoctors = cmeComplianceByProvider.filter(d => !d.isCompliant).length;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of your medical practice</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to={createPageUrl("Providers")}>
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Active Providers</CardTitle>
                <Users className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{activeProviders}</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Licenses")}>
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Expiring Licenses</CardTitle>
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">{expiringLicenses}</p>
                <p className="text-xs text-slate-500 mt-1">Within 30 days</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("ClinicalPrivileges")}>
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Expiring Privileges</CardTitle>
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">{expiringPrivileges}</p>
                <p className="text-xs text-slate-500 mt-1">Within 30 days</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl("Invoices")}>
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Pending Invoices</CardTitle>
                <FileText className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{pendingInvoices}</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <CardTitle>CME Compliance (Doctors)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-green-900">Compliant</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{compliantDoctors}</p>
                  <p className="text-xs text-green-700 mt-1">≥3 credits</p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <p className="text-sm font-medium text-red-900">Non-Compliant</p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{nonCompliantDoctors}</p>
                  <p className="text-xs text-red-700 mt-1">&lt;3 credits</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700 mb-3">Doctor Details:</p>
                {cmeComplianceByProvider.map(({ provider, totalCredits, isCompliant }) => (
                  <Link key={provider.id} to={createPageUrl(`ProviderDetail?id=${provider.id}`)}>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        {isCompliant ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <p className="font-medium text-slate-900">{provider.full_name}</p>
                      </div>
                      <Badge variant={isCompliant ? "default" : "destructive"}>
                        {totalCredits.toFixed(1)} credits
                      </Badge>
                    </div>
                  </Link>
                ))}
                {cmeComplianceByProvider.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No doctors found</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Upcoming License Expirations</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {licenses
                  .filter(l => {
                    const days = differenceInDays(parseISO(l.expiration_date), new Date());
                    return days > 0 && days <= 30;
                  })
                  .sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date))
                  .slice(0, 5)
                  .map(license => {
                    const provider = providers.find(p => p.id === license.provider_id);
                    const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
                    
                    return (
                      <div key={license.id} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div>
                          <p className="font-medium text-slate-900">{provider?.full_name}</p>
                          <p className="text-sm text-slate-600">{license.license_type} - {license.internal_license_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600">{daysUntil} days</p>
                          <p className="text-xs text-slate-500">{format(parseISO(license.expiration_date), 'MMM d')}</p>
                        </div>
                      </div>
                    );
                  })}
                {licenses.filter(l => {
                  const days = differenceInDays(parseISO(l.expiration_date), new Date());
                  return days > 0 && days <= 30;
                }).length === 0 && (
                  <p className="text-center text-slate-500 py-8">No licenses expiring soon</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-900">Pending</p>
                </div>
                <p className="text-3xl font-bold text-yellow-600">{pendingInvoices}</p>
              </div>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-medium text-red-900">Overdue</p>
                </div>
                <p className="text-3xl font-bold text-red-600">{overdueInvoices}</p>
                <p className="text-xs text-red-700 mt-1">&gt;30 days old</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">Total</p>
                </div>
                <p className="text-3xl font-bold text-blue-600">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}