import React from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, ExternalLink, CheckCircle, AlertCircle, Clock, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmptyState from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function VendorInvoiceList({ invoices, isLoading, onDeleteClick, selectedIds, onToggleSelect, onSort, sortField, sortDirection }) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading invoices...</div>;
  }

  const SortIcon = ({ field }) => {
    if (!onSort) return null;
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline text-slate-300" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline text-blue-600" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline text-blue-600" />;
  };

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
    <div className="min-w-full inline-block align-middle">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
          <tr>
            <th className="p-4 w-10 bg-slate-50 sticky top-0 z-10">
              {onToggleSelect && (
                <input
                  type="checkbox"
                  checked={invoices.length > 0 && selectedIds?.length === invoices.length}
                  onChange={(e) => onToggleSelect('all', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              )}
            </th>
            <th className="p-4 w-12 text-slate-400 font-semibold bg-slate-50 sticky top-0 z-10">#</th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('vendor_name')}
            >
              Vendor <SortIcon field="vendor_name" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('location')}
            >
              Location <SortIcon field="location" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('invoice_number')}
            >
              Invoice # <SortIcon field="invoice_number" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('invoice_type')}
            >
              Type <SortIcon field="invoice_type" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('invoice_date')}
            >
              Date <SortIcon field="invoice_date" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('total_amount')}
            >
              Amount <SortIcon field="total_amount" />
            </th>
            <th 
              className="p-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50 sticky top-0 z-10"
              onClick={() => onSort && onSort('status')}
            >
              Status <SortIcon field="status" />
            </th>
            <th className="p-4 text-right font-semibold bg-slate-50 sticky top-0 z-10">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoices.map((invoice, index) => (
            <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
              <td className="p-4">
                {onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={selectedIds?.includes(invoice.id)}
                    onChange={(e) => onToggleSelect(invoice.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                )}
              </td>
              <td className="p-4 text-slate-400 text-xs">{index + 1}</td>
              <td className="p-4 font-medium text-slate-900">{invoice.vendor_name || "Unknown Vendor"}</td>
              <td className="p-4 text-slate-600">
                  {invoice.location ? (
                      <Badge variant="outline" className="font-normal">
                          {invoice.location}
                      </Badge>
                  ) : (
                      <span className="text-slate-400 text-xs italic">Unassigned</span>
                  )}
              </td>
              <td className="p-4 text-slate-600">
                  {invoice.invoice_number || "-"}
                  {invoice.related_invoice_number && (
                      <div className="text-xs text-slate-400 mt-1">Ref: {invoice.related_invoice_number}</div>
                  )}
              </td>
              <td className="p-4">
                  {invoice.invoice_type === 'credit_memo' ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Credit Memo</Badge>
                  ) : (
                      <span className="text-slate-500 text-xs">Invoice</span>
                  )}
              </td>
              <td className="p-4 text-slate-600">
                {invoice.invoice_date ? format(parseISO(invoice.invoice_date), 'MMM d, yyyy') : '-'}
              </td>
              <td className={`p-4 font-medium ${invoice.total_amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {invoice.total_amount ? `$${invoice.total_amount.toFixed(2)}` : '-'}
              </td>
              <td className="p-4">
                {getStatusBadge(invoice.status)}
              </td>
              <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                  {invoice.document_url && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" title="Preview PDF">
                                <Eye className="w-4 h-4 text-blue-500" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] h-[500px] p-0 shadow-xl border-slate-200" align="end">
                            <iframe 
                                src={`${invoice.document_url}#toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-full rounded-md"
                                title="Invoice Preview"
                            />
                            <div className="absolute bottom-2 right-2">
                                <Button size="sm" variant="secondary" asChild className="opacity-90 hover:opacity-100 shadow-sm">
                                    <a href={invoice.document_url} target="_blank" rel="noopener noreferrer">
                                        Open Full
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                  )}
                  <Link to={`${createPageUrl("VendorInvoiceReview")}?id=${invoice.id}`}>
                    <Button variant="outline" size="sm">
                        Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onDeleteClick(invoice)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
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