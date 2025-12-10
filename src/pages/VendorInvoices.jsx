import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, UploadCloud, Loader2, Files, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation } from "react-router-dom";
import VendorInvoiceList from "../components/vendorInvoices/VendorInvoiceList";
import VendorInvoiceUpload from "../components/vendorInvoices/VendorInvoiceUpload";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function VendorInvoices() {
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Close upload modal when navigating to root URL
  React.useEffect(() => {
    if (location.search === '' && showUpload) {
      setShowUpload(false);
    }
  }, [location.search]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vendor-invoices'],
    queryFn: () => base44.entities.VendorInvoice.list('-created_date')
  });

  const splitInputRef = React.useRef(null);

  const splitMutation = useMutation({
    mutationFn: async (file) => {
      toast({
        title: "Uploading...",
        description: "Uploading PDF for analysis. This may take a moment.",
      });
      // 1. Upload
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      toast({
        title: "Analyzing & Splitting...",
        description: "AI is analyzing the document structure. Please wait...",
      });
      
      // 2. Process
      const res = await base44.functions.invoke('splitAndProcessInvoices', { file_url });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast({
        title: "Processing Complete",
        description: `Successfully split and created ${data.processed_count} invoices.`,
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to process file: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    }
  });

  const handleSplitUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
        splitMutation.mutate(file);
    }
    // reset input
    e.target.value = '';
  };

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.VendorInvoice.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast({
        title: "Invoice deleted",
        description: "The vendor invoice has been successfully deleted.",
      });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete invoice: " + error.message,
        variant: "destructive",
      });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.VendorInvoice.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast({
        title: "Invoices deleted",
        description: `${selectedInvoices.length} invoices have been deleted.`,
      });
      setSelectedInvoices([]);
      setBulkDeleteConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete invoices: " + error.message,
        variant: "destructive",
      });
    }
  });

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === "all" || inv.location === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'total_amount') {
      aValue = a.total_amount || 0;
      bValue = b.total_amount || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'invoice_date' || sortField === 'created_date') {
      aValue = a[sortField] ? new Date(a[sortField]) : new Date(0);
      bValue = b[sortField] ? new Date(b[sortField]) : new Date(0);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    toast({
      title: "Success",
      description: "Invoice uploaded and processing started.",
    });
  };

  const handleToggleSelect = (id, checked) => {
    if (id === 'all') {
      if (checked) {
        setSelectedInvoices(filteredInvoices.map(i => i.id));
      } else {
        setSelectedInvoices([]);
      }
    } else {
      if (checked) {
        setSelectedInvoices(prev => [...prev, id]);
      } else {
        setSelectedInvoices(prev => prev.filter(i => i !== id));
      }
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] bg-slate-50 p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Vendor Invoices</h1>
            <p className="text-slate-600">Manage and process electronic vendor invoices</p>
          </div>
          <div className="flex gap-2">
            <Button 
                variant="outline"
                onClick={() => splitInputRef.current?.click()}
                disabled={splitMutation.isPending}
                className="bg-white"
            >
                {splitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                    <Files className="w-4 h-4 mr-2" />
                )}
                {splitMutation.isPending ? 'Processing...' : 'Split Multi-Invoice PDF'}
            </Button>
            <input 
                type="file" 
                ref={splitInputRef}
                className="hidden" 
                accept=".pdf"
                onChange={handleSplitUpload}
            />
            <Button 
                onClick={() => setShowUpload(true)}
                className="bg-blue-600 hover:bg-blue-700"
            >
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload Invoice
            </Button>
          </div>
        </div>

        {showUpload && (
          <VendorInvoiceUpload 
            onClose={() => setShowUpload(false)}
            onUploadComplete={handleUploadComplete}
          />
        )}

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white border shadow-sm p-1 h-auto flex-wrap">
                <TabsTrigger value="all">All Locations</TabsTrigger>
                <TabsTrigger value="Glastonbury">Glastonbury</TabsTrigger>
                <TabsTrigger value="Manchester">Manchester</TabsTrigger>
                <TabsTrigger value="Bloomfield">Bloomfield</TabsTrigger>
                <TabsTrigger value="Farmington">Farmington</TabsTrigger>
            </TabsList>
        </Tabs>

        <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <Search className="w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by vendor or invoice number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>
              {selectedInvoices.length > 0 && (
                <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">
                    {selectedInvoices.length} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteConfirm(true)}
                  >
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto relative">
            <VendorInvoiceList 
              invoices={sortedInvoices} 
              isLoading={isLoading} 
              onDeleteClick={setDeleteConfirm}
              selectedIds={selectedInvoices}
              onToggleSelect={handleToggleSelect}
              onSort={handleSort}
              sortField={sortField}
              sortDirection={sortDirection}
            />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {deleteConfirm?.invoice_number} from {deleteConfirm?.vendor_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Invoices</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedInvoices.length} selected invoices? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedInvoices)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}