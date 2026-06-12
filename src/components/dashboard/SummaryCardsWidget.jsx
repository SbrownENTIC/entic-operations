import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SummaryCardsWidget({ 
  supplyOrders, 
  draftInvoices, 
  licensesExpiring14Days,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {supplyOrders.length > 0 && (
        <Card className={`bg-gradient-to-br from-red-100 to-red-50 transition-all duration-300 ${supplyOrders.length > 0 ? 'border-[5px] border-red-600 animate-alert-glow' : 'border-3 border-red-300 shadow-xl shadow-red-300/60 hover:scale-105'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-red-400">
            <AlertCircle className="w-6 h-6 text-red-700 animate-slow-pulse" />
            <CardTitle className="text-sm font-bold text-slate-900">Supply Order Requests</CardTitle>
            <AlertCircle className="w-6 h-6 text-red-700 animate-slow-pulse" />
          </CardHeader>
          <CardContent className="pt-3">
            <div className="text-4xl font-bold text-red-700 mb-1">{supplyOrders.length}</div>
            <Link to={createPageUrl("OfficeSupplyOrders") + "?filter=pending"} className="text-xs text-red-700 hover:text-red-900 font-semibold hover:underline">
              View requests →
            </Link>
          </CardContent>
        </Card>
      )}

      {draftInvoices > 0 && (
        <Card className={`bg-gradient-to-br from-slate-100 to-slate-50 transition-all duration-300 ${draftInvoices > 0 ? 'border-[5px] border-slate-400' : 'border-3 border-slate-300 shadow-xl shadow-slate-200/50 hover:scale-105'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-slate-300">
            <CardTitle className="text-sm font-bold text-slate-900">Draft Invoices</CardTitle>
            <FileText className="w-5 h-5 text-slate-700" />
          </CardHeader>
          <CardContent className="pt-3">
            <div className="text-4xl font-bold text-slate-700 mb-1">{draftInvoices}</div>
            <Link to={createPageUrl("Invoices") + "?status=draft"} className="text-xs text-slate-700 hover:text-slate-900 font-semibold hover:underline">
              View drafts →
            </Link>
          </CardContent>
        </Card>
      )}

      {licensesExpiring14Days.length > 0 && (
        <Card className={`bg-gradient-to-br from-red-100 to-red-50 transition-all duration-300 ${licensesExpiring14Days.length > 0 ? 'border-[5px] border-red-600 animate-alert-glow' : 'border-3 border-red-300 shadow-xl shadow-red-200/50 hover:scale-105'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/80 backdrop-blur-sm border-b-2 border-red-300">
            <AlertCircle className="w-6 h-6 text-red-700 animate-slow-pulse" />
            <CardTitle className="text-sm font-bold text-slate-900">Licenses Expiring (14d)</CardTitle>
            <AlertCircle className="w-6 h-6 text-red-700 animate-slow-pulse" />
          </CardHeader>
          <CardContent className="pt-3">
            <div className="text-4xl font-bold text-red-700 mb-1">{licensesExpiring14Days.length}</div>
            <Link to={createPageUrl("Licenses") + "?filter=expiring_14"} className="text-xs text-red-700 hover:text-red-900 font-semibold hover:underline">
              View licenses →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}