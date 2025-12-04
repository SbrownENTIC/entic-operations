import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Clock, CheckCircle2, DollarSign, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FinancialOverviewWidget({ 
  outstandingToENTIC, 
  totalPaidToENTIC, 
  totalOwedToProviders, 
  unallocatedPayments, 
  formatCurrency, 
  exportFinancialOverview, 
  openFinancialDetail 
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Financial Overview</h2>
        <Button
          onClick={exportFinancialOverview}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card 
          className="border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openFinancialDetail('outstanding')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Outstanding to ENTIC</CardTitle>
            <Clock className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">{formatCurrency(outstandingToENTIC)}</div>
            <p className="text-xs text-slate-500 mt-1">Expected - Received (calculated)</p>
            <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
          </CardContent>
        </Card>

        <Card 
          className="border-slate-200 shadow-sm bg-gradient-to-br from-green-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openFinancialDetail('paidToENTIC')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Paid to ENTIC</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{formatCurrency(totalPaidToENTIC)}</div>
            <p className="text-xs text-slate-500 mt-1">Payments received from clients</p>
            <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
          </CardContent>
        </Card>

        <Card 
          className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openFinancialDetail('owedToProviders')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Owed to Providers</CardTitle>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{formatCurrency(totalOwedToProviders)}</div>
            <p className="text-xs text-slate-500 mt-1">Received but not yet paid out</p>
            <p className="text-xs text-blue-600 mt-2 hover:underline">Click to view details →</p>
          </CardContent>
        </Card>

        {unallocatedPayments > 0 && (
          <Link to={createPageUrl("Payments") + "?showUnallocated=true"} className="block">
            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-purple-50 to-white cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Unallocated Payments</CardTitle>
                <Wallet className="w-5 h-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700">{formatCurrency(unallocatedPayments)}</div>
                <p className="text-xs text-slate-500 mt-1">Payments pending allocation</p>
                <p className="text-xs text-blue-600 mt-2 hover:underline">Click to allocate →</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}