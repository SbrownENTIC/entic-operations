import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PaymentDetailModal({ payment, invoices, providers, onClose }) {
  const totalAllocated = payment.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
  const unallocated = (payment.total_amount || 0) - totalAllocated;

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    cleared: "bg-green-100 text-green-800",
    reversed: "bg-red-100 text-red-800",
    entic_paid: "bg-blue-100 text-blue-800"
  };

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
            <div>
              <p className="text-sm text-slate-500">Payment Date</p>
              <p className="text-lg font-medium text-slate-900">
                {format(parseISO(payment.payment_date), 'MMM d, yyyy')}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-slate-500">Payer</p>
              <p className="text-lg font-medium text-slate-900">{payment.payer}</p>
            </div>
            
            <div>
              <p className="text-sm text-slate-500">Payment Method</p>
              <p className="text-lg font-medium text-slate-900">
                {payment.payment_method?.replace(/_/g, ' ') || '-'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-slate-500">Reference Number</p>
              <p className="text-lg font-medium font-mono text-slate-900">
                {payment.reference_number || '-'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-slate-500">Total Amount</p>
              <p className="text-2xl font-bold text-green-600">
                ${formatCurrency(payment.total_amount || 0)}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <Badge className={`${statusColors[payment.status]} mt-1`}>
                {payment.status === 'entic_paid' ? 'ENTIC Paid' : payment.status}
              </Badge>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Payment Allocations</h3>
              <div className="text-sm">
                <span className="text-slate-500">Unallocated: </span>
                <span className={`font-bold ${unallocated > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  ${formatCurrency(unallocated)}
                </span>
              </div>
            </div>
            
            {payment.allocations && payment.allocations.length > 0 ? (
              <div className="space-y-3">
                {payment.allocations.map((allocation, index) => {
                  const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
                  const provider = providers.find(p => p.id === allocation.provider_id);
                  
                  return (
                    <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                      <div className="grid md:grid-cols-3 gap-4">
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
          
          {payment.notes && (
            <div className="pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500 mb-2">Notes</p>
              <p className="text-slate-700">{payment.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}