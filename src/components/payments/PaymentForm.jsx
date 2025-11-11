import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function PaymentForm({ payment, invoices, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    payment_method: 'check',
    reference_number: '',
    payer: '',
    allocations: [],
    status: 'pending',
    notes: ''
  });

  const [openComboboxes, setOpenComboboxes] = useState({});

  useEffect(() => {
    if (payment) {
      setFormData(payment);
    }
  }, [payment]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addAllocation = () => {
    setFormData({
      ...formData,
      allocations: [...formData.allocations, { invoice_id: '', provider_id: '', amount: 0, notes: '' }]
    });
  };

  const removeAllocation = (index) => {
    setFormData({
      ...formData,
      allocations: formData.allocations.filter((_, i) => i !== index)
    });
  };

  const updateAllocation = (index, field, value) => {
    const newAllocations = [...formData.allocations];
    
    // If updating invoice_id, auto-populate provider and amount
    if (field === 'invoice_id') {
      const invoice = invoices.find(inv => inv.id === value);
      if (invoice) {
        newAllocations[index] = { 
          ...newAllocations[index], 
          invoice_id: value,
          provider_id: invoice.staff_member_id || '',
          amount: parseFloat(invoice.amount_expected || invoice.total) || 0
        };
      } else {
        newAllocations[index] = { ...newAllocations[index], [field]: value };
      }
    } else {
      newAllocations[index] = { ...newAllocations[index], [field]: value };
    }
    
    setFormData({ ...formData, allocations: newAllocations });
  };

  const toggleCombobox = (index, isOpen) => {
    setOpenComboboxes(prev => ({ ...prev, [index]: isOpen }));
  };

  const totalAllocated = formData.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const unallocated = (formData.total_amount || 0) - totalAllocated;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{payment ? 'Edit Payment' : 'Record New Payment'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount *</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payer">Payer *</Label>
              <Select value={formData.payer} onValueChange={(value) => setFormData({ ...formData, payer: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="St. Francis">St. Francis</SelectItem>
                  <SelectItem value="UConn">UConn</SelectItem>
                  <SelectItem value="Manchester / ECHN">Manchester / ECHN</SelectItem>
                  <SelectItem value="Hartford Hospital">Hartford Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Check # or transaction ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label>Payment Allocations</Label>
                <p className="text-sm text-slate-500 mt-1">
                  Unallocated: <span className={unallocated < 0 ? "text-red-600 font-medium" : unallocated === 0 ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                    ${unallocated.toFixed(2)}
                  </span>
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="w-4 h-4 mr-2" />
                Add Allocation
              </Button>
            </div>
            
            <div className="space-y-3">
              {formData.allocations.map((allocation, index) => {
                const selectedInvoice = invoices.find(inv => inv.id === allocation.invoice_id);
                const selectedProvider = providers.find(p => p.id === allocation.provider_id);
                
                return (
                  <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <Label className="text-xs">Invoice</Label>
                        <Popover open={openComboboxes[index]} onOpenChange={(open) => toggleCombobox(index, open)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between mt-1 h-10 text-left font-normal"
                            >
                              {selectedInvoice ? (
                                <span className="truncate">
                                  {selectedInvoice.invoice_number || 'N/A'} - {selectedInvoice.program_group || 'N/A'}
                                </span>
                              ) : (
                                <span className="text-slate-500">Search invoice...</span>
                              )}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search by invoice #, program, provider..." className="h-9" />
                              <CommandEmpty>No invoice found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {invoices.map(invoice => {
                                  const provider = providers.find(p => p.id === invoice.staff_member_id);
                                  const providerName = provider?.full_name || 'Unknown';
                                  const balance = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);
                                  const displayText = `${invoice.invoice_number || 'N/A'} - ${invoice.program_group || 'N/A'}${invoice.month ? ` (${invoice.month})` : ''} - ${providerName}`;
                                  
                                  return (
                                    <CommandItem
                                      key={invoice.id}
                                      value={`${invoice.invoice_number} ${invoice.program_group} ${invoice.month} ${providerName}`}
                                      onSelect={() => {
                                        updateAllocation(index, 'invoice_id', invoice.id);
                                        toggleCombobox(index, false);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex flex-col w-full">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">{displayText}</span>
                                          <span className="text-xs text-slate-500 ml-2">${balance.toFixed(2)}</span>
                                        </div>
                                        {invoice.status && (
                                          <span className="text-xs text-slate-500 capitalize">{invoice.status.replace(/_/g, ' ')}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="col-span-3">
                        <Label className="text-xs">Provider</Label>
                        <Input
                          className="mt-1 bg-slate-100"
                          value={selectedProvider?.full_name || 'Select invoice first'}
                          readOnly
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="mt-1"
                          value={allocation.amount || 0}
                          onChange={(e) => updateAllocation(index, 'amount', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeAllocation(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Allocation Notes</Label>
                      <Input
                        className="mt-1"
                        placeholder="Optional notes for this allocation"
                        value={allocation.notes || ''}
                        onChange={(e) => updateAllocation(index, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Payment Notes</Label>
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
            {isLoading ? 'Saving...' : payment ? 'Update Payment' : 'Record Payment'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}