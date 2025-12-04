import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AlertsWidget({ 
  uconnPendingVendorInvoices, 
  sentForApprovalInvoices, 
  privilegesExpiring30Days 
}) {
  if (!(uconnPendingVendorInvoices > 0 || sentForApprovalInvoices > 0 || privilegesExpiring30Days.length > 0)) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {uconnPendingVendorInvoices > 0 && (
          <Card className={`bg-gradient-to-br from-blue-100 to-blue-50 transition-all duration-300 ${uconnPendingVendorInvoices > 0 ? 'border-[5px] border-blue-600 animate-alert-glow' : 'border-3 border-blue-300 shadow-xl shadow-blue-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-blue-300">
              <CardTitle className="text-sm font-bold text-slate-900">UConn Pending Vendor</CardTitle>
              <AlertCircle className="w-5 h-5 text-blue-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-blue-700 mb-1">{uconnPendingVendorInvoices}</div>
              <Link to={`${createPageUrl("Invoices")}?status=approved`} className="text-xs text-blue-700 hover:text-blue-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {sentForApprovalInvoices > 0 && (
          <Card className={`bg-gradient-to-br from-yellow-100 to-yellow-50 transition-all duration-300 ${sentForApprovalInvoices > 0 ? 'border-[5px] border-yellow-600 animate-yellow-glow' : 'border-3 border-yellow-300 shadow-xl shadow-yellow-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-yellow-300">
              <CardTitle className="text-sm font-bold text-slate-900">Invoices Sent for Approval</CardTitle>
              <FileText className="w-5 h-5 text-yellow-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-yellow-700 mb-1">{sentForApprovalInvoices}</div>
              <Link to={`${createPageUrl("Invoices")}?status=sent_for_approval`} className="text-xs text-yellow-700 hover:text-yellow-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {privilegesExpiring30Days.length > 0 && (
          <Card className="border-3 border-purple-500 bg-gradient-to-br from-purple-100 to-purple-50 shadow-xl shadow-purple-200/50 hover:scale-105 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-purple-300">
              <CardTitle className="text-sm font-bold text-slate-900">Privileges Expiring (30d)</CardTitle>
              <Award className="w-5 h-5 text-purple-700 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-purple-700 mb-1">{privilegesExpiring30Days.length}</div>
              <Link to={`${createPageUrl("ClinicalPrivileges")}?filter=expiring_30`} className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline">
                View privileges →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}