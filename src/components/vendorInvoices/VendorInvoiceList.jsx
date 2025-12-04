import React from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, ExternalLink, CheckCircle, AlertCircle, Clock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default function VendorInvoiceList({ invoices, isLoading }) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          icon={FileText}
          title="No invoices found"
          description="Upload your first vendor invoice to get started."
        />
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'processed':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1"/> Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1"/> Pending Review</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            <th className="p-4">Vendor</th>
            <th className="p-4">Invoice #</th>
            <th className="p-4">Date</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
              <td className="p-4 font-medium text-slate-900">{invoice.vendor_name || "Unknown Vendor"}</td>
              <td className="p-4 text-slate-600">{invoice.invoice_number || "-"}</td>
              <td className="p-4 text-slate-600">
                {invoice.invoice_date ? format(parseISO(invoice.invoice_date), 'MMM d, yyyy') : '-'}
              </td>
              <td className="p-4 font-medium text-slate-900">
                {invoice.total_amount ? `$${invoice.total_amount.toFixed(2)}` : '-'}
              </td>
              <td className="p-4">
                {getStatusBadge(invoice.status)}
              </td>
              <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                  {invoice.document_url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={invoice.document_url} target="_blank" rel="noopener noreferrer" title="View Original PDF">
                        <FileText className="w-4 h-4 text-slate-500" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    Review
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}