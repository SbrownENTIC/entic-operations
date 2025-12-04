import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function FinancialByProgramWidget({ 
  programsSorted, 
  financialsByProgram, 
  outstandingToENTIC, 
  totalPaidToENTIC, 
  totalOwedToProviders, 
  formatCurrency, 
  openFinancialDetail 
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial Overview by Program/Location</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Detailed breakdown of finances per program (click amounts for details)</p>
          </div>
          <Building2 className="w-6 h-6 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Program/Location</th>
                <th className="text-right p-4 text-sm font-semibold text-slate-700">Outstanding to ENTIC</th>
                <th className="text-right p-4 text-sm font-semibold text-slate-700">Paid to ENTIC</th>
                <th className="text-right p-4 text-sm font-semibold text-slate-700">Owed to Providers</th>
              </tr>
            </thead>
            <tbody>
              {programsSorted.map((program) => {
                const data = financialsByProgram[program];
                return (
                  <tr key={program} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{program}</td>
                    <td 
                      className="p-4 text-right font-medium text-orange-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('outstanding', program)}
                    >
                      {formatCurrency(data.outstanding)}
                    </td>
                    <td 
                      className="p-4 text-right font-medium text-green-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('paidToENTIC', program)}
                    >
                      {formatCurrency(data.paidToENTIC)}
                    </td>
                    <td 
                      className="p-4 text-right font-medium text-blue-700 cursor-pointer hover:underline"
                      onClick={() => openFinancialDetail('owedToProviders', program)}
                    >
                      {formatCurrency(data.owedToProviders)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="p-4 font-bold text-slate-900">Total</td>
                <td 
                  className="p-4 text-right font-bold text-orange-700 cursor-pointer hover:underline"
                  onClick={() => openFinancialDetail('outstanding')}
                >
                  {formatCurrency(outstandingToENTIC)}
                </td>
                <td 
                  className="p-4 text-right font-bold text-green-700 cursor-pointer hover:underline"
                  onClick={() => openFinancialDetail('paidToENTIC')}
                >
                  {formatCurrency(totalPaidToENTIC)}
                </td>
                <td 
                  className="p-4 text-right font-bold text-blue-700 cursor-pointer hover:underline"
                  onClick={() => openFinancialDetail('owedToProviders')}
                >
                  {formatCurrency(totalOwedToProviders)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}