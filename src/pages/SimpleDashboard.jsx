import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Award, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SimpleDashboard() {
  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: licenses = [], isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list()
  });

  const { data: privileges = [], isLoading: privilegesLoading } = useQuery({
    queryKey: ['privileges'],
    queryFn: () => base44.entities.ClinicalPrivilege.list()
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  if (providersLoading || licensesLoading || privilegesLoading || invoicesLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="text-center py-12 text-slate-500">Loading...</div>
      </div>
    );
  }

  const activeProviders = providers.filter(p => p.status === 'active').length;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Simple Dashboard Test</h1>
          <p className="text-slate-600 mt-1">Testing minimal version on iPad</p>
        </div>

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
              <CardTitle className="text-sm font-medium text-slate-600">Total Licenses</CardTitle>
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{licenses.length}</div>
              <Link to={createPageUrl("Licenses")} className="text-xs text-blue-600 hover:underline">
                View licenses →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Privileges</CardTitle>
              <Award className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{privileges.length}</div>
              <Link to={createPageUrl("ClinicalPrivileges")} className="text-xs text-blue-600 hover:underline">
                View privileges →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Invoices</CardTitle>
              <FileText className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{invoices.length}</div>
              <Link to={createPageUrl("Invoices")} className="text-xs text-blue-600 hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <p className="text-sm text-blue-900">
              This is a simplified dashboard to test if the issue is with the Dashboard code complexity or something else.
              If this loads fine on iPad, we know it's the Dashboard code. If this also fails, it's a deeper auth/session issue.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}