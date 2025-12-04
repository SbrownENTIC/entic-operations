import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileText, ExternalLink } from "lucide-react";
import { createPageUrl } from "@/utils";
import VendorInvoiceReviewForm from "../components/vendorInvoices/VendorInvoiceReviewForm";
import { useToast } from "@/components/ui/use-toast";

export default function VendorInvoiceReview() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['vendor-invoice', id],
    queryFn: async () => {
        if (!id) return null;
        // Get the single invoice. filter returns an array.
        const results = await base44.entities.VendorInvoice.filter({ id: id });
        return results[0];
    },
    enabled: !!id
  });

  // Fetch supplies for catalog matching
  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies-catalog'],
    queryFn: () => base44.entities.Supply.list(null, 1000)
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.VendorInvoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast({ title: "Success", description: "Invoice updated successfully" });
    }
  });

  const handleSave = (formData) => {
    updateMutation.mutate(formData);
  };

  const handleApprove = () => {
    updateMutation.mutate({ status: 'approved' });
    toast({ title: "Approved", description: "Invoice has been approved." });
  };

  const handleReject = () => {
    updateMutation.mutate({ status: 'rejected' });
    toast({ title: "Rejected", description: "Invoice has been rejected." });
  };

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;
  if (!invoice) return <div className="p-8">Invoice not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("VendorInvoices")}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Invoices
            </Button>
          </Link>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h1 className="font-semibold text-slate-900">{invoice.vendor_name}</h1>
            <div className="text-xs text-slate-500">Inv #{invoice.invoice_number} • {invoice.invoice_date}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
             {invoice.document_url && (
                <Button variant="outline" size="sm" asChild>
                    <a href={invoice.document_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Open PDF in New Tab
                    </a>
                </Button>
             )}
        </div>
      </header>

      {/* Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer */}
        <div className="w-1/2 bg-slate-100 border-r relative flex flex-col">
            {invoice.document_url ? (
                <iframe 
                    src={invoice.document_url} 
                    className="w-full h-full" 
                    title="Invoice Document"
                />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                    <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No document available</p>
                    </div>
                </div>
            )}
        </div>

        {/* Right: Data & Form */}
        <div className="w-1/2 bg-white overflow-y-auto">
            <div className="p-6 max-w-2xl mx-auto">
                <VendorInvoiceReviewForm 
                    invoice={invoice} 
                    supplies={supplies}
                    onSave={handleSave}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isSaving={updateMutation.isPending}
                />
            </div>
        </div>
      </div>
    </div>
  );
}