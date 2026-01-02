import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function MissingInvoicesWidget({ 
  providersMissingPriorInvoice, 
  previousMonthStr, 
  createWaiverMutation,
  deleteWaiverMutation
}) {
  const { toast } = useToast();

  if (!providersMissingPriorInvoice || providersMissingPriorInvoice.length === 0) return null;

  const handleWaive = (providerId, programGroup = null, providerName) => {
    createWaiverMutation.mutate(
      {
        provider_id: providerId,
        month: previousMonthStr,
        program_group: programGroup,
        reason: programGroup ? `Not Required for ${programGroup}` : "No On Call Time to Record"
      },
      {
        onSuccess: (data) => {
          // data is the created waiver entity
          toast({
            title: "Invoice Waived",
            description: `Marked as not required for ${providerName}${programGroup ? ` (${programGroup})` : ''}.`,
            action: (
              <ToastAction 
                altText="Undo" 
                onClick={() => deleteWaiverMutation.mutate(data.id)}
              >
                Undo
              </ToastAction>
            ),
          });
        }
      }
    );
  };

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
              The following providers have missing invoices for last month
            </p>
          </div>
          <Badge className="bg-orange-200 text-orange-800 hover:bg-orange-300 border-orange-300">
            {providersMissingPriorInvoice.length} Providers
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providersMissingPriorInvoice.map(provider => {
            const missingGroups = provider.missingGroups || ['ANY'];
            const isGeneric = missingGroups.includes('ANY');

            return (
              <div key={provider.id} className="flex flex-col p-3 bg-white rounded-lg border border-orange-200 shadow-sm gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mr-3 text-orange-700 font-bold text-xs">
                      {provider.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900 text-sm block">{provider.full_name}</span>
                      {!isGeneric && missingGroups.length > 0 && (
                        <span className="text-xs text-orange-600">
                          Missing: {missingGroups.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                {isGeneric ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleWaive(provider.id, null, provider.full_name)}
                    className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 w-full sm:w-auto"
                  >
                    Not Required
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 w-full sm:w-auto flex justify-between gap-1"
                      >
                        Not Required
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleWaive(provider.id, null, provider.full_name)}>
                        Waive All (Entire Month)
                      </DropdownMenuItem>
                      {missingGroups.map(group => (
                        <DropdownMenuItem key={group} onClick={() => handleWaive(provider.id, group, provider.full_name)}>
                          Waive {group} Only
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}