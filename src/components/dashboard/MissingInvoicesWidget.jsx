import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function MissingInvoicesWidget({ 
  providersMissingPriorInvoice, 
  previousMonthStr, 
  createWaiverMutation 
}) {
  if (!providersMissingPriorInvoice || providersMissingPriorInvoice.length === 0) return null;

  return (
    <Card className="border-orange-200 shadow-sm bg-orange-50/30">
      <CardHeader className="border-b border-orange-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-800">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Missing Invoices - {previousMonthStr}
            </CardTitle>
            <p className="text-sm text-orange-700 mt-1">
              The following providers have no invoices recorded for last month
            </p>
          </div>
          <Badge className="bg-orange-200 text-orange-800 hover:bg-orange-300 border-orange-300">
            {providersMissingPriorInvoice.length} Providers
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providersMissingPriorInvoice.map(provider => (
            <div key={provider.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200 shadow-sm">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3 text-orange-700 font-bold text-xs">
                  {provider.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <span className="font-medium text-slate-900 text-sm">{provider.full_name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => createWaiverMutation.mutate({
                  provider_id: provider.id,
                  month: previousMonthStr,
                  reason: "No On Call Time to Record"
                })}
                className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7"
                title="Mark as Not Required (No On Call Time)"
              >
                Not Required
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}