import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, UploadCloud, Loader2, Files, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ArrowLeft, Folder, PackagePlus, ChevronLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import VendorInvoiceList from "../vendorInvoices/VendorInvoiceList";
import VendorFolderGrid from "../vendorInvoices/VendorFolderGrid";
import VendorInvoiceUpload from "../vendorInvoices/VendorInvoiceUpload";
import VendorInvoiceForm from "../vendorInvoices/VendorInvoiceForm";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
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

export default function VendorInvoicesView({ folderId, folderName }) {
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
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
    queryKey: ['vendor-invoices', folderId],
    queryFn: () => folderId 
      ? base44.entities.VendorInvoice.filter({ folder_id: folderId }, '-created_date', 1000)
      : base44.entities.VendorInvoice.list('-created_date', 1000)
  });

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies-catalog'],
    queryFn: () => base44.entities.Supply.list(null, 1000)
  });

  const splitInputRef = React.useRef(null);

  const allMissingItems = React.useMemo(() => {
    if (!invoices.length || isLoading) return [];
    
    const missing = new Map();
    
    // Determine target category based on folder
    const targetCategory = folderName?.toLowerCase().includes('henry') ? 'clinical' : 'office';
    
    // Filter existing codes to only check the target catalog
    const targetSupplies = supplies.filter(s => s.category === targetCategory);
    const existingCodes = new Set(targetSupplies.map(s => s.item_number));

    invoices.forEach(inv => {
      const lineItems = inv.extracted_data?.line_items || [];
      lineItems.forEach(item => {
        if (item.item_code && !existingCodes.has(item.item_code) && !missing.has(item.item_code)) {
          missing.set(item.item_code, {
            product_name: item.description || "Unknown Item",
            item_number: item.item_code,
            vendor: inv.vendor_name || "Unknown Vendor",
            unit_price: item.unit_price || 0,
            category: targetCategory,
            units: 'each'
          });
        }
      });
    });
    
    return Array.from(missing.values());
  }, [invoices, supplies, isLoading, folderName]);

  const bulkAddItemsMutation = useMutation({
    mutationFn: async (items) => {
      await base44.entities.Supply.bulkCreate(items);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplies-catalog'] });
      toast({
        title: "Catalog Updated",
        description: `Successfully added ${variables.length} items to the catalog.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add items: " + error.message,
        variant: "destructive",
      });
    }
  });

  const splitMutation = useMutation({
    mutationFn: async (files) => {
      const fileArray = Array.from(files);
      const BATCH_SIZE = 50; // Process 50 files at a time
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.VendorInvoice.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast({
        title: "Invoice updated",
        description: "The vendor invoice has been successfully updated.",
      });
      // setEditingInvoice(null); // Handled manually now
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update invoice: " + error.message,
        variant: "destructive",
      });
    }
  });

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
      const batchSize = 10;
      for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          await Promise.all(batch.map(id => base44.entities.VendorInvoice.delete(id)));
      }
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

  // Navigation Logic
  const currentIndex = editingInvoice ? sortedInvoices.findIndex(inv => inv.id === editingInvoice.id) : -1;
  const hasNext = currentIndex !== -1 && currentIndex < sortedInvoices.length - 1;
  const hasPrev = currentIndex > 0;
  
  const handleNext = () => {
    if (hasNext) setEditingInvoice(sortedInvoices[currentIndex + 1]);
  };
  
  const handlePrev = () => {
    if (hasPrev) setEditingInvoice(sortedInvoices[currentIndex - 1]);
  };

  const handleSave = async (data, isSaveAndNext) => {
    try {
        await updateMutation.mutateAsync({ id: editingInvoice.id, data });
        if (isSaveAndNext) {
            if (hasNext) {
                handleNext();
            } else {
                setEditingInvoice(null);
                toast({ title: "All done!", description: "No more invoices to review." });
            }
        } else {
            setEditingInvoice(null);
        }
    } catch (e) {
        // error handling is in mutation
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
            {allMissingItems.length > 0 && (
              <Button
                variant="outline"
                onClick={() => bulkAddItemsMutation.mutate(allMissingItems)}
                disabled={bulkAddItemsMutation.isPending}
                className="bg-white text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
              >
                {bulkAddItemsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PackagePlus className="w-4 h-4 mr-2" />
                )}
                Import {allMissingItems.length} Missing Items
              </Button>
            )}
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
            folderId={folderId}
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
                {selectedVendor && (
                    <div className="flex items-center gap-2 mr-4 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setSelectedVendor(null);
                          setSearchTerm("");
                        }}
                        className="mr-1"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span 
                            className="hover:underline cursor-pointer" 
                            onClick={() => {
                              setSelectedVendor(null);
                              setSearchTerm("");
                            }}
                          >
                            Invoices
                          </span>
                          <ChevronRight className="w-4 h-4" />
                          <span className="font-medium text-slate-900">{selectedVendor}</span>
                        </div>
                      </div>
                    </div>
                )}
                
                {(selectedVendor || folderId) && (
                    <div className="flex items-center gap-4 flex-1">
                      <Search className="w-5 h-5 text-slate-400" />
                      <Input
                        placeholder={selectedVendor ? `Search in ${selectedVendor}...` : `Search in ${folderName || 'folder'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                )}
              </div>
              
              {selectedInvoices.length > 0 && (selectedVendor || folderId) && (
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
            {(selectedVendor || folderId) ? (
              <VendorInvoiceList 
                invoices={sortedInvoices} 
                isLoading={isLoading} 
                onDeleteClick={setDeleteConfirm}
                onEditClick={setEditingInvoice}
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
                  onSelectVendor={(vendor) => {
                    setSelectedVendor(vendor);
                    setSearchTerm(""); // Clear search when entering a folder
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
                <DialogTitle>Edit Vendor Invoice</DialogTitle>
                <DialogDescription>
                Update the details for invoice {editingInvoice?.invoice_number}.
                </DialogDescription>
            </div>
            {editingInvoice && currentIndex !== -1 && (
                <div className="flex items-center gap-2 pr-8">
                    <span className="text-sm text-slate-500 mr-2">
                        {currentIndex + 1} of {sortedInvoices.length}
                    </span>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handlePrev} 
                        disabled={!hasPrev}
                        className="h-8 w-8"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleNext} 
                        disabled={!hasNext}
                        className="h-8 w-8"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </DialogHeader>
          {editingInvoice && (
            <VendorInvoiceForm
              invoice={editingInvoice}
              isLoading={updateMutation.isPending}
              onSubmit={handleSave}
              onCancel={() => setEditingInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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