import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, UploadCloud } from "lucide-react";
import VendorInvoiceList from "../components/vendorInvoices/VendorInvoiceList";
import VendorInvoiceUpload from "../components/vendorInvoices/VendorInvoiceUpload";
import { useToast } from "@/components/ui/use-toast";
import UnderConstruction from "@/components/ui/UnderConstruction";

export default function VendorInvoices() {
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn: () => base44.entities.VendorInvoice.list('-created_date')
  });

  const filteredInvoices = invoices.filter(inv => 
    inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUploadComplete = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    toast({
      title: "Success",
      description: "Invoice uploaded and processing started.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <UnderConstruction pageName="Vendor Invoices" />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Vendor Invoices</h1>
            <p className="text-slate-600">Manage and process electronic vendor invoices</p>
          </div>
          <Button 
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload Invoice
          </Button>
        </div>

        {showUpload && (
          <VendorInvoiceUpload 
            onClose={() => setShowUpload(false)}
            onUploadComplete={handleUploadComplete}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by vendor or invoice number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <VendorInvoiceList invoices={filteredInvoices} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}