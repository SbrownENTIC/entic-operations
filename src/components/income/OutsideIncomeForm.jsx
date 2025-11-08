import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function OutsideIncomeForm({ income, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    provider_id: '',
    facility_name: '',
    work_date: '',
    hours_worked: 0,
    rate: 0,
    total_amount: 0,
    status: 'pending',
    notes: ''
  });

  useEffect(() => {
    if (income) {
      setFormData(income);
    }
  }, [income]);

  useEffect(() => {
    const total = (formData.hours_worked || 0) * (formData.rate || 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
  }, [formData.hours_worked, formData.rate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{income ? 'Edit Income' : 'Add Outside Income'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Select value={formData.provider_id} onValueChange={(value) => setFormData({ ...formData, provider_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
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
              <Label htmlFor="facility_name">Facility Name *</Label>
              <Input
                id="facility_name"
                value={formData.facility_name}
                onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_date">Work Date *</Label>
              <Input
                id="work_date"
                type="date"
                value={formData.work_date}
                onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours_worked">Hours Worked</Label>
              <Input
                id="hours_worked"
                type="number"
                step="0.5"
                value={formData.hours_worked}
                onChange={(e) => setFormData({ ...formData, hours_worked: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
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
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : income ? 'Update Income' : 'Add Income'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}