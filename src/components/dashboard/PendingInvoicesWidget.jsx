import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PendingInvoicesWidget({ providersWithPendingInvoices }) {
  if (!providersWithPendingInvoices || providersWithPendingInvoices.length === 0) return null;

  return (
    <Card className="border-indigo-200 shadow-sm bg-indigo-50/30">
      <CardHeader className="border-b border-indigo-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-indigo-800">
              <Clock className="w-5 h-5 text-indigo-600" />
              Invoices Pending Approval
            </CardTitle>
            <p className="text-sm text-indigo-700 mt-1">
              Providers with invoices waiting for approval or time entry
            </p>
          </div>
          <Badge className="bg-indigo-200 text-indigo-800 hover:bg-indigo-300 border-indigo-300">
            {providersWithPendingInvoices.length} Providers
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providersWithPendingInvoices.map(provider => (
            <Link 
              key={provider.id}
              to={`${createPageUrl("Invoices")}?status=pending_providers_approval,sent_for_approval,sent_to_provider_for_approval,sent_to_provider_for_review&search=${encodeURIComponent(provider.full_name)}`}
              className="block group"
            >
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-200 shadow-sm group-hover:border-indigo-400 group-hover:shadow-md transition-all">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 text-indigo-700 font-bold text-xs">
                    {provider.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900 text-sm block group-hover:text-indigo-700 transition-colors">{provider.full_name}</span>
                    <span className="text-xs text-slate-500">{provider.pendingCount} Invoice{provider.pendingCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}