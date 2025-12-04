import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Trash2, Plus, Check, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function VendorInvoiceReviewForm({ invoice, supplies = [], onSave, onApprove, onReject, isSaving }) {
  const [formData, setFormData] = useState({
    vendor_name: "",
    invoice_number: "",
    invoice_date: "",
    due_date: "",
    total_amount: "",
    notes: "",
    extracted_data: { line_items: [] }
  });

  useEffect(() => {
    if (invoice) {
      // Check for catalog matches when invoice loads
      const lineItems = invoice.extracted_data?.line_items || [];
      
      setFormData({
        vendor_name: invoice.vendor_name || "",
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        due_date: invoice.due_date || "",
        total_amount: invoice.total_amount || 0,
        notes: invoice.notes || "",
        extracted_data: invoice.extracted_data || { line_items: [] }
      });
    }
  }, [invoice]);

  // Helper to check catalog status
  const checkCatalogStatus = (itemCode) => {
    if (!itemCode) return { found: false, supply: null };
    const supply = supplies.find(s => s.item_number === itemCode);
    return { found: !!supply, supply };
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    const newLineItems = [...(formData.extracted_data.line_items || [])];
    newLineItems[index] = { ...newLineItems[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      extracted_data: { ...prev.extracted_data, line_items: newLineItems }
    }));
  };

  const removeLineItem = (index) => {
    const newLineItems = (formData.extracted_data.line_items || []).filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      extracted_data: { ...prev.extracted_data, line_items: newLineItems }
    }));
  };

  const addLineItem = () => {
    const newLineItems = [...(formData.extracted_data.line_items || []), { description: "", quantity: 1, unit_price: 0, total_price: 0 }];
    setFormData(prev => ({
      ...prev,
      extracted_data: { ...prev.extracted_data, line_items: newLineItems }
    }));
  };

  const handleSave = () => {
    // Auto-populate notes for missing items before saving
    const updatedLineItems = (formData.extracted_data?.line_items || []).map(item => {
      const { found } = checkCatalogStatus(item.item_code);
      // If item is not in catalog and has no notes, add the ordering note
      if (!found && item.item_code && !item.notes) {
        return {
          ...item,
          notes: `Item ${item.item_code} needs to be ordered (${item.quantity} units)`
        };
      }
      return item;
    });

    const updatedFormData = {
      ...formData,
      extracted_data: {
        ...formData.extracted_data,
        line_items: updatedLineItems
      }
    };

    onSave(updatedFormData);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Actions */}
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-2 border-b mb-4">
        <h2 className="text-lg font-semibold">Invoice Details</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vendor Name</Label>
          <Input 
            value={formData.vendor_name} 
            onChange={(e) => handleChange('vendor_name', e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Invoice Number</Label>
          <Input 
            value={formData.invoice_number} 
            onChange={(e) => handleChange('invoice_number', e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Invoice Date</Label>
          <Input 
            type="date" 
            value={formData.invoice_date} 
            onChange={(e) => handleChange('invoice_date', e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input 
            type="date" 
            value={formData.due_date} 
            onChange={(e) => handleChange('due_date', e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Total Amount</Label>
          <Input 
            type="number" 
            step="0.01"
            value={formData.total_amount} 
            onChange={(e) => handleChange('total_amount', parseFloat(e.target.value))} 
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <div>
            <Badge variant="outline" className="capitalize">{invoice.status?.replace('_', ' ')}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input 
          value={formData.notes} 
          onChange={(e) => handleChange('notes', e.target.value)} 
          placeholder="Internal notes..." 
        />
      </div>

      <Separator />

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Line Items ({formData.extracted_data?.line_items?.length || 0})</h3>
          <Button variant="ghost" size="sm" onClick={addLineItem}>
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {(formData.extracted_data?.line_items || []).map((item, index) => {
            const { found, supply } = checkCatalogStatus(item.item_code);
            
            return (
              <Card key={index} className={`p-3 ${found ? 'bg-slate-50' : 'bg-amber-50 border-amber-200'}`}>
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs flex items-center gap-2">
                      Description
                      {!found && item.item_code && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Not in Catalog
                        </Badge>
                      )}
                      {found && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Matched: {supply.product_name}
                        </Badge>
                      )}
                    </Label>
                    <Input 
                      className="h-8 text-sm"
                      value={item.description} 
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)} 
                    />
                    <div className="flex gap-2">
                      <Input 
                        className="h-8 text-xs text-slate-500" 
                        placeholder="Item Code"
                        value={item.item_code || ""} 
                        onChange={(e) => handleLineItemChange(index, 'item_code', e.target.value)} 
                      />
                    </div>
                    {/* Auto-generated ordering note for missing items */}
                    {!found && item.item_code && (
                       <div className="text-xs text-amber-700 italic mt-1">
                         Note: Item {item.item_code} needs to be ordered ({item.quantity} units)
                       </div>
                    )}
                    <div className="pt-1">
                         <Label className="text-[10px] text-slate-500">Item Notes</Label>
                         <Input 
                            className="h-7 text-xs" 
                            placeholder="Add notes..."
                            value={item.notes || ""} 
                            onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)} 
                          />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input 
                      type="number"
                      className="h-8 text-sm"
                      value={item.quantity} 
                      onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value))} 
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Price</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      className="h-8 text-sm"
                      value={item.unit_price} 
                      onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value))} 
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Total</Label>
                    <div className="h-8 flex items-center text-sm font-medium px-2">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end pt-5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => removeLineItem(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 right-0 left-0 bg-white border-t p-4 flex justify-end gap-3 shadow-lg md:left-[50%]">
        <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={onReject}>
           <AlertCircle className="w-4 h-4 mr-2" /> Reject Invoice
        </Button>
        <Button className="bg-green-600 hover:bg-green-700" onClick={onApprove}>
           <Check className="w-4 h-4 mr-2" /> Approve & Process
        </Button>
      </div>
    </div>
  );
}