import React from "react";
import { format, parseISO } from "date-fns";
import { formatDateToEST } from "@/components/DateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, ExternalLink, CheckCircle, AlertCircle, Clock, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ListX, PlusCircle, Loader2, Pencil, RefreshCw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmptyState from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export default function VendorInvoiceList({ invoices, isLoading, onDeleteClick, onEditClick, selectedIds, onToggleSelect, onSort, sortField, sortDirection, supplies = [] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addToCatalogMutation = useMutation({
    mutationFn: async ({ item, vendorName }) => {
      await base44.entities.Supply.create({
        product_name: item.description || "Unknown Item",
        item_number: item.item_code,
        vendor: vendorName,
        unit_price: item.unit_price || 0,
        category: 'clinical', // Defaulting to clinical as requested
        units: 'each'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies-catalog'] });
      toast({
        title: "Item Added",
        description: "Item successfully added to clinical catalog.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add item: " + error.message,
        variant: "destructive",
      });
    }
  });

  const syncToOrderMutation = useMutation({
    mutationFn: async (invoice) => {
        // 1. Prepare items
        const orderItems = (invoice.extracted_data?.line_items || []).map(item => ({
            supply_name: item.description || "Unknown Item",
            item_number: item.item_code || "",
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            line_total: item.total_price || 0,
            received: true
        }));

        // 2. Create SupplyOrder
        const supplyOrderData = {
            order_number: invoice.invoice_number,
            vendor: invoice.vendor_name,
            location: invoice.location || "Farmington", 
            order_date: invoice.invoice_date,
            status: 'received',
            category: 'clinical',
            order_type: invoice.invoice_type === 'credit_memo' ? 'return' : 'order',
            items: orderItems,
            subtotal: invoice.total_amount, 
            tax: 0,
            total_amount: invoice.total_amount,
            notes: `Synced from Invoice #${invoice.invoice_number}`
        };

        const newOrder = await base44.entities.SupplyOrder.create(supplyOrderData);

        // 3. Link back
        await base44.entities.VendorInvoice.update(invoice.id, {
            linked_supply_order_ids: [...(invoice.linked_supply_order_ids || []), newOrder.id],
            status: 'processed'
        });
        
        return newOrder;
    },
    onSuccess: (data) => {
        toast({
            title: "Order Synced",
            description: `Successfully created Supply Order ${data.order_number}`,
        });
        queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
    },
    onError: (error) => {
        toast({
            title: "Sync Failed",
            description: error.message,
            variant: "destructive"
        });
    }
  });

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
      case 'order_placed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><CheckCircle className="w-3 h-3 mr-1"/> Order Placed</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1"/> Pending Review</Badge>;
    }
  };

  const safeFormatDate = (dateString) => formatDateToEST(dateString);

  const getMissingItems = (invoice) => {
      const lineItems = invoice.extracted_data?.line_items || [];
      return lineItems.filter(item => {
          if (!item.item_code) return false;
          return !supplies.some(s => s.item_number === item.item_code);
      });
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
                {safeFormatDate(invoice.invoice_date)}
              </td>
              <td className={`p-4 font-medium ${invoice.total_amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {invoice.total_amount ? `$${invoice.total_amount.toFixed(2)}` : '-'}
              </td>
              <td className="p-4">
                {getStatusBadge(invoice.status)}
              </td>
              <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                  {(() => {
                      const missingItems = getMissingItems(invoice);
                      if (missingItems.length > 0) {
                          return (
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" title={`${missingItems.length} items not in catalog`}>
                                          <ListX className="w-4 h-4" />
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-0 shadow-xl border-amber-200" align="end">
                                      <div className="bg-amber-50 p-3 border-b border-amber-100 flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-amber-600" />
                                          <h4 className="font-semibold text-amber-900 text-sm">{missingItems.length} Items Not in Catalog</h4>
                                      </div>
                                      <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                                          {missingItems.map((item, idx) => (
                                              <div key={idx} className="bg-white p-2 rounded border border-slate-100 text-xs shadow-sm flex justify-between items-center gap-2">
                                                  <div className="flex-1 min-w-0">
                                                      <div className="font-medium text-slate-900">{item.item_code}</div>
                                                      <div className="text-slate-600 truncate" title={item.description}>{item.description}</div>
                                                      {item.quantity && <div className="text-slate-500 mt-1">Qty: {item.quantity}</div>}
                                                  </div>
                                                  <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-7 w-7 p-0 shrink-0"
                                                      title="Add to Clinical Catalog"
                                                      onClick={() => addToCatalogMutation.mutate({ item, vendorName: invoice.vendor_name })}
                                                      disabled={addToCatalogMutation.isPending}
                                                  >
                                                      {addToCatalogMutation.isPending ? (
                                                          <Loader2 className="w-3 h-3 animate-spin" />
                                                      ) : (
                                                          <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                                                      )}
                                                  </Button>
                                              </div>
                                          ))}
                                      </div>
                                  </PopoverContent>
                              </Popover>
                          );
                      }
                      return null;
                  })()}
                  {invoice.document_url && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Open PDF"
                        onClick={() => window.open(invoice.document_url, '_blank')}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                    >
                        <FileText className="w-4 h-4" />
                    </Button>
                  )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncToOrderMutation.mutate(invoice)}
                      disabled={syncToOrderMutation.isPending}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Sync to Clinical Supply Order"
                    >
                      {syncToOrderMutation.isPending && syncToOrderMutation.variables?.id === invoice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                          <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditClick(invoice)}
                      className="text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                      title="Edit Invoice"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

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