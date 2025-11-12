import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PaymentDetailModal({ payment, invoices, providers, onClose }) {
  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid_to_entic') return 'Paid to ENTIC';
    if (invoice.status === 'provider_paid') return 'Provider Paid';
    if (invoice.status === 'partial') return 'Partial';
    return invoice.status?.replace(/_/g, ' ');
  };

  const statusColors = {
    not_started: "bg-gray-100 text-gray-800",
    draft: "bg-gray-100 text-gray-800",
    pending_providers_approval: "bg-yellow-100 text-yellow-800",
    pending_providers_time: "bg-yellow-100 text-yellow-800",
    sent_for_approval: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    sent_to_vendor: "bg-blue-100 text-blue-800",
    paid_to_entic: "bg-green-100 text-green-800",
    provider_paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800"
  };

  return (
    <Dialog open={!!payment} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Payment Date</p>
                  <p className="font-medium">
                    {payment?.payment_date ? format(parseISO(payment.payment_date), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payment Month</p>
                  <p className="font-medium">{payment.payment_month || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payer</p>
                  <p className="font-medium">{payment.payer || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Amount</p>
                  <p className="font-medium text-green-600 text-lg">
                    ${formatCurrency(payment.total_amount || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payment Method</p>
                  <p className="font-medium">
                    {payment.payment_method?.replace(/_/g, ' ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Reference Number</p>
                  <p className="font-medium font-mono">{payment.reference_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={payment.status === 'cleared' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {payment.status === 'entic_paid' ? 'ENTIC Paid' : payment.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Unallocated Amount</p>
                  <p className={`font-medium ${payment.unallocated_amount > 0 ? 'text-orange-600' : 'text-slate-600'}`}>
                    ${formatCurrency(payment.unallocated_amount || 0)}
                  </p>
                </div>
              </div>
              
              {payment.notes && (
                <div className="pt-3 border-t border-slate-200 mt-3">
                  <p className="text-sm text-slate-500">Notes</p>
                  <p className="text-slate-700">{payment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Allocations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Payment Allocations</h3>
            </div>
            
            {payment.allocations && payment.allocations.length > 0 ? (
              <div className="space-y-3">
                {payment.allocations.map((allocation, index) => {
                  const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
                  const provider = providers.find(p => p.id === allocation.provider_id);
                  
                  return (
                    <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Invoice</p>
                          {invoice ? (
                            <Link 
                              to={`${createPageUrl("Invoices")}?edit=${invoice.id}`}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                              onClick={onClose}
                            >
                              {invoice.invoice_number || 'N/A'}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <p className="font-medium text-slate-900">N/A</p>
                          )}
                          <p className="text-sm text-slate-600">
                            {invoice?.program_group || 'N/A'}
                            {invoice?.month ? ` (${invoice.month})` : ''}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-500">Provider</p>
                          <p className="font-medium text-slate-900">
                            {provider?.full_name || 'Unknown'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-500">Amount</p>
                          <p className="text-lg font-bold text-green-600">
                            ${formatCurrency(allocation.amount || 0)}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-500">Invoice Status</p>
                          {invoice ? (
                            <Badge className={statusColors[invoice.status]}>
                              {getStatusLabel(invoice)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">N/A</span>
                          )}
                        </div>
                      </div>
                      
                      {allocation.notes && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-xs text-slate-500">Notes</p>
                          <p className="text-sm text-slate-700">{allocation.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-slate-500">No allocations yet</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}