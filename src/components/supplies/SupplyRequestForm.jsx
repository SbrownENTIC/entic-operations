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
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Search and Add Items</Label>
                <Popover open={itemSelectOpen['main']} onOpenChange={(open) => setItemSelectOpen({ ...itemSelectOpen, 'main': open })}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                    >
                      <span>Search supplies to add...</span>
                      <Search className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search supplies..." />
                      <CommandEmpty>No supply found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {supplies.map((supply) => {
                          const alreadyAdded = formData.items.some(item => item.supply_id === supply.id);
                          return (
                            <CommandItem
                              key={supply.id}
                              value={`${supply.item_number || ''} ${supply.product_name}`}
                              onSelect={() => {
                                if (!alreadyAdded) {
                                  setFormData(prev => ({
                                    ...prev,
                                    items: [...prev.items, {
                                      supply_id: supply.id,
                                      supply_name: supply.product_name,
                                      quantity: 1,
                                      unit_price: supply.unit_price || 0,
                                      vendor: supply.vendor || 'Staples'
                                    }]
                                  }));
                                }
                              }}
                              className="flex items-start"
                              disabled={alreadyAdded}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 flex-shrink-0 mt-0.5 ${
                                  alreadyAdded ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="break-words">{supply.product_name}</span>
                                <span className="text-xs text-slate-500">
                                  {supply.item_number && `Item# ${supply.item_number}`}
                                  {supply.vendor && ` • ${supply.vendor}`}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {formData.items.length > 0 && (
                <div>
                  <Label className="mb-2 block">Selected Items ({formData.items.length})</Label>
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.supply_name}</p>
                          {item.vendor && <p className="text-sm text-slate-500">{item.vendor}</p>}
                        </div>
                        <div className="w-24">
                          <Label className="text-xs text-slate-600">Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            min="1"
                            required
                            className="mt-1"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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