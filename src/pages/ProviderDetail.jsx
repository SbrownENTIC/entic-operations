import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Award, GraduationCap, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays, format, parseISO } from "date-fns";

export default function ProviderDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const providerId = urlParams.get('id');

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['provider', providerId],
    queryFn: async () => {
      const providers = await base44.entities.Provider.list();
      return providers.find(p => p.id === providerId);
    }
  });

  const { data: privileges = [] } = useQuery({
    queryKey: ['privileges', providerId],
    queryFn: async () => {
      const allPrivileges = await base44.entities.ClinicalPrivilege.list();
      return allPrivileges.filter(p => p.provider_id === providerId);
    }
  });

  const { data: cmeRecords = [] } = useQuery({
    queryKey: ['cme', providerId],
    queryFn: async () => {
      const allCME = await base44.entities.CME.list();
      return allCME.filter(c => c.provider_id === providerId);
    }
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses', providerId],
    queryFn: async () => {
      const allLicenses = await base44.entities.License.list();
      return allLicenses.filter(l => l.provider_id === providerId);
    }
  });

  if (providerLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <p className="text-slate-600">Provider not found</p>
      </div>
    );
  }

  const totalCMECredits = cmeRecords.reduce((sum, cme) => sum + (cme.credits || 0), 0);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  
  // Determine current flu season year range
  let currentFluSeason;
  if (currentMonth >= 6) { // July onwards (month 6+)
    currentFluSeason = `${currentYear}-${currentYear + 1}`;
  } else {
    currentFluSeason = `${currentYear - 1}-${currentYear}`;
  }
  
  const fluVaccineCurrent = provider.flu_vaccine_year === currentFluSeason;
  const isDoctor = provider.full_name?.toLowerCase().startsWith('dr.') || provider.full_name?.toLowerCase().includes('dr ');
  const cmeCompliant = totalCMECredits >= 3;

  // Capitalize first letter of status
  const capitalizedStatus = provider.status ? provider.status.charAt(0).toUpperCase() + provider.status.slice(1) : '';

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Providers")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{provider.full_name}</h1>
            <p className="text-slate-600 mt-1">{provider.role || 'Provider'}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="text-slate-900">{provider.email}</p>
                </div>
              </div>
              {provider.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="text-slate-900">{provider.phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-2">Employment Status</p>
                <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                  {capitalizedStatus}
                </Badge>
              </div>
              {provider.role === 'ENT DM' && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Flu Vaccine ({currentFluSeason})</p>
                  <div className="flex items-center gap-2">
                    {fluVaccineCurrent && provider.flu_vaccine_date ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{provider.flu_vaccine_date}</span>
                          <span className="text-xs text-slate-500">{provider.flu_vaccine_year}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-slate-500">Not current</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isDoctor && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">CME Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-2">Total CME Credits</p>
                  <p className="text-3xl font-bold text-blue-600">{totalCMECredits.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-2">Compliance Status</p>
                  <div className="flex items-center gap-2">
                    {cmeCompliant ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <Badge className="bg-green-600">Compliant (≥3 credits)</Badge>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-600" />
                        <Badge variant="destructive">Non-Compliant (&lt;3 credits)</Badge>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <CardTitle>Licenses ({licenses.length})</CardTitle>
              </div>
              <Link to={createPageUrl("Licenses")}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Type</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Internal #</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Expiration</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => {
                    const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
                    const isExpired = daysUntil <= 0;
                    const isExpiringSoon = daysUntil > 0 && daysUntil <= 30;

                    return (
                      <tr key={license.id} className="border-b border-slate-100">
                        <td className="p-4">
                          <Badge variant="outline" className="font-mono">{license.license_type}</Badge>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-sm">{license.internal_license_number}</td>
                        <td className="p-4 text-slate-600">{format(parseISO(license.expiration_date), 'MMM d, yyyy')}</td>
                        <td className="p-4">
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? `${daysUntil}d` : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {licenses.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No licenses found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                <CardTitle>Clinical Privileges ({privileges.length})</CardTitle>
              </div>
              <Link to={createPageUrl("ClinicalPrivileges")}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Facility</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Granted</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Expires</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {privileges.map((priv) => {
                    const daysUntil = differenceInDays(parseISO(priv.expiration_date), new Date());
                    const isExpired = daysUntil <= 0;
                    const isExpiringSoon = daysUntil > 0 && daysUntil <= 30;

                    return (
                      <tr key={priv.id} className="border-b border-slate-100">
                        <td className="p-4 text-slate-900">{priv.facility_name}</td>
                        <td className="p-4 text-slate-600">{format(parseISO(priv.granted_date), 'MMM d, yyyy')}</td>
                        <td className="p-4 text-slate-600">{format(parseISO(priv.expiration_date), 'MMM d, yyyy')}</td>
                        <td className="p-4">
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? `${daysUntil}d` : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {privileges.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No privileges found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <CardTitle>CME Credits ({cmeRecords.length} courses)</CardTitle>
              </div>
              <Link to={createPageUrl("CMETracking")}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="text-sm text-slate-500">Total Credits Earned</p>
              <p className="text-3xl font-bold text-blue-600">{totalCMECredits.toFixed(1)} credits</p>
            </div>
            <div className="space-y-3">
              {cmeRecords.slice(0, 5).map((cme) => (
                <div key={cme.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{cme.course_name}</p>
                    <p className="text-sm text-slate-500">{format(parseISO(cme.completion_date), 'MMM d, yyyy')}</p>
                  </div>
                  <Badge variant="outline">{cme.credits} credits</Badge>
                </div>
              ))}
            </div>
            {cmeRecords.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No CME records found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}