import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function InvoiceSummaryWidget({ 
  invoices, 
  providers, 
  invoiceLocationFilter, 
  setInvoiceLocationFilter, 
  availableLocations, 
  exportInvoiceSummary 
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Invoice Summary by Status ({invoices.length})</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={invoiceLocationFilter} onValueChange={setInvoiceLocationFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Location" />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map(loc => (
                  <SelectItem key={loc} value={loc}>
                    {loc === 'all' ? 'All Locations' : loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={exportInvoiceSummary}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.entries({
            'Not Started': { invoices: invoices.filter(inv => inv.status === 'not_started'), color: 'gray' },
            'Draft': { invoices: invoices.filter(inv => inv.status === 'draft'), color: 'slate' },
            'Pending Provider Approval': { invoices: invoices.filter(inv => inv.status === 'pending_providers_approval'), color: 'orange' },
            'Pending Provider Time': { invoices: invoices.filter(inv => inv.status === 'pending_providers_time'), color: 'amber' },
            'Sent for Approval': { invoices: invoices.filter(inv => inv.status === 'sent_for_approval'), color: 'yellow' },
            'Approved': { invoices: invoices.filter(inv => inv.status === 'approved'), color: 'lime' },
            'Sent To Vendor': { invoices: invoices.filter(inv => inv.status === 'sent_to_vendor'), color: 'blue' },
            'Paid To ENTIC': { invoices: invoices.filter(inv => inv.status === 'paid_to_entic'), color: 'emerald' },
            'Provider Paid': { invoices: invoices.filter(inv => inv.status === 'provider_paid'), color: 'purple' },
          }).map(([status, { invoices: statusInvoices, color }]) => {
            const filteredStatusInvoices = (invoiceLocationFilter === 'all' 
              ? statusInvoices 
              : statusInvoices.filter(inv => inv.program_group === invoiceLocationFilter)
            ).sort((a, b) => {
              const dateA = a.invoice_date ? new Date(a.invoice_date) : new Date(0);
              const dateB = b.invoice_date ? new Date(b.invoice_date) : new Date(0);
              return dateB - dateA;
            });

            if (filteredStatusInvoices.length === 0) return null;

            return (
              <Card key={status} className={`border-${color}-200 bg-${color}-50/30 shadow-sm`}>
                <CardHeader className="pb-2 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 text-xs">{status}</h3>
                    <Badge className={`bg-${color}-100 text-${color}-800 border-${color}-300 text-xs`}>
                      {filteredStatusInvoices.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {filteredStatusInvoices.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {filteredStatusInvoices.map(inv => {
                        const isUConn = inv.program_group === 'UConn';
                        return (
                          <Link 
                            key={inv.id} 
                            to={`${createPageUrl("Invoices")}?edit=${inv.id}`}
                            className={`block text-xs px-2 py-1.5 bg-white hover:bg-${color}-100 rounded border border-slate-200 hover:border-${color}-400 transition-all shadow-sm hover:shadow`}
                          >
                            <div className="font-medium text-slate-900 text-xs">
                              {inv.invoice_number || 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-600 truncate">
                              {providers.find(p => p.id === inv.staff_member_id)?.full_name || 'Unknown'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {inv.program_group || 'No Location'}
                            </div>
                            {isUConn && inv.month && (
                              <div className="text-[10px] text-blue-600 font-medium">
                                {inv.month}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-slate-400 text-xs">No invoices</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}