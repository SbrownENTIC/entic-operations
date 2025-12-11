import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function SimpleFolderView({ folderId }) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vendor-invoices', folderId],
    queryFn: () => folderId 
      ? base44.entities.VendorInvoice.filter({ folder_id: folderId }, '-created_date', 1000)
      : base44.entities.VendorInvoice.list('-created_date', 1000)
  });

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Search className="w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredInvoices.map((invoice) => (
          <button
            key={invoice.id}
            onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}
            className="flex flex-col items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all group"
          >
            <div className="p-3 rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center w-full">
              <p className="text-sm font-medium text-slate-900 truncate w-full" title={invoice.invoice_number || 'Untitled'}>
                {invoice.invoice_number || 'Untitled'}
              </p>
              <p className="text-xs text-slate-500 truncate w-full" title={invoice.vendor_name}>
                {invoice.vendor_name}
              </p>
              {invoice.invoice_date && (
                <p className="text-xs text-slate-400 mt-1">
                  {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredInvoices.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No documents found</p>
        </div>
      )}
    </div>
  );
}