import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ExternalLink } from "lucide-react";

export default function FinancialDetailModal({ isOpen, onClose, title, invoices, providers, type, programGroup }) {
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Calculate total for this view
  let totalAmount = 0;
  if (type === 'paidToENTIC') {
    totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);
  } else if (type === 'owedToProviders') {
    totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);
  } else if (type === 'outstanding') {
    totalAmount = invoices.reduce((sum, inv) => {
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + outstanding;
    }, 0);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</span>
          </DialogTitle>
          {programGroup && (
            <p className="text-sm text-slate-500">Program/Location: {programGroup}</p>
          )}
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No invoices found for this category
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Invoice #</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Program</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Month</th>
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Date</th>
                    <th className="text-right p-3 text-xs font-semibold text-slate-700">Total</th>
                    {type === 'paidToENTIC' || type === 'owedToProviders' ? (
                      <th className="text-right p-3 text-xs font-semibold text-slate-700">Received</th>
                    ) : (
                      <th className="text-right p-3 text-xs font-semibold text-slate-700">Outstanding</th>
                    )}
                    <th className="text-left p-3 text-xs font-semibold text-slate-700">Status</th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-700">View</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const provider = providers.find(p => p.id === invoice.staff_member_id);
                    const outstanding = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);
                    
                    return (
                      <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium text-slate-900">
                          {invoice.invoice_number || '-'}
                        </td>
                        <td className="p-3 text-sm text-slate-600">{invoice.program_group}</td>
                        <td className="p-3 text-sm text-slate-900">{provider?.full_name || '-'}</td>
                        <td className="p-3 text-sm text-slate-600">{invoice.month || '-'}</td>
                        <td className="p-3 text-sm text-slate-600">
                          {format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-3 text-sm text-right font-medium text-slate-900">
                          {formatCurrency(invoice.total || 0)}
                        </td>
                        {type === 'paidToENTIC' || type === 'owedToProviders' ? (
                          <td className="p-3 text-sm text-right font-medium text-green-600">
                            {formatCurrency(invoice.amount_received || 0)}
                          </td>
                        ) : (
                          <td className="p-3 text-sm text-right font-medium text-orange-600">
                            {formatCurrency(outstanding)}
                          </td>
                        )}
                        <td className="p-3">
                          <Badge className={`${statusColors[invoice.status]} text-xs`}>
                            {getStatusLabel(invoice)}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Link 
                            to={createPageUrl("Invoices")}
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan="5" className="p-3 text-sm font-bold text-slate-900">Total</td>
                    <td className="p-3 text-sm text-right font-bold text-slate-900">
                      {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
                    </td>
                    <td className="p-3 text-sm text-right font-bold text-blue-600">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}