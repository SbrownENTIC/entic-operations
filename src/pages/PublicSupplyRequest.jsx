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
import { Plus, Trash2, Search, Check, CheckCircle, AlertCircle, HeartPulse } from "lucide-react";

export default function PublicSupplyRequest() {
  const [formData, setFormData] = useState({
    location: '', // No default location - user must select
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

    if (!formData.location) {
      setSubmitStatus('error');
      setSubmitMessage('Please select a location');
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
        location: '',
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
          <div className="flex flex-col items-center gap-4 mb-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
              alt="ENTIC Logo" 
              className="h-16 w-auto"
            />
            <h1 className="text-3xl font-bold text-slate-900">Supply Request Form</h1>
          </div>
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
                  <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
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
                                  onSelect={(currentValue) => {
                                    if (!alreadyAdded) {
                                      setFormData(prev => ({
                                       ...prev,
                                       items: [...prev.items, {
                                         supply_id: supply.id,
                                         supply_name: supply.product_name,
                                         quantity: 1,
                                         unit_price: supply.unit_price || 0,
                                         item_number: supply.item_number || ''
                                       }]
                                      }));
                                    }
                                    // Don't close the popover - keep it open for multiple selections
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
                        {item.item_number && <p className="text-sm text-slate-500">Item# {item.item_number}</p>}
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