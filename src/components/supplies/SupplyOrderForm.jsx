import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Trash2, Search, Check, CheckSquare, Printer } from "lucide-react";
import { useFormState } from "@/components/FormContext";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { formatDateToEST as formatDate } from "@/components/DateUtils";

export default function SupplyOrderForm({ order, category, onSubmit, onCancel, isLoading }) {
  const { setIsDirty } = useFormState();
  const printRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [formData, setFormData] = useState({
    order_number: '',
    vendor: category === 'clinical' ? 'Henry Schein' : category === 'audiology' ? 'Oaktree Products' : 'Staples Business',
    location: 'Glastonbury',
    order_date: '',
    status: 'order_placed',
    subtotal: 0,
    tax: 0,
    total_amount: 0,
    items: [],
    notes: ''
  });
  const [itemSelectOpen, setItemSelectOpen] = useState({});

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies', category],
    queryFn: () => category 
      ? base44.entities.Supply.filter({ category }) 
      : base44.entities.Supply.list('product_name')
  });

  useEffect(() => {
    if (order) {
      setFormData({
        ...order,
        items: order.items || []
      });
    }
  }, [order]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate: every item must have an item_number
    const missingItemNumber = formData.items.some(item => !item.item_number || item.item_number.trim() === "");
    if (missingItemNumber) {
      alert("All order line items must have an Item #. Please select products from the catalog or enter an Item # before saving.");
      return;
    }

    setIsDirty(false);
    const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const total = subtotal + (formData.tax || 0);
    
    // Only auto-update status based on received items if order is already in order_placed/partially_received/received state
    const receivedCount = formData.items.filter(item => item.received).length;
    const totalItems = formData.items.length;
    let status = formData.status;
    
    const receivedStatuses = ['order_placed', 'partially_received', 'received'];
    if (totalItems > 0 && receivedStatuses.includes(formData.status)) {
      if (receivedCount === totalItems) {
        status = 'received';
      } else if (receivedCount > 0) {
        status = 'partially_received';
      }
      // If receivedCount === 0, keep the current status (don't force to order_placed)
    }
    
    onSubmit({ ...formData, subtotal, total_amount: total, status });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { supply_id: '', supply_name: '', quantity: 1, unit_price: 0, received: false }]
    });
    setIsDirty(true);
  };

  const selectSupply = (index, supply) => {
    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      supply_id: supply.id,
      supply_name: supply.product_name,
      item_number: supply.item_number,
      unit_price: supply.unit_price || 0,
      received: newItems[index].received || false
    };
    setFormData({ ...formData, items: newItems });
    setItemSelectOpen({ ...itemSelectOpen, [index]: false });
    setIsDirty(true);
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
    setIsDirty(true);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
    setIsDirty(true);
  };

  const handlePrintPDF = async () => {
    if (!printRef.current) return;
    
    setIsPrinting(true);
    
    // Wait a moment for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: 800,
        windowHeight: element.scrollHeight
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583));
      
      const finalWidth = imgWidth * 0.264583 * ratio;
      const finalHeight = imgHeight * 0.264583 * ratio;
      
      pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight);
      pdf.save(`supply-order-${formData.order_number || 'draft'}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF: ' + error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
  const total = subtotal + (formData.tax || 0);

  return (
    <>
      <div ref={printRef} className="bg-white" style={{ 
        position: isPrinting ? 'absolute' : 'fixed',
        left: isPrinting ? '0' : '-9999px',
        top: '0',
        width: '800px',
        padding: '40px',
        zIndex: isPrinting ? 9999 : -1
      }}>
        <div className="mb-8 text-center border-b-2 border-slate-300 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Supply Order Request</h1>
          <p className="text-lg text-slate-600">
            {category === 'clinical' ? 'Clinical' : category === 'audiology' ? 'Audiology' : 'Office'} Supplies
          </p>
        </div>
        
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-600 mb-1">Order Number</p>
            <p className="text-lg font-semibold text-slate-900">{formData.order_number || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">Vendor</p>
            <p className="text-lg font-semibold text-slate-900">{formData.vendor}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">Location</p>
            <p className="text-lg font-semibold text-slate-900">{formData.location}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-1">Order Date</p>
            <p className="text-lg font-semibold text-slate-900">
              {formData.order_date ? formatDate(formData.order_date) : 'N/A'}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-300 pb-2">Order Items</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="text-left p-3 text-sm font-semibold">Item #</th>
                <th className="text-left p-3 text-sm font-semibold">Product</th>
                <th className="text-left p-3 text-sm font-semibold">Lot #</th>
                <th className="text-right p-3 text-sm font-semibold">Qty</th>
                <th className="text-right p-3 text-sm font-semibold">Unit Price</th>
                <th className="text-right p-3 text-sm font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-3 text-sm">{item.item_number || '-'}</td>
                  <td className="p-3 text-sm">{item.supply_name}</td>
                  <td className="p-3 text-sm text-slate-600 font-mono">{item.lot_number || '-'}</td>
                  <td className="p-3 text-sm text-right">{item.quantity}</td>
                  <td className="p-3 text-sm text-right">${(item.unit_price || 0).toFixed(2)}</td>
                  <td className="p-3 text-sm text-right font-semibold">
                    ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-8 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between py-2 border-b border-slate-300">
              <span className="font-medium">Subtotal:</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-300">
              <span className="font-medium">Tax:</span>
              <span className="font-semibold">TBD</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-slate-900">
              <span className="text-lg font-bold">Total:</span>
              <span className="text-lg font-bold">${subtotal.toFixed(2)} + Tax</span>
            </div>
          </div>
        </div>

        {formData.notes && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-2 border-b border-slate-300 pb-2">Notes</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData.notes}</p>
          </div>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle>{order ? 'Edit Order' : 'New Supply Order'}</CardTitle>
            <div className="flex items-center gap-2">
              {order && (
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handlePrintPDF}
                  disabled={isPrinting}
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {isPrinting ? 'Generating...' : 'Print PDF'}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="order_number">Order Number</Label>
              <Input
                id="order_number"
                value={formData.order_number}
                onChange={(e) => handleChange('order_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={formData.vendor} onValueChange={(value) => handleChange('vendor', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Staples Business">Staples Business</SelectItem>
                  <SelectItem value="Henry Schein">Henry Schein</SelectItem>
                  <SelectItem value="Oaktree Products">Oaktree Products</SelectItem>
                  <SelectItem value="Grace Medical">Grace Medical</SelectItem>
                  <SelectItem value="Reliant Compounded Solutions">Reliant Compounded Solutions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New Location field */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select value={formData.location} onValueChange={(value) => handleChange('location', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glastonbury">Glastonbury</SelectItem>
                   <SelectItem value="Manchester">Manchester</SelectItem>
                   <SelectItem value="Bloomfield">Bloomfield</SelectItem>
                   <SelectItem value="Farmington">Farmington</SelectItem>
                   <SelectItem value="Waterside">Waterside</SelectItem>
                  </SelectContent>
                  </Select>
                  </div>

                  <div className="space-y-2">
                  <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => handleChange('order_date', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="pending_fulfillment">Pending Fulfillment</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="order_placed">Order Placed</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Order Items</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setFormData({ ...formData, status: 'order_placed' })}
                  className="gap-2"
                >
                  Mark Ordered
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const allReceived = formData.items.every(item => item.received);
                    const newItems = formData.items.map(item => ({ ...item, received: !allReceived }));
                    setFormData({ ...formData, items: newItems });
                  }}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  {formData.items.every(item => item.received) ? 'Unmark All' : 'Mark All Received'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs text-slate-600">Item/Product</Label>
                      <Popover open={itemSelectOpen[index]} onOpenChange={(open) => setItemSelectOpen({ ...itemSelectOpen, [index]: open })}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal h-auto min-h-[40px] whitespace-normal text-left py-2"
                          >
                            <div className="flex flex-col flex-1 pr-2">
                              <span className="break-words">{item.supply_name || "Select item..."}</span>
                              {item.item_number && (
                                <span className="text-xs text-slate-500">Item# {item.item_number}</span>
                              )}
                            </div>
                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search supplies..." />
                            <CommandEmpty>No supply found.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-auto">
                              {supplies.map((supply) => (
                                <CommandItem
                                  key={supply.id}
                                  value={`${supply.item_number || ''} ${supply.product_name}`}
                                  onSelect={() => selectSupply(index, supply)}
                                  className="flex items-start"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 flex-shrink-0 mt-0.5 ${
                                      item.supply_id === supply.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="break-words">{supply.product_name}</span>
                                    <span className="text-xs text-slate-500">
                                      {supply.item_number && `Item# ${supply.item_number} • `}{supply.vendor} - ${supply.unit_price?.toFixed(2) || '0.00'}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                        </Popover>
                        </div>
                        <div className="col-span-1 space-y-1">
                        <Label className="text-xs text-slate-600">Item # *</Label>
                        <Input
                          type="text"
                          placeholder="Required"
                          value={item.item_number || ''}
                          onChange={(e) => updateItem(index, 'item_number', e.target.value)}
                          className={`text-xs ${!item.item_number ? 'border-red-400 bg-red-50' : ''}`}
                        />
                        </div>
                        <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-slate-600">Quantity</Label>
                      <Input
                        type="number"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-600">Unit Price ($) <span className="text-slate-400 font-normal">(editable)</span></Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-600">Lot Number</Label>
                      <Input
                        type="text"
                        placeholder="Lot/Batch #"
                        value={item.lot_number || ''}
                        onChange={(e) => updateItem(index, 'lot_number', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-600">Subtotal</Label>
                      <div className="h-10 px-3 py-2 bg-slate-50 rounded-md border border-slate-200 flex items-center font-medium text-slate-900">
                        ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs text-slate-600">Received</Label>
                      <div className="h-10 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={item.received || false}
                          onChange={(e) => updateItem(index, 'received', e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs text-transparent">Del</Label>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-700">Subtotal:</span>
              <span className="text-lg font-semibold text-slate-900">
                ${(formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <Label htmlFor="tax" className="text-sm font-medium text-slate-700">Tax ($):</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.tax || ''}
                onChange={(e) => handleChange('tax', parseFloat(e.target.value) || 0)}
                className="w-32 text-right"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-300">
              <span className="text-base font-bold text-slate-900">Total:</span>
              <span className="text-2xl font-bold text-green-600">
                ${((formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0)) + (formData.tax || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : order ? 'Update Order' : 'Create Order'}
          </Button>
        </CardFooter>
      </form>
    </Card>
    </>
  );
}