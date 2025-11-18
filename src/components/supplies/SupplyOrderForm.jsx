import React, { useState, useEffect } from "react";
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
import { X, Plus, Trash2, Search, Check, CheckSquare } from "lucide-react";

export default function SupplyOrderForm({ order, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    order_number: '',
    vendor: 'Staples',
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
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('product_name')
  });

  useEffect(() => {
    if (order) {
      setFormData(order);
    }
  }, [order]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
    const total = subtotal + (formData.tax || 0);
    
    // Auto-update status based on received items
    const receivedCount = formData.items.filter(item => item.received).length;
    const totalItems = formData.items.length;
    let status = formData.status;
    
    if (totalItems > 0) {
      if (receivedCount === 0) {
        status = 'order_placed';
      } else if (receivedCount === totalItems) {
        status = 'received';
      } else {
        status = 'partially_received';
      }
    }
    
    onSubmit({ ...formData, subtotal, total_amount: total, status });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { supply_id: '', supply_name: '', quantity: 1, unit_price: 0, received: false }]
    });
  };

  const selectSupply = (index, supply) => {
    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      supply_id: supply.id,
      supply_name: supply.product_name,
      unit_price: supply.unit_price || 0,
      received: newItems[index].received || false
    };
    setFormData({ ...formData, items: newItems });
    setItemSelectOpen({ ...itemSelectOpen, [index]: false });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{order ? 'Edit Order' : 'New Supply Order'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
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
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Select value={formData.vendor} onValueChange={(value) => setFormData({ ...formData, vendor: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Staples">Staples</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New Location field */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glastonbury">Glastonbury</SelectItem>
                  <SelectItem value="Manchester">Manchester</SelectItem>
                  <SelectItem value="Bloomfield">Bloomfield</SelectItem>
                  <SelectItem value="Farmington">Farmington</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs text-slate-600">Item/Product</Label>
                      <Popover open={itemSelectOpen[index]} onOpenChange={(open) => setItemSelectOpen({ ...itemSelectOpen, [index]: open })}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal h-auto min-h-[40px] whitespace-normal text-left py-2"
                          >
                            <span className="break-words pr-2 flex-1">{item.supply_name || "Select item..."}</span>
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
                onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
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
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
  );
}