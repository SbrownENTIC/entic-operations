import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Phone, Calendar, Award, GraduationCap, ShieldCheck, Syringe } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO, differenceInDays } from "date-fns";

export default function ProviderDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const providerId = urlParams.get('id');

  const { data: provider, isLoading } = useQuery({
    queryKey: ['provider', providerId],
    queryFn: async () => {
      const providers = await base44.entities.Provider.list();
      return providers.find(p => p.id === providerId);
    }
  });

  const { data: privileges = [] } = useQuery({
    queryKey: ['privileges', providerId],
    queryFn: async () => {
      const all = await base44.entities.ClinicalPrivilege.list();
      return all.filter(p => p.provider_id === providerId);
    }
  });

  const { data: cmes = [] } = useQuery({
    queryKey: ['cmes', providerId],
    queryFn: async () => {
      const all = await base44.entities.CME.list('-completion_date');
      return all.filter(c => c.provider_id === providerId);
    }
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses', providerId],
    queryFn: async () => {
      const all = await base44.entities.License.list();
      return all.filter(l => l.provider_id === providerId);
    }
  });

  if (isLoading || !provider) {
    return <div className="p-8">Loading...</div>;
  }

  const totalCMECredits = cmes.reduce((sum, cme) => sum + (cme.credits || 0), 0);

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{provider.full_name}</h1>
            <p className="text-slate-600">{provider.specialty || 'Medical Provider'}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg">Provider Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Status</p>
                <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                  {provider.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-sm">{provider.email}</span>
              </div>

              {provider.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">{provider.phone}</span>
                </div>
              )}

              {provider.hire_date && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">Hired {format(parseISO(provider.hire_date), 'MMM d, yyyy')}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Syringe className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Flu Vaccine</p>
                </div>
                {provider.flu_vaccine_year === new Date().getFullYear() ? (
                  <Badge className="bg-green-100 text-green-800">
                    ✓ Up to date ({provider.flu_vaccine_year})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    Update needed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Licenses
                </CardTitle>
                <Link to={createPageUrl(`Licenses?provider=${providerId}`)}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {licenses.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {licenses.map(license => {
                    const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
                    const isExpiringSoon = daysUntil > 0 && daysUntil <= 30;
                    const isExpired = daysUntil <= 0;

                    return (
                      <div key={license.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-slate-900">{license.license_type}</p>
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? `${daysUntil}d` : 'Active'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">
                          Generic #: {license.generic_license_number}
                        </p>
                        <p className="text-xs text-slate-600">
                          Expires: {format(parseISO(license.expiration_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No licenses recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  Clinical Privileges
                </CardTitle>
                <Link to={createPageUrl(`ClinicalPrivileges?provider=${providerId}`)}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {privileges.length > 0 ? (
                <div className="space-y-3">
                  {privileges.slice(0, 5).map(priv => (
                    <div key={priv.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-900">{priv.facility_name}</p>
                          <p className="text-sm text-slate-600">{priv.privilege_type}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {format(parseISO(priv.expiration_date), 'MMM yyyy')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No privileges recorded</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-green-600" />
                  CME Credits
                </CardTitle>
                <Link to={createPageUrl(`CMETracking?provider=${providerId}`)}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-slate-600 mb-1">Total CME Credits</p>
                <p className="text-3xl font-bold text-green-600">{totalCMECredits}</p>
              </div>
              {cmes.length > 0 ? (
                <div className="space-y-3">
                  {cmes.slice(0, 4).map(cme => (
                    <div key={cme.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 text-sm">{cme.course_name}</p>
                          <p className="text-xs text-slate-500">
                            {format(parseISO(cme.completion_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge variant="secondary">{cme.credits} credits</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No CME credits recorded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}