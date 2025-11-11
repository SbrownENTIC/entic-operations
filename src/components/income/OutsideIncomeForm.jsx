import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";

export default function OutsideIncomeForm({ income, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    provider_id: '',
    program_location_id: '',
    facility_name: '',
    work_dates: [''],
    days_worked: 0,
    total_rvus: 0,
    rate: 0,
    total_amount: 0,
    status: 'pending',
    notes: ''
  });

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list('program_location')
  });

  // Check if Hartford Hospital is selected
  const isHartfordHospital = formData.facility_name?.toLowerCase().includes('hartford hospital') || 
                             formData.program_location_id && programLocations.find(pl => 
                               pl.id === formData.program_location_id && 
                               pl.program_group?.toLowerCase().includes('hartford hospital')
                             );

  useEffect(() => {
    if (income) {
      setFormData({
        ...income,
        work_dates: income.work_dates || [''],
        days_worked: income.days_worked || 0,
        total_rvus: income.total_rvus || 0
      });
    }
  }, [income]);

  useEffect(() => {
    // Calculate total based on Hartford Hospital or not
    let total;
    if (isHartfordHospital) {
      total = (formData.total_rvus || 0) * (formData.rate || 0);
    } else {
      const days = formData.work_dates.filter(d => d).length;
      total = days * (formData.rate || 0);
      setFormData(prev => ({ ...prev, days_worked: days }));
    }
    
    setFormData(prev => ({ 
      ...prev, 
      total_amount: total 
    }));
  }, [formData.work_dates, formData.rate, formData.total_rvus, isHartfordHospital]);

  useEffect(() => {
    // Auto-populate rate and facility when program location is selected
    if (formData.program_location_id) {
      const selectedLocation = programLocations.find(pl => pl.id === formData.program_location_id);
      if (selectedLocation) {
        setFormData(prev => ({
          ...prev,
          rate: selectedLocation.daily_rate || 0,
          facility_name: selectedLocation.program_location || prev.facility_name
        }));
      }
    }
  }, [formData.program_location_id, programLocations]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedDates = formData.work_dates.filter(d => d);
    onSubmit({ ...formData, work_dates: cleanedDates });
  };

  const addWorkDate = () => {
    setFormData({
      ...formData,
      work_dates: [...formData.work_dates, '']
    });
  };

  const removeWorkDate = (index) => {
    setFormData({
      ...formData,
      work_dates: formData.work_dates.filter((_, i) => i !== index)
    });
  };

  const updateWorkDate = (index, value) => {
    const newDates = [...formData.work_dates];
    newDates[index] = value;
    setFormData({ ...formData, work_dates: newDates });
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
        <CardContent className="p-6 space-y-6">
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
              <Label htmlFor="program_location_id">Program/Location</Label>
              <Select value={formData.program_location_id} onValueChange={(value) => setFormData({ ...formData, program_location_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program/location" />
                </SelectTrigger>
                <SelectContent>
                  {programLocations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.program_location}
                      {location.daily_rate > 0 && ` - $${location.daily_rate}${location.program_group?.toLowerCase().includes('hartford hospital') ? '/RVU' : '/day'}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility_name">Facility Name</Label>
              <Input
                id="facility_name"
                value={formData.facility_name}
                onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
              />
            </div>

            {isHartfordHospital ? (
              <div className="space-y-2">
                <Label htmlFor="total_rvus">Total RVUs *</Label>
                <Input
                  id="total_rvus"
                  type="number"
                  step="0.01"
                  value={formData.total_rvus}
                  onChange={(e) => setFormData({ ...formData, total_rvus: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Days Worked</Label>
                <div className="text-lg font-semibold text-slate-900 p-2 bg-slate-50 rounded-md">
                  {formData.days_worked}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rate">
                {isHartfordHospital ? 'Rate per RVU ($)' : 'Daily Rate ($)'}
              </Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <div className="text-2xl font-bold text-green-600">
                ${formData.total_amount.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500">
                {isHartfordHospital 
                  ? `${formData.total_rvus} RVUs × $${formData.rate.toFixed(2)} = $${formData.total_amount.toFixed(2)}`
                  : `${formData.days_worked} days × $${formData.rate.toFixed(2)} = $${formData.total_amount.toFixed(2)}`
                }
              </p>
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Work Dates *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addWorkDate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Date
              </Button>
            </div>
            <div className="space-y-3">
              {formData.work_dates.map((date, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => updateWorkDate(index, e.target.value)}
                    className="flex-1"
                  />
                  {formData.work_dates.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeWorkDate(index)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
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
            {isLoading ? 'Saving...' : income ? 'Update Income' : 'Add Income'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}