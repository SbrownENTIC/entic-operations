import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Award, GraduationCap, AlertTriangle, DollarSign, FileText, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
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

  const activeProviders = providers.filter(p => p.status === 'active').length;
  const expiringLicenses = licenses.filter(l => {
    const days = differenceInDays(parseISO(l.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;

  const expiringPrivileges = privileges.filter(p => {
    const days = differenceInDays(parseISO(p.expiration_date), new Date());
    return days > 0 && days <= 30;
  }).length;

  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'partial').length;
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;

  const stats = [
    {
      title: "Active Providers",
      value: activeProviders,
      icon: Users,
      bgColor: "bg-blue-500",
      link: createPageUrl("Providers")
    },
    {
      title: "Expiring Licenses",
      value: expiringLicenses,
      icon: AlertTriangle,
      bgColor: "bg-orange-500",
      link: createPageUrl("Licenses")
    },
    {
      title: "Expiring Privileges",
      value: expiringPrivileges,
      icon: Award,
      bgColor: "bg-purple-500",
      link: createPageUrl("ClinicalPrivileges")
    },
    {
      title: "Pending Invoices",
      value: pendingInvoices,
      icon: FileText,
      bgColor: "bg-green-500",
      link: createPageUrl("Invoices")
    }
  ];

  const upcomingExpirations = licenses
    .map(license => {
      const provider = providers.find(p => p.id === license.provider_id);
      const daysUntil = differenceInDays(parseISO(license.expiration_date), new Date());
      return { ...license, provider, daysUntil };
    })
    .filter(l => l.daysUntil > 0 && l.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome to your medical practice management system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Link key={stat.title} to={stat.link}>
              <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300 border-slate-200 cursor-pointer group">
                <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 ${stat.bgColor} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`} />
                <CardHeader className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                      <CardTitle className="text-3xl font-bold mt-2 text-slate-900">
                        {stat.value}
                      </CardTitle>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor} bg-opacity-10`}>
                      <stat.icon className={`w-6 h-6 ${stat.bgColor.replace('bg-', 'text-')}`} />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Upcoming License Expirations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {upcomingExpirations.length > 0 ? (
                <div className="space-y-4">
                  {upcomingExpirations.map((license) => (
                    <div key={license.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-medium text-slate-900">{license.provider?.full_name}</p>
                        <p className="text-sm text-slate-600">{license.license_type}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={license.daysUntil <= 7 ? "destructive" : "outline"}>
                          {license.daysUntil} days
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(parseISO(license.expiration_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No licenses expiring in the next 30 days</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="w-5 h-5 text-green-500" />
                Invoice Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">Pending Invoices</p>
                      <p className="text-sm text-slate-600">Awaiting payment</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-green-600">{pendingInvoices}</span>
                </div>

                {overdueInvoices > 0 && (
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="font-medium text-slate-900">Overdue Invoices</p>
                        <p className="text-sm text-slate-600">Require attention</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-red-600">{overdueInvoices}</span>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-slate-900">Total Invoices</p>
                      <p className="text-sm text-slate-600">All time</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{invoices.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}