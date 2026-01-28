import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { differenceInDays, parseISO, startOfDay } from "date-fns";

function LicenseExpirationCard({ title, licenses, providers, severity, filterType }) {
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
          <AlertCircle className={iconClasses[severity]} />
          <CardTitle className="text-xs font-bold text-slate-900">{title}</CardTitle>
        </div>
        <div className="text-xl font-bold text-slate-900 mt-1">{licenses.length}</div>
      </CardHeader>
      <CardContent className="p-3 bg-white/60 backdrop-blur-sm">
        {licenses.length > 0 ? (
          <div className="space-y-1.5">
            <div className="max-h-[200px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {licenses.map(license => {
                const provider = providers.find(p => p.id === license.provider_id);
                const daysUntil = differenceInDays(parseISO(license.expiration_date), startOfDay(new Date()));
                return (
                  <Link 
                    key={license.id} 
                    to={`${createPageUrl("Licenses")}?edit=${license.id}`}
                    className="block"
                  >
                    <div className={`flex items-center justify-between p-2 rounded-lg border-2 transition-all duration-200 ${itemColors[severity]} hover:scale-[1.02] cursor-pointer`}>
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
                  </Link>
                );
              })}
            </div>
            <Link 
              to={`${createPageUrl("Licenses")}?filter=${filterType}`}
              className="block text-[10px] text-blue-600 hover:text-blue-800 font-semibold text-center pt-1 hover:underline sticky bottom-0 bg-white/80 backdrop-blur-sm"
            >
              View all {licenses.length} on page →
            </Link>
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

export default function LicenseExpirationsWidget({ 
  licensesExpiring7Days, 
  licensesExpiring14Days, 
  licensesExpiring30Days, 
  licensesExpiring60Days, 
  providers, 
  exportLicenseExpirations 
}) {
  return (
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
          filterType="expiring_7"
        />
        <LicenseExpirationCard
          title="Expiring in 14 Days"
          licenses={licensesExpiring14Days}
          providers={providers}
          severity="medium"
          filterType="expiring_14"
        />
        <LicenseExpirationCard
          title="Expiring in 30 Days"
          licenses={licensesExpiring30Days}
          providers={providers}
          severity="low"
          filterType="expiring_30"
        />
        <LicenseExpirationCard
          title="Expiring in 60 Days"
          licenses={licensesExpiring60Days}
          providers={providers}
          severity="info"
          filterType="expiring_60"
        />
      </div>
    </div>
  );
}