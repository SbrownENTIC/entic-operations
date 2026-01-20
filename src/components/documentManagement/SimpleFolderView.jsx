import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Loader2, ArrowUpDown, Upload, Plus, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDateToEST, formatDateTimeToEST } from "@/components/DateUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function SimpleFolderView({ folderId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VendorInvoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices', folderId] });
      toast({ title: "Updated", description: "Invoice date updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

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

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'created_date' || sortField === 'invoice_date') {
      aValue = a[sortField] ? new Date(a[sortField]) : new Date(0);
      bValue = b[sortField] ? new Date(b[sortField]) : new Date(0);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
      const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });

        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // Process invoice with AI to extract data
        const result = await base44.functions.invoke('processVendorInvoice', {
          file_url: file_url,
          folder_id: folderId
        });
        
        if (result.data.success) {
          toast({ title: "Document Added", description: `Processed: ${result.data.invoice.invoice_number || 'Invoice'}` });
        } else {
          toast({ title: "Processing Error", description: result.data.error, variant: "destructive" });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices', folderId] });
      toast({ title: "Upload Complete", description: `${files.length} document(s) processed` });
    } catch (error) {
      toast({ title: "Upload Failed", description: error.response?.data?.error || error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} document(s)?`)) return;

    try {
      for (const id of selectedIds) {
        await base44.entities.VendorInvoice.delete(id);
      }
      queryClient.invalidateQueries({ queryKey: ['vendor-invoices', folderId] });
      setSelectedIds([]);
      toast({ title: "Deleted", description: `${selectedIds.length} document(s) removed` });
    } catch (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedInvoices.map(inv => inv.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Search className="w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            {selectedIds.length > 0 && (
              <span className="text-sm text-slate-600">
                {selectedIds.length} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedIds.length})
              </Button>
            )}
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="document-upload"
            />
            <Button
              onClick={() => document.getElementById('document-upload').click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading... {uploadProgress.total > 0 && `(${uploadProgress.total - uploadProgress.current + 1} pending)`}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Documents
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b sticky top-0 z-10">
            <tr>
              <th className="w-12 p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === sortedInvoices.length && sortedInvoices.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300"
                />
              </th>
              <th 
                className="text-left p-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('invoice_number')}
              >
                <div className="flex items-center gap-2">
                  Name
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                </div>
              </th>
              <th 
                className="text-left p-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('billed_to')}
              >
                <div className="flex items-center gap-2">
                  Billed To
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                </div>
              </th>
              <th 
                className="text-left p-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('invoice_date')}
              >
                <div className="flex items-center gap-2">
                  Invoice Date
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                </div>
              </th>
              <th 
                className="text-left p-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort('created_date')}
              >
                <div className="flex items-center gap-2">
                  Date Modified
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                </div>
              </th>
              <th className="text-left p-3 font-medium text-slate-600">Size</th>
              <th className="text-left p-3 font-medium text-slate-600">Kind</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b hover:bg-slate-50 transition-colors"
              >
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(invoice.id)}
                    onChange={() => toggleSelect(invoice.id)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                </td>
                <td className="p-3 cursor-pointer" onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="font-medium text-slate-900">
                      {invoice.invoice_number || 'Untitled'}.pdf
                    </span>
                  </div>
                </td>
                <td className="p-3 cursor-pointer" onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}>
                  <Badge variant="outline" className={invoice.billed_to === 'The Hearing Institute' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                    {invoice.billed_to || 'ENTIC'}
                  </Badge>
                </td>
                <td className="p-3 text-slate-600 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="p-0 h-auto font-normal hover:bg-transparent hover:text-blue-600 flex items-center gap-2"
                      >
                        {formatDateToEST(invoice.invoice_date)}
                        <Pencil className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={invoice.invoice_date ? new Date(invoice.invoice_date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const dateStr = format(date, "yyyy-MM-dd");
                            updateInvoiceMutation.mutate({ id: invoice.id, data: { invoice_date: dateStr } });
                            // The popover will close automatically when clicking outside, or we can control open state if needed
                            // But for simplicity, we let it be.
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="p-3 text-slate-600 cursor-pointer" onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}>
                  {formatDateToEST(invoice.created_date)}
                </td>
                <td className="p-3 text-slate-600 cursor-pointer" onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}>
                  {formatFileSize(invoice.file_size)}
                </td>
                <td className="p-3 text-slate-600 cursor-pointer" onClick={() => invoice.document_url && window.open(invoice.document_url, '_blank')}>PDF Document</td>
              </tr>
            ))}
          </tbody>
        </table>

        {sortedInvoices.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No documents found</p>
          </div>
        )}
      </div>
    </div>
  );
}