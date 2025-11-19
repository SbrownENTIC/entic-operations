import React, { useState } from "react";
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
import { X, Plus, Trash2, Search, Check } from "lucide-react";

export default function SupplyRequestForm({ onSubmit, onCancel, isLoading, userLocation }) {
  const [formData, setFormData] = useState({
    location: userLocation || 'Glastonbury',
    requested_date: new Date().toISOString().split('T')[0],
    items: [],
    notes: ''
  });
  const [itemSelectOpen, setItemSelectOpen] = useState({});

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('product_name')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      alert('Please add at least one item to your request');
      return;
    }
    
    onSubmit(formData);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { supply_id: '', supply_name: '', quantity: 1, unit_price: 0, vendor: '' }]
    });
  };

  const selectSupply = (index, supply) => {
    const newItems = [...formData.items];
    newItems[index] = { 
      ...newItems[index], 
      supply_id: supply.id,
      supply_name: supply.product_name,
      unit_price: supply.unit_price || 0,
      vendor: supply.vendor || 'Staples'
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

  const estimatedTotal = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>New Supply Request</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
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
              <Label htmlFor="requested_date">Request Date</Label>
              <Input
                id="requested_date"
                type="date"
                value={formData.requested_date}
                onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
                disabled
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Requested Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
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
                        min="1"
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-600">Unit Price</Label>
                      <div className="h-10 px-3 py-2 bg-slate-50 rounded-md border border-slate-200 flex items-center text-slate-600">
                        ${(item.unit_price || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-600">Subtotal</Label>
                      <div className="h-10 px-3 py-2 bg-slate-50 rounded-md border border-slate-200 flex items-center font-medium text-slate-900">
                        ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
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
              {formData.items.length === 0 && (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-300 rounded-lg">
                  No items added yet. Click "Add Item" to start your request.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-slate-900">Estimated Total:</span>
              <span className="text-2xl font-bold text-blue-600">
                ${estimatedTotal.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500">*This is an estimate. Actual prices may vary.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Special Instructions</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Any special instructions or notes about your request..."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || formData.items.length === 0} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}