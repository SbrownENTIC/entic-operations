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
import { Plus, Trash2, Search, Check, CheckCircle, AlertCircle } from "lucide-react";

export default function PublicSupplyRequest() {
  const [formData, setFormData] = useState({
    location: 'Glastonbury',
    requester_name: '',
    requester_email: '',
    requested_date: new Date().toISOString().split('T')[0],
    items: [],
    notes: ''
  });
  const [itemSelectOpen, setItemSelectOpen] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(''); // 'success' or 'error'

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('product_name')
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      setSubmitStatus('error');
      setSubmitMessage('Please add at least one item to your request');
      return;
    }

    if (!formData.requester_name || !formData.requester_email) {
      setSubmitStatus('error');
      setSubmitMessage('Please provide your name and email');
      return;
    }

    setSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await base44.functions.invoke('processSupplyRequest', formData);
      setSubmitStatus('success');
      setSubmitMessage(response.data.message || 'Request submitted successfully!');
      
      // Reset form
      setFormData({
        location: 'Glastonbury',
        requester_name: '',
        requester_email: '',
        requested_date: new Date().toISOString().split('T')[0],
        items: [],
        notes: ''
      });
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Supply Request Form</h1>
          <p className="text-slate-600 mt-2">Request supplies for your location</p>
        </div>

        {submitMessage && (
          <Card className={`border ${submitStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <CardContent className="p-4 flex items-start gap-3">
              {submitStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <p className={`text-sm flex-1 ${submitStatus === 'error' ? 'text-red-900' : 'text-green-900'}`}>
                {submitMessage}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="requester_name">Your Name *</Label>
                  <Input
                    id="requester_name"
                    value={formData.requester_name}
                    onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requester_email">Your Email *</Label>
                  <Input
                    id="requester_email"
                    type="email"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

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
                        <div className="col-span-10 space-y-1">
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
                            <PopoverContent className="w-96 p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search supplies..." />
                                <CommandEmpty>No supply found.</CommandEmpty>
                                <CommandGroup className="max-h-96 overflow-auto">
                                  {supplies.map((supply) => (
                                    <CommandItem
                                      key={supply.id}
                                      value={`${supply.item_number || ''} ${supply.product_name}`}
                                      onSelect={() => selectSupply(index, supply)}
                                      className="flex items-start gap-3 py-2"
                                    >
                                      {supply.image_url ? (
                                        <img 
                                          src={supply.image_url} 
                                          alt={supply.product_name}
                                          className="w-12 h-12 object-contain rounded border border-slate-200 flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex-shrink-0" />
                                      )}
                                      <Check
                                        className={`mr-2 h-4 w-4 flex-shrink-0 mt-0.5 ${
                                          item.supply_id === supply.id ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <span className="break-words font-medium">{supply.product_name}</span>
                                        <span className="text-xs text-slate-500">
                                          {supply.item_number && `Item# ${supply.item_number}`}
                                          {supply.vendor && ` • ${supply.vendor}`}
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
                          <Label className="text-xs text-slate-600">Qty</Label>
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            min="1"
                            required
                          />
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
            <CardFooter className="border-t border-slate-100 p-6 flex justify-end">
              <Button 
                type="submit" 
                disabled={submitting || formData.items.length === 0} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}