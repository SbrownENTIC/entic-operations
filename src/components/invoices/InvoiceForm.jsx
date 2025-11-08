import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function InvoiceForm({ invoice, incomes, preselectedIncomes = [], onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    facility_name: '',
    invoice_date: '',
    due_date: '',
    total_amount: 0,
    paid_amount: 0,
    balance: 0,
    status: 'draft',
    outside_income_ids: preselectedIncomes,
    notes: ''
  });

  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    }
  }, [invoice]);

  useEffect(() => {
    if (preselectedIncomes.length > 0) {
      const selectedIncomeRecords = incomes.filter(i => preselectedIncomes.includes(i.id));
      const total = selectedIncomeRecords.reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const facility = selectedIncomeRecords[0]?.facility_name || '';
      
      setFormData(prev => ({
        ...prev,
        total_amount: total,
        balance: total,
        facility_name: facility,
        outside_income_ids: preselectedIncomes
      }));
    }
  }, [preselectedIncomes, incomes]);

  useEffect(() => {
    const balance = (formData.total_amount || 0) - (formData.paid_amount || 0);
    setFormData(prev => ({ ...prev, balance }));
  }, [formData.total_amount, formData.paid_amount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const toggleIncome = (incomeId) => {
    const newIds = formData.outside_income_ids.includes(incomeId)
      ? formData.outside_income_ids.filter(id => id !== incomeId)
      : [...formData.outside_income_ids, incomeId];
    
    const selectedIncomeRecords = incomes.filter(i => newIds.includes(i.id));
    const total = selectedIncomeRecords.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    
    setFormData({
      ...formData,
      outside_income_ids: newIds,
      total_amount: total,
      balance: total - (formData.paid_amount || 0)
    });
  };

  const pendingIncomes = incomes.filter(i => i.status === 'pending' || preselectedIncomes.includes(i.id));

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{invoice ? 'Edit Invoice' : 'Create New Invoice'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility_name">Facility Name *</Label>
              <Input
                id="facility_name"
                value={formData.facility_name}
                onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
                required
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
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Balance</Label>
              <div className="text-2xl font-bold text-slate-900">
                ${formData.balance?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {pendingIncomes.length > 0 && (
            <div>
              <Label className="mb-3 block">Select Income Records to Include</Label>
              <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                {pendingIncomes.map(income => (
                  <label
                    key={income.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={formData.outside_income_ids.includes(income.id)}
                      onChange={() => toggleIncome(income.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{income.facility_name}</p>
                      <p className="text-sm text-slate-600">
                        {format(parseISO(income.work_date), 'MMM d, yyyy')} • {income.hours_worked}hrs
                      </p>
                    </div>
                    <p className="font-medium text-slate-900">${income.total_amount?.toFixed(2)}</p>
                  </label>
                ))}
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