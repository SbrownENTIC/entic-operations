import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";

const INVOICE_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "draft", label: "Draft" },
  { value: "pending_providers_approval", label: "Pending Providers Approval" },
  { value: "pending_providers_time", label: "Pending Providers Time" },
  { value: "sent_for_approval", label: "Sent for Approval" },
  { value: "approved", label: "Approved" },
  { value: "sent_to_vendor", label: "Sent to Vendor" },
  { value: "paid_to_entic", label: "Paid to ENTIC" },
  { value: "provider_paid", label: "Provider Paid" }
];

export default function InvoiceForm({ invoice, incomes, preselectedIncomes = [], onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    program_group: '',
    staff_member_id: '',
    work_email: '',
    invoice_date: new Date().toISOString().split('T')[0],
    month: '',
    status: 'not_started',
    outside_income_ids: [],
    days_worked: 0,
    subtotal: 0,
    total: 0,
    amount_expected: 0,
    amount_received: 0,
    under_over_amount: 0,
    date_provider_paid: '',
    provider_paid: false,
    invoice_ready_to_send: false,
    invoice_sent_for_approval: false,
    invoice_sent_to_vendor: false,
    draft_invoice_url: '',
    approved_invoice_url: '',
    notes: ''
  });

  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [uploadingApproved, setUploadingApproved] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list()
  });

  // Get unique program groups
  const programGroups = [...new Set(programLocations.map(pl => pl.program_group).filter(Boolean))].sort();

  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    } else if (preselectedIncomes.length > 0) {
      const selectedIncomes = incomes.filter(inc => preselectedIncomes.includes(inc.id));
      const totalDays = selectedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
      const totalAmount = selectedIncomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0);
      
      // Auto-populate program group and staff member from first selected income
      const firstIncome = selectedIncomes[0];
      let programGroup = '';
      let staffMemberId = firstIncome?.provider_id || '';
      
      if (firstIncome?.program_location_id) {
        const programLocation = programLocations.find(pl => pl.id === firstIncome.program_location_id);
        if (programLocation) {
          programGroup = programLocation.program_group || '';
        }
      }
      
      setFormData(prev => ({
        ...prev,
        outside_income_ids: preselectedIncomes,
        program_group: programGroup,
        staff_member_id: staffMemberId,
        days_worked: totalDays,
        subtotal: totalAmount,
        total: totalAmount,
        amount_expected: totalAmount
      }));
    }
  }, [invoice, preselectedIncomes, incomes, programLocations]);

  useEffect(() => {
    const balance = (formData.amount_expected || 0) - (formData.amount_received || 0);
    setFormData(prev => ({ ...prev, under_over_amount: balance }));
  }, [formData.amount_expected, formData.amount_received]);

  useEffect(() => {
    if (formData.staff_member_id) {
      const provider = providers.find(p => p.id === formData.staff_member_id);
      if (provider) {
        setFormData(prev => ({ ...prev, work_email: provider.email }));
      }
    }
  }, [formData.staff_member_id, providers]);

  // Auto-update status when provider_paid checkbox is checked
  useEffect(() => {
    if (formData.provider_paid && formData.status !== 'provider_paid') {
      setFormData(prev => ({ ...prev, status: 'provider_paid' }));
    }
  }, [formData.provider_paid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalData = { ...formData };
    
    // Auto-generate invoice number for UConn if not provided
    if (!finalData.invoice_number && finalData.program_group === 'UConn') {
      const uconnLocation = programLocations.find(pl => pl.program_group === 'UConn');
      if (uconnLocation) {
        const nextNumber = (uconnLocation.invoice_counter || 39) + 1;
        finalData.invoice_number = `${nextNumber}`;
        
        // Update the counter in the program location
        await base44.entities.ProgramLocation.update(uconnLocation.id, {
          invoice_counter: nextNumber
        });
      }
    }
    
    // Set timestamps based on checkboxes
    if (finalData.invoice_sent_for_approval && !invoice?.sent_for_approval_at && finalData.program_group !== 'St. Francis') {
      finalData.sent_for_approval_at = new Date().toISOString();
    }
    
    if (finalData.invoice_sent_to_vendor && !invoice?.sent_to_vendor_at && finalData.program_group !== 'St. Francis') {
      finalData.sent_to_vendor_at = new Date().toISOString();
    }
    
    onSubmit(finalData);
  };

  const toggleIncome = (incomeId) => {
    const income = incomes.find(inc => inc.id === incomeId);
    const isSelected = formData.outside_income_ids.includes(incomeId);
    
    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        outside_income_ids: prev.outside_income_ids.filter(id => id !== incomeId),
        days_worked: prev.days_worked - (income?.days_worked || 0),
        subtotal: prev.subtotal - (income?.total_amount || 0),
        total: prev.total - (income?.total_amount || 0),
        amount_expected: prev.amount_expected - (income?.total_amount || 0)
      }));
    } else {
      setFormData(prev => {
        // When adding income, auto-update program group and staff member if not set
        let updates = {
          outside_income_ids: [...prev.outside_income_ids, incomeId],
          days_worked: prev.days_worked + (income?.days_worked || 0),
          subtotal: prev.subtotal + (income?.total_amount || 0),
          total: prev.total + (income?.total_amount || 0),
          amount_expected: prev.amount_expected + (income?.total_amount || 0)
        };
        
        // Auto-set program group and staff member from first selected income
        if (prev.outside_income_ids.length === 0) { // Only auto-set if no incomes were previously selected
          if (income?.program_location_id) {
            const programLocation = programLocations.find(pl => pl.id === income.program_location_id);
            if (programLocation) {
              updates.program_group = programLocation.program_group || '';
            }
          }
          if (income?.provider_id) {
            updates.staff_member_id = income.provider_id;
          }
        }
        return { ...prev, ...updates };
      });
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (type === 'draft') setUploadingDraft(true);
      else setUploadingApproved(true);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setFormData(prev => {
        const updates = {
          [type === 'draft' ? 'draft_invoice_url' : 'approved_invoice_url']: file_url
        };
        
        // Auto-update status based on program group and upload type
        if (prev.program_group === 'UConn') {
          // UConn logic (existing)
          if (type === 'draft') {
            updates.status = 'draft';
          } else if (type === 'approved') {
            updates.status = 'sent_to_vendor';
            updates.sent_to_vendor_at = new Date().toISOString();
            updates.invoice_sent_to_vendor = true;
          }
        } else if (prev.program_group === 'St. Francis') {
          // St. Francis: Draft invoice → Sent to Vendor
          if (type === 'draft') {
            updates.status = 'sent_to_vendor';
            updates.sent_to_vendor_at = new Date().toISOString();
            updates.invoice_sent_to_vendor = true;
          } else if (type === 'approved') {
            updates.status = 'sent_to_vendor';
            updates.sent_to_vendor_at = new Date().toISOString();
            updates.invoice_sent_to_vendor = true;
          }
        } else {
          // Other program groups (NOT UConn or St. Francis)
          if (type === 'draft' && !prev.approved_invoice_url) {
            // Draft only (no approved invoice) → Sent for Approval
            updates.status = 'sent_for_approval';
            updates.sent_for_approval_at = new Date().toISOString();
            updates.invoice_sent_for_approval = true;
          } else if (type === 'approved') {
            // Approved invoice → Sent to Vendor
            updates.status = 'sent_to_vendor';
            updates.sent_to_vendor_at = new Date().toISOString();
            updates.invoice_sent_to_vendor = true;
          }
        }
        
        return { ...prev, ...updates };
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      if (type === 'draft') setUploadingDraft(false);
      else setUploadingApproved(false);
    }
  };

  const pendingIncomes = incomes.filter(inc => inc.status === 'pending');

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{invoice ? 'Edit Invoice' : 'Create Invoice'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder={formData.program_group === 'UConn' ? 'Auto-generated' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_group">Program Group *</Label>
              <Select value={formData.program_group} onValueChange={(value) => setFormData({ ...formData, program_group: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program group" />
                </SelectTrigger>
                <SelectContent>
                  {programGroups.map(group => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff_member_id">Staff Member *</Label>
              <Select value={formData.staff_member_id} onValueChange={(value) => setFormData({ ...formData, staff_member_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_email">Work Email</Label>
              <Input
                id="work_email"
                type="email"
                value={formData.work_email}
                readOnly
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Input
                id="month"
                placeholder="e.g., January 2024"
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Days Worked</Label>
              <div className="text-xl font-semibold text-slate-900 p-3 bg-slate-50 rounded-lg">
                {formData.days_worked}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                value={formData.total}
                onChange={(e) => setFormData({ ...formData, total: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_expected">Amount Expected</Label>
              <Input
                id="amount_expected"
                type="number"
                step="0.01"
                value={formData.amount_expected}
                onChange={(e) => setFormData({ ...formData, amount_expected: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_received">Amount Received</Label>
              <Input
                id="amount_received"
                type="number"
                step="0.01"
                value={formData.amount_received}
                onChange={(e) => setFormData({ ...formData, amount_received: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Under/Over Amount</Label>
              <div className={`text-xl font-bold p-3 rounded-lg ${
                formData.under_over_amount > 0 ? 'bg-green-50 text-green-700' : 
                formData.under_over_amount < 0 ? 'bg-red-50 text-red-700' : 
                'bg-slate-50 text-slate-700'
              }`}>
                ${formData.under_over_amount.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_provider_paid">Date Provider Paid</Label>
              <Input
                id="date_provider_paid"
                type="date"
                value={formData.date_provider_paid}
                onChange={(e) => setFormData({ ...formData, date_provider_paid: e.target.value })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="provider_paid"
                checked={formData.provider_paid}
                onCheckedChange={(checked) => setFormData({ ...formData, provider_paid: checked })}
              />
              <label htmlFor="provider_paid" className="text-sm font-medium cursor-pointer">
                Provider Paid
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_ready_to_send"
                checked={formData.invoice_ready_to_send}
                onCheckedChange={(checked) => setFormData({ ...formData, invoice_ready_to_send: checked })}
              />
              <label htmlFor="invoice_ready_to_send" className="text-sm font-medium cursor-pointer">
                Invoice Ready to Send
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_sent_for_approval"
                checked={formData.invoice_sent_for_approval}
                onCheckedChange={(checked) => setFormData({ ...formData, invoice_sent_for_approval: checked })}
              />
              <label htmlFor="invoice_sent_for_approval" className="text-sm font-medium cursor-pointer">
                Invoice Sent for Approval
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_sent_to_vendor"
                checked={formData.invoice_sent_to_vendor}
                onCheckedChange={(checked) => setFormData({ ...formData, invoice_sent_to_vendor: checked })}
              />
              <label htmlFor="invoice_sent_to_vendor" className="text-sm font-medium cursor-pointer">
                Invoice Sent to Vendor
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Draft Invoice</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, 'draft')}
                  disabled={uploadingDraft}
                  className="flex-1"
                />
                {formData.draft_invoice_url && (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={formData.draft_invoice_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </Button>
                )}
              </div>
              {formData.program_group === 'UConn' && (
                <p className="text-xs text-slate-500">
                  Uploading will auto-update status to "Draft"
                </p>
              )}
              {formData.program_group === 'St. Francis' && (
                <p className="text-xs text-slate-500">
                  Uploading will auto-update status to "Sent to Vendor"
                </p>
              )}
              {formData.program_group && formData.program_group !== 'UConn' && formData.program_group !== 'St. Francis' && (
                <p className="text-xs text-slate-500">
                  Uploading will auto-update status to "Sent for Approval"
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Approved Invoice</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileUpload(e, 'approved')}
                  disabled={uploadingApproved}
                  className="flex-1"
                />
                {formData.approved_invoice_url && (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={formData.approved_invoice_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Uploading will auto-update status to "Sent to Vendor"
              </p>
            </div>
          </div>

          {pendingIncomes.length > 0 && (
            <div className="space-y-3">
              <Label>Outside Income Records</Label>
              <div className="border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                {pendingIncomes.map(income => {
                  const provider = providers.find(p => p.id === income.provider_id);
                  return (
                    <div key={income.id} className="flex items-start space-x-2 p-3 hover:bg-slate-50 rounded border border-slate-100">
                      <Checkbox
                        id={income.id}
                        checked={formData.outside_income_ids.includes(income.id)}
                        onCheckedChange={() => toggleIncome(income.id)}
                        className="mt-1"
                      />
                      <label htmlFor={income.id} className="flex-1 text-sm cursor-pointer">
                        <div className="font-medium text-slate-900">{provider?.full_name}</div>
                        <div className="text-slate-600">
                          {income.facility_name} - {income.days_worked} days - ${income.total_amount?.toFixed(2)}
                        </div>
                        {income.work_dates && income.work_dates.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500">
                            <span className="font-medium">Dates worked:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {income.work_dates.map((date, idx) => (
                                <span key={idx} className="inline-block bg-slate-100 px-2 py-0.5 rounded">
                                  {format(parseISO(date), 'MMM d, yyyy')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            {isLoading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}