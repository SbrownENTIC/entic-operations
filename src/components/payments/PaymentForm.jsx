import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";

export default function PaymentForm({ payment, invoices, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    payment_date: '',
    amount: 0,
    payment_method: 'check',
    reference_number: '',
    payer: '',
    allocations: [],
    status: 'pending',
    notes: ''
  });

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
      allocations: [...formData.allocations, { invoice_id: '', provider_id: '', amount: 0 }]
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
        // Calculate balance: amount_expected - amount_received
        const amountExpected = parseFloat(invoice.amount_expected) || 0;
        const amountReceived = parseFloat(invoice.amount_received) || 0;
        const balance = amountExpected - amountReceived;
        
        newAllocations[index] = { 
          ...newAllocations[index], 
          invoice_id: value,
          provider_id: invoice.staff_member_id || '',
          amount: balance > 0 ? balance : 0
        };
      } else {
        newAllocations[index] = { ...newAllocations[index], [field]: value };
      }
    } else {
      newAllocations[index] = { ...newAllocations[index], [field]: value };
    }
    
    setFormData({ ...formData, allocations: newAllocations });
  };

  const totalAllocated = formData.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const unallocated = (formData.amount || 0) - totalAllocated;

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
              <Label htmlFor="amount">Total Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payer">Payer *</Label>
              <Input
                id="payer"
                value={formData.payer}
                onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                required
              />
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
                  Unallocated: <span className={unallocated < 0 ? "text-red-600 font-medium" : "text-slate-700 font-medium"}>
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
                  <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="col-span-5">
                      <Label className="text-xs">Invoice</Label>
                      <Select 
                        value={allocation.invoice_id} 
                        onValueChange={(value) => updateAllocation(index, 'invoice_id', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoices.filter(inv => inv.status !== 'paid').map(invoice => {
                            const provider = providers.find(p => p.id === invoice.staff_member_id);
                            const providerName = provider?.full_name || 'Unknown';
                            const displayText = `${invoice.invoice_number || 'N/A'} - ${invoice.program_group || 'N/A'}${invoice.month ? ` (${invoice.month})` : ''} - ${providerName}`;
                            return (
                              <SelectItem key={invoice.id} value={invoice.id}>
                                {displayText}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
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
                );
              })}
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
            {isLoading ? 'Saving...' : payment ? 'Update Payment' : 'Record Payment'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}