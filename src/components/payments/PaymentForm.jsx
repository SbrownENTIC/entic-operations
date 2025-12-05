import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InvoiceForm from "../invoices/InvoiceForm";
import { useFormState } from "@/components/FormContext";

export default function PaymentForm({ payment, invoices, providers, onSubmit, onCancel, isLoading }) {
  const { setIsDirty } = useFormState();
  const [formData, setFormData] = useState({
    payment_date: payment?.payment_date || format(new Date(), 'yyyy-MM-dd'),
    payment_month: payment?.payment_month || '',
    total_amount: payment?.total_amount || 0,
    payment_method: payment?.payment_method || 'check',
    reference_number: payment?.reference_number || '',
    payer: payment?.payer || '',
    allocations: payment?.allocations || [],
    status: payment?.status || 'pending',
    notes: payment?.notes || ''
  });

  const [openComboboxes, setOpenComboboxes] = useState({});
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [currentAllocationIndex, setCurrentAllocationIndex] = useState(null);
  
  // Bulk selection state
  const [showBulkSelect, setShowBulkSelect] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [selectedBulkInvoices, setSelectedBulkInvoices] = useState(new Set());
  
  const queryClient = useQueryClient();

  const payerOptions = [
    'St. Francis',
    'Manchester / ECHN',
    'UConn',
    'CCMC',
    'Bloomfield',
    'CTSC- CT Surgery Center',
    'Hartford Hospital'
  ];

  // Fetch outside income for the invoice form
  const { data: incomes = [] } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list()
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data) => {
      const invoice = await base44.entities.Invoice.create(data);
      
      // Update outside income records with invoice_id and invoice_month
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: invoice.id,
            invoice_month: data.month || '',
            status: 'invoiced'
          });
        }
      }
      
      return invoice;
    },
    onSuccess: (newInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      
      // Auto-select the newly created invoice for the allocation
      if (currentAllocationIndex !== null) {
        updateAllocation(currentAllocationIndex, 'invoice_id', newInvoice.id);
      }
      
      setShowInvoiceForm(false);
      setCurrentAllocationIndex(null);
    }
  });

  useEffect(() => {
    if (payment) {
      setFormData(payment);
    }
  }, [payment]);



  // Auto-calculate payment_month from allocations
  useEffect(() => {
    if (formData.allocations && formData.allocations.length > 0) {
      const months = new Set();
      formData.allocations.forEach(allocation => {
        if (allocation.invoice_id) {
          const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
          if (invoice && invoice.month) {
            months.add(invoice.month);
          }
        }
      });
      const paymentMonth = Array.from(months).sort().join(', ');
      if (paymentMonth !== formData.payment_month) {
        setFormData(prev => ({ ...prev, payment_month: paymentMonth }));
      }
    } else if (formData.payment_month !== '') {
        setFormData(prev => ({ ...prev, payment_month: '' }));
    }
  }, [formData.allocations, invoices, formData.payment_month]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsDirty(false);
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
    
    // If updating invoice_id, auto-populate provider, amount, and payment notes
    if (field === 'invoice_id') {
      const invoice = invoices.find(inv => inv.id === value);
      if (invoice) {
        // Calculate the invoice's remaining balance
        const invoiceBalance = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);
        
        newAllocations[index] = { 
          ...newAllocations[index], 
          invoice_id: value,
          provider_id: invoice.staff_member_id || '',
          amount: parseFloat(invoiceBalance) || 0
        };
        
        // Auto-add invoice notes to payment notes if invoice has notes
        if (invoice.notes && invoice.notes.trim()) {
          const invoiceIdentifier = invoice.invoice_number || `Invoice ${index + 1}`;
          const noteToAdd = `${invoiceIdentifier}: ${invoice.notes}`;
          
          // Check if this note is already in the payment notes
          const currentNotes = formData.notes || '';
          if (!currentNotes.includes(noteToAdd)) {
            const updatedNotes = currentNotes 
              ? `${currentNotes}\n${noteToAdd}` 
              : noteToAdd;
            
            setFormData(prev => ({ 
              ...prev, 
              allocations: newAllocations,
              notes: updatedNotes 
            }));
            return; // Exit early since we're updating formData here
          }
        }
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

  const handleCreateNewInvoice = (index) => {
    setCurrentAllocationIndex(index);
    setShowInvoiceForm(true);
    toggleCombobox(index, false);
  };

  const handleInvoiceSubmit = (data) => {
    createInvoiceMutation.mutate(data);
  };

  // Bulk selection handlers
  const handleBulkSelectOpen = () => {
    setSelectedBulkInvoices(new Set());
    setBulkSearchTerm("");
    setShowBulkSelect(true);
  };

  const toggleBulkInvoice = (invoiceId) => {
    const newSelected = new Set(selectedBulkInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedBulkInvoices(newSelected);
  };

  const handleBulkAdd = () => {
    const newAllocations = [...formData.allocations];
    
    // Remove empty initial allocation if it exists and we are adding bulk items
    if (newAllocations.length === 1 && !newAllocations[0].invoice_id && selectedBulkInvoices.size > 0) {
      newAllocations.pop();
    }

    selectedBulkInvoices.forEach(invoiceId => {
      // Check if already added to avoid duplicates
      if (newAllocations.some(a => a.invoice_id === invoiceId)) return;

      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const invoiceBalance = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);
        
        newAllocations.push({
          invoice_id: invoiceId,
          provider_id: invoice.staff_member_id || '',
          amount: parseFloat(invoiceBalance) || 0,
          notes: ''
        });

        // Add notes logic similar to updateAllocation
        if (invoice.notes && invoice.notes.trim()) {
          const invoiceIdentifier = invoice.invoice_number || `Invoice`;
          const noteToAdd = `${invoiceIdentifier}: ${invoice.notes}`;
          const currentNotes = formData.notes || '';
          if (!currentNotes.includes(noteToAdd)) {
            setFormData(prev => ({ 
              ...prev, 
              notes: currentNotes ? `${currentNotes}\n${noteToAdd}` : noteToAdd 
            }));
          }
        }
      }
    });

    setFormData(prev => ({ ...prev, allocations: newAllocations }));
    setShowBulkSelect(false);
  };

  const totalAllocated = formData.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const unallocated = (formData.total_amount || 0) - totalAllocated;

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle>{payment ? 'Edit Payment' : 'Record New Payment'}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto">
            <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Month (Auto-populated)
                </label>
                <Input
                  type="text"
                  value={formData.payment_month}
                  readOnly
                  disabled
                  placeholder="Will be set from invoice allocations"
                  className="bg-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">Automatically set from invoice months</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payer *
                </label>
                <Select
                  value={formData.payer}
                  onValueChange={(value) => setFormData({ ...formData, payer: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {payerOptions.map(payer => (
                      <SelectItem key={payer} value={payer}>
                        {payer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Total Amount *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Payment Method *
                </label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
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

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Reference Number
                </label>
                <Input
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Check number or transaction ID"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                    <SelectItem value="entic_paid">ENTIC Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-6">
                <div>
                  <Label>Payment Allocations</Label>
                  <p className="text-sm text-slate-500 mt-1">
                    Unallocated: <span className={unallocated < 0 ? "text-red-600 font-medium" : unallocated === 0 ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
                      ${unallocated.toFixed(2)}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleBulkSelectOpen} className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700">
                    <Search className="w-4 h-4 mr-2" />
                    Bulk Add
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addAllocation}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Allocation
                  </Button>
                </div>
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
                                <CommandEmpty>
                                  <div className="p-4 text-center">
                                    <p className="text-sm text-slate-500 mb-3">No invoice found.</p>
                                    <Button
                                      type="button"
                                      onClick={() => handleCreateNewInvoice(index)}
                                      className="bg-blue-600 hover:bg-blue-700"
                                      size="sm"
                                    >
                                      <Plus className="w-4 h-4 mr-2" />
                                      Create New Invoice
                                    </Button>
                                  </div>
                                </CommandEmpty>
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
                                            <span className="text-xs text-slate-500 ml-2">Balance: ${balance.toFixed(2)}</span>
                                          </div>
                                          {invoice.status && (
                                            <span className="text-xs text-slate-500 capitalize">{invoice.status.replace(/_/g, ' ')}</span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                                {invoices.length > 0 && (
                                  <div className="border-t p-2">
                                    <Button
                                      type="button"
                                      onClick={() => handleCreateNewInvoice(index)}
                                      variant="ghost"
                                      className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      size="sm"
                                    >
                                      <Plus className="w-4 h-4 mr-2" />
                                      Create New Invoice
                                    </Button>
                                  </div>
                                )}
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
                          {selectedInvoice && (
                            <p className="text-xs text-slate-500 mt-1">
                              Invoice balance: ${((selectedInvoice.amount_expected || selectedInvoice.total || 0) - (selectedInvoice.amount_received || 0)).toFixed(2)}
                            </p>
                          )}
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

            <div className="space-y-2 mt-6">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Payment Notes
                <span className="text-xs text-slate-500 ml-2">(Auto-populated from invoice notes)</span>
              </label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
              />
            </div>
            </CardContent>
          </div>
          <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3 bg-white">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Saving...' : payment ? 'Update Payment' : 'Record Payment'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Invoice Creation Modal */}
      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={null}
            incomes={incomes}
            preselectedIncomes={[]}
            onSubmit={handleInvoiceSubmit}
            onCancel={() => {
              setShowInvoiceForm(false);
              setCurrentAllocationIndex(null);
            }}
            isLoading={createInvoiceMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Selection Modal */}
      <Dialog open={showBulkSelect} onOpenChange={setShowBulkSelect}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Invoices to Allocate</DialogTitle>
          </DialogHeader>
          
          <div className="p-1">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-slate-500" />
              <Input 
                placeholder="Search by invoice #, provider, program..." 
                value={bulkSearchTerm}
                onChange={(e) => setBulkSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="border rounded-md overflow-hidden flex-1 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b sticky top-0">
                  <tr>
                    <th className="p-3 w-10">
                      {/* Select All could be implemented here if needed */}
                    </th>
                    <th className="p-3 text-left font-medium text-slate-700">Invoice #</th>
                    <th className="p-3 text-left font-medium text-slate-700">Program</th>
                    <th className="p-3 text-left font-medium text-slate-700">Provider</th>
                    <th className="p-3 text-left font-medium text-slate-700">Date</th>
                    <th className="p-3 text-right font-medium text-slate-700">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter(inv => {
                      // Filter out already allocated (unless we want to allow selecting again, but usually not)
                      // Actually, user might want to select multiple, filtering out those already in formData.allocations is good UX
                      if (formData.allocations.some(a => a.invoice_id === inv.id)) return false;

                      // Filter by balance > 0 (optional, but makes sense for new allocations)
                      const balance = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
                      if (balance <= 0.01) return false;

                      // Search filter
                      if (!bulkSearchTerm) return true;
                      const term = bulkSearchTerm.toLowerCase();
                      const provider = providers.find(p => p.id === inv.staff_member_id);
                      const providerName = provider?.full_name || '';
                      
                      return (
                        (inv.invoice_number || '').toLowerCase().includes(term) ||
                        (inv.program_group || '').toLowerCase().includes(term) ||
                        providerName.toLowerCase().includes(term) ||
                        (inv.month || '').toLowerCase().includes(term)
                      );
                    })
                    .map(invoice => {
                      const provider = providers.find(p => p.id === invoice.staff_member_id);
                      const balance = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);
                      
                      return (
                        <tr 
                          key={invoice.id} 
                          className={`border-b hover:bg-slate-50 cursor-pointer ${selectedBulkInvoices.has(invoice.id) ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleBulkInvoice(invoice.id)}
                        >
                          <td className="p-3">
                            <Checkbox 
                              checked={selectedBulkInvoices.has(invoice.id)}
                              onCheckedChange={() => toggleBulkInvoice(invoice.id)}
                            />
                          </td>
                          <td className="p-3 font-medium">{invoice.invoice_number || '-'}</td>
                          <td className="p-3 text-slate-600">{invoice.program_group}</td>
                          <td className="p-3 text-slate-600">{provider?.full_name || '-'}</td>
                          <td className="p-3 text-slate-600">{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MM/dd/yyyy') : '-'}</td>
                          <td className="p-3 text-right font-medium text-green-600">${balance.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">No invoices found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center mt-4">
            <div className="text-sm text-slate-500">
              {selectedBulkInvoices.size} invoices selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkSelect(false)}>Cancel</Button>
              <Button onClick={handleBulkAdd} className="bg-blue-600 hover:bg-blue-700" disabled={selectedBulkInvoices.size === 0}>
                Add Selected Invoices
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}