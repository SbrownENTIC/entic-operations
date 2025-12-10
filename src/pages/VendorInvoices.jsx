import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, UploadCloud, Loader2, Files, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ArrowLeft, Folder } from "lucide-react";
import { useLocation } from "react-router-dom";
import VendorInvoiceList from "../components/vendorInvoices/VendorInvoiceList";
import VendorFolderGrid from "../components/vendorInvoices/VendorFolderGrid";
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
  const [selectedVendor, setSelectedVendor] = useState(null);
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

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies-catalog'],
    queryFn: () => base44.entities.Supply.list(null, 1000)
  });

  const splitInputRef = React.useRef(null);

  const splitMutation = useMutation({
    mutationFn: async (files) => {
      const fileArray = Array.from(files);
      const BATCH_SIZE = 3; // Process 3 files at a time to avoid rate limits
      const results = [];
      
      toast({
        title: "Processing Started",
        description: `Queueing ${fileArray.length} files. This process runs in batches to ensure reliability.`,
      });

      // Process in batches
      for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
        const chunk = fileArray.slice(i, i + BATCH_SIZE);
        
        // Process current batch
        const chunkResults = await Promise.all(chunk.map(async (file) => {
             try {
                 const { file_url } = await base44.integrations.Core.UploadFile({ file });
                 const res = await base44.functions.invoke('splitAndProcessInvoices', { file_url });
                 return { status: 'success', data: res.data };
             } catch (err) {
                 console.error("Error processing file:", file.name, err);
                 return { status: 'error', error: err, fileName: file.name };
             }
        }));
        
        results.push(...chunkResults);
        
        // Optional: slight delay between batches if needed, but await above is usually enough
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      
      const successes = results.filter(r => r.status === 'success');
      const failures = results.filter(r => r.status === 'error');
      
      const totalProcessed = successes.reduce((acc, curr) => acc + (curr.data?.processed_count || 0), 0);
      
      let description = `Successfully processed ${successes.length} files and created ${totalProcessed} invoices.`;
      if (failures.length > 0) {
          description += ` Failed to process ${failures.length} files.`;
      }
      
      toast({
        title: "Processing Complete",
        description: description,
        variant: failures.length > 0 ? "destructive" : "default"
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error",
        description: "An unexpected error occurred: " + (error.message || "Unknown error"),
        variant: "destructive",
      });
    }
  });

  const handleSplitUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        splitMutation.mutate(files);
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

  // Helper to normalize vendor names for consistent grouping/filtering
  const normalizeVendorName = (name) => {
    if (!name) return 'Unknown Vendor';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Filter for the list view if a vendor is selected
  const listInvoices = selectedVendor 
    ? filteredInvoices.filter(inv => normalizeVendorName(inv.vendor_name) === selectedVendor)
    : filteredInvoices;

  const sortedInvoices = [...listInvoices].sort((a, b) => {
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
        // Select only the invoices currently visible in the list (filtered by vendor if selected)
        setSelectedInvoices(sortedInvoices.map(i => i.id));
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
                multiple
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

        <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/50">
          <CardHeader className="border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                {selectedVendor ? (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedVendor(null)}
                      className="mr-1"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span 
                          className="hover:underline cursor-pointer" 
                          onClick={() => setSelectedVendor(null)}
                        >
                          Invoices
                        </span>
                        <ChevronRight className="w-4 h-4" />
                        <span className="font-medium text-slate-900">{selectedVendor}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-1">
                    <Search className="w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="Search by vendor or invoice number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                )}
              </div>
              {selectedInvoices.length > 0 && selectedVendor && (
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
            {selectedVendor ? (
              <VendorInvoiceList 
                invoices={sortedInvoices} 
                isLoading={isLoading} 
                onDeleteClick={setDeleteConfirm}
                selectedIds={selectedInvoices}
                onToggleSelect={handleToggleSelect}
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
                supplies={supplies}
              />
            ) : (
              <div className="p-6">
                <VendorFolderGrid 
                  invoices={filteredInvoices}
                  onSelectVendor={setSelectedVendor}
                />
              </div>
            )}
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