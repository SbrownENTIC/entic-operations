import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import { Clock, Send, UserCheck, PackageOpen } from "lucide-react";

export default function AlertsWidget({ 
  approvedInvoicesCount,
  uconnPendingVendorInvoices, 
  sentForApprovalInvoices, 
  sentToCOOInvoices,
  pendingProviderApprovalCount,
  pendingProviderTimeCount,
  privilegesExpiring30Days,
  partiallyReceivedCount,
  updatedOrdersCount
}) {
  const hasAlerts = approvedInvoicesCount > 0 ||
                    uconnPendingVendorInvoices > 0 || 
                    sentForApprovalInvoices > 0 || 
                    sentToCOOInvoices > 0 ||
                    pendingProviderApprovalCount > 0 || 
                    pendingProviderTimeCount > 0 || 
                    privilegesExpiring30Days.length > 0 ||
                    partiallyReceivedCount > 0 ||
                    updatedOrdersCount > 0;

  if (!hasAlerts) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-3">Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {approvedInvoicesCount > 0 && (
          <Card className={`bg-gradient-to-br from-green-100 to-green-50 transition-all duration-300 ${approvedInvoicesCount > 0 ? 'border-[5px] border-green-600 animate-alert-glow' : 'border-3 border-green-300 shadow-xl shadow-green-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-green-300">
              <CardTitle className="text-sm font-bold text-slate-900">Invoices to Send to Vendor</CardTitle>
              <Send className="w-5 h-5 text-green-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-green-700 mb-1">{approvedInvoicesCount}</div>
              <Link to={`${createPageUrl("Invoices")}?status=approved`} className="text-xs text-green-700 hover:text-green-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {uconnPendingVendorInvoices > 0 && (
          <Card className={`bg-gradient-to-br from-blue-100 to-blue-50 transition-all duration-300 ${uconnPendingVendorInvoices > 0 ? 'border-[5px] border-blue-600 animate-alert-glow' : 'border-3 border-blue-300 shadow-xl shadow-blue-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-blue-300">
              <CardTitle className="text-sm font-bold text-slate-900">UConn Pending Vendor</CardTitle>
              <AlertCircle className="w-5 h-5 text-blue-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-blue-700 mb-1">{uconnPendingVendorInvoices}</div>
              <Link to={`${createPageUrl("Invoices")}?status=approved&search=UConn`} className="text-xs text-blue-700 hover:text-blue-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {sentForApprovalInvoices > 0 && (
          <Card className={`bg-gradient-to-br from-yellow-100 to-yellow-50 transition-all duration-300 ${sentForApprovalInvoices > 0 ? 'border-[5px] border-yellow-600 animate-yellow-glow' : 'border-3 border-yellow-300 shadow-xl shadow-yellow-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-yellow-300">
              <CardTitle className="text-sm font-bold text-slate-900">Sent to Vendor for Approval</CardTitle>
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

        {sentToCOOInvoices > 0 && (
          <Card className={`bg-gradient-to-br from-fuchsia-100 to-fuchsia-50 transition-all duration-300 ${sentToCOOInvoices > 0 ? 'border-[5px] border-fuchsia-600 animate-alert-glow' : 'border-3 border-fuchsia-300 shadow-xl shadow-fuchsia-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-fuchsia-300">
              <CardTitle className="text-sm font-bold text-slate-900">Sent to COO for Approval</CardTitle>
              <FileText className="w-5 h-5 text-fuchsia-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-fuchsia-700 mb-1">{sentToCOOInvoices}</div>
              <Link to={`${createPageUrl("Invoices")}?status=sent_to_coo_for_approval`} className="text-xs text-fuchsia-700 hover:text-fuchsia-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {pendingProviderApprovalCount > 0 && (
          <Card className={`bg-gradient-to-br from-amber-100 to-amber-50 transition-all duration-300 ${pendingProviderApprovalCount > 0 ? 'border-[5px] border-amber-600 animate-yellow-glow' : 'border-3 border-amber-300 shadow-xl shadow-amber-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-amber-300">
              <CardTitle className="text-sm font-bold text-slate-900">Pending Provider Approval</CardTitle>
              <UserCheck className="w-5 h-5 text-amber-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-amber-700 mb-1">{pendingProviderApprovalCount}</div>
              <Link to={`${createPageUrl("Invoices")}?status=pending_providers_approval`} className="text-xs text-amber-700 hover:text-amber-900 font-semibold hover:underline">
                View invoices →
              </Link>
            </CardContent>
          </Card>
        )}

        {pendingProviderTimeCount > 0 && (
          <Card className={`bg-gradient-to-br from-indigo-100 to-indigo-50 transition-all duration-300 ${pendingProviderTimeCount > 0 ? 'border-[5px] border-indigo-600 animate-alert-glow' : 'border-3 border-indigo-300 shadow-xl shadow-indigo-200/50 hover:scale-105'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-indigo-300">
              <CardTitle className="text-sm font-bold text-slate-900">Pending Provider Time</CardTitle>
              <Clock className="w-5 h-5 text-indigo-700 animate-slow-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-indigo-700 mb-1">{pendingProviderTimeCount}</div>
              <Link to={`${createPageUrl("Invoices")}?status=pending_providers_time`} className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold hover:underline">
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

        {partiallyReceivedCount > 0 && (
          <Card className="border-3 border-orange-500 bg-gradient-to-br from-orange-100 to-orange-50 shadow-xl shadow-orange-200/50 hover:scale-105 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-orange-300">
              <CardTitle className="text-sm font-bold text-slate-900">Partially Received Orders</CardTitle>
              <PackageOpen className="w-5 h-5 text-orange-700 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-orange-700 mb-1">{partiallyReceivedCount}</div>
              <Link to={`${createPageUrl("OfficeSupplyOrders")}?status=partially_received`} className="text-xs text-orange-700 hover:text-orange-900 font-semibold hover:underline">
                View orders →
              </Link>
            </CardContent>
          </Card>
        )}

        {updatedOrdersCount > 0 && (
          <Card className="border-3 border-red-500 bg-gradient-to-br from-red-100 to-red-50 shadow-xl shadow-red-200/50 hover:scale-105 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-red-300">
              <CardTitle className="text-sm font-bold text-slate-900">Orders Updated After Submission</CardTitle>
              <AlertCircle className="w-5 h-5 text-red-700 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              <div className="text-4xl font-bold text-red-700 mb-1">{updatedOrdersCount}</div>
              <Link to={createPageUrl("TodaysOrders")} className="text-xs text-red-700 hover:text-red-900 font-semibold hover:underline">
                View orders →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}