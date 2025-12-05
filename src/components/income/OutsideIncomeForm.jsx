import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFormState } from "@/components/FormContext";

export default function OutsideIncomeForm({ income, providers, onSubmit, onCancel, isLoading }) {
  const { setIsDirty } = useFormState();
  const [open, setOpen] = useState(false);
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
    temp_oncall_start_date: '',
    notes: ''
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list('program_location')
  });

  const isHartfordHospitalRVU = () => {
    const selectedLocation = programLocations.find(pl => pl.id === formData.program_location_id);
    
    if (selectedLocation) {
      const isHartford = selectedLocation.program_group?.toLowerCase().includes('hartford hospital');
      const isDirectorship = selectedLocation.program_type === 'Directorship' || 
                            selectedLocation.program_location?.toLowerCase().includes('directorship');
      return isHartford && !isDirectorship;
    }
    
    const isHartford = formData.facility_name?.toLowerCase().includes('hartford hospital');
    const isDirectorship = formData.facility_name?.toLowerCase().includes('directorship');
    return isHartford && !isDirectorship;
  };

  const isHartfordHospitalRVUBased = isHartfordHospitalRVU();

  useEffect(() => {
    if (income) {
      setFormData({
        ...income,
        work_dates: income.work_dates || [''],
        days_worked: income.days_worked || 0,
        total_rvus: income.total_rvus || 0,
        temp_oncall_start_date: income.temp_oncall_start_date || ''
      });
      setIsInitialLoad(true);
      // Reset initial load flag after a short delay
      setTimeout(() => setIsInitialLoad(false), 100);
    } else {
      setIsInitialLoad(false);
    }
  }, [income]);

  useEffect(() => {
    // Skip calculation on initial load when editing
    if (isInitialLoad) return;
    
    // Skip auto-calculation entirely for Hartford Hospital RVU-based programs
    if (isHartfordHospitalRVUBased) {
      return;
    }
    
    let total;
    const selectedLocation = programLocations.find(pl => pl.id === formData.program_location_id);
    const isDirectorship = selectedLocation?.program_type === 'Directorship';
    
    if (isDirectorship) {
      total = formData.rate || 0;
    } else {
      const days = formData.work_dates.filter(d => d).length;
      total = days * (formData.rate || 0);
      setFormData(prev => ({ ...prev, days_worked: days }));
    }
    
    setFormData(prev => ({ 
      ...prev, 
      total_amount: total 
    }));
  }, [formData.work_dates, formData.rate, isHartfordHospitalRVUBased, formData.program_location_id, programLocations, isInitialLoad]);

  useEffect(() => {
    if (formData.program_location_id) {
      const selectedLocation = programLocations.find(pl => pl.id === formData.program_location_id);
      if (selectedLocation) {
        const updates = {
          facility_name: selectedLocation.program_location || formData.facility_name
        };
        
        if (!isHartfordHospitalRVUBased) {
          updates.rate = selectedLocation.daily_rate || 0;
        }
        
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
    }
  }, [formData.program_location_id, programLocations, isHartfordHospitalRVUBased]);



  const handleSubmit = (e) => {
    setIsDirty(false);
    e.preventDefault();
    const cleanedDates = formData.work_dates.filter(d => d);
    
    const submissionData = { 
      ...formData, 
      work_dates: cleanedDates.length > 0 ? cleanedDates : []
    };
    
    onSubmit(submissionData);
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

  const selectedLocation = programLocations.find(pl => pl.id === formData.program_location_id);
  const isDirectorship = selectedLocation?.program_type === 'Directorship';

  return (
    <Card className="border-slate-200 shadow-sm max-h-[90vh] flex flex-col">
      <CardHeader className="border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>{income ? 'Edit Income' : 'Add Outside Income'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {formData.provider_id
                      ? providers.find((provider) => provider.id === formData.provider_id)?.full_name
                      : "Select provider..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search provider..." />
                    <CommandList>
                      <CommandEmpty>No provider found.</CommandEmpty>
                      <CommandGroup>
                        {providers.map((provider) => (
                          <CommandItem
                            key={provider.id}
                            value={provider.full_name}
                            onSelect={() => {
                              setFormData({ ...formData, provider_id: provider.id });
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                formData.provider_id === provider.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {provider.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_location_id">Program/Location</Label>
              <Select value={formData.program_location_id} onValueChange={(value) => setFormData({ ...formData, program_location_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program/location" />
                </SelectTrigger>
                <SelectContent>
                  {programLocations.map(location => {
                    const isHartfordRVU = location.program_group?.toLowerCase().includes('hartford hospital') && 
                                         location.program_type !== 'Directorship';
                    const rateLabel = location.program_type === 'Directorship' ? '/month' : (isHartfordRVU ? '/RVU' : '/day');
                    return (
                      <SelectItem key={location.id} value={location.id}>
                        {location.program_location}
                        {location.daily_rate > 0 && !isHartfordRVU && ` - $${location.daily_rate}${rateLabel}`}
                      </SelectItem>
                    );
                  })}
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

            {isHartfordHospitalRVUBased ? (
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
            ) : !isDirectorship ? (
              <div className="space-y-2">
                <Label>Days Worked</Label>
                <div className="text-lg font-semibold text-slate-900 p-2 bg-slate-50 rounded-md">
                  {formData.days_worked}
                </div>
              </div>
            ) : null}

            {!isHartfordHospitalRVUBased && (
              <div className="space-y-2">
                <Label htmlFor="rate">
                  {isDirectorship ? 'Monthly Rate ($)' : 'Daily Rate ($)'}
                </Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount ($) *</Label>
              {isHartfordHospitalRVUBased ? (
                <>
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                    required
                    className="text-lg font-semibold"
                  />
                  <p className="text-xs text-slate-500">
                    Enter the manually calculated amount for {formData.total_rvus} RVUs
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">
                    ${formData.total_amount.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500">
                    {isDirectorship 
                      ? `Monthly rate: $${formData.rate.toFixed(2)}`
                      : `${formData.days_worked} days × $${formData.rate.toFixed(2)} = $${formData.total_amount.toFixed(2)}`
                    }
                  </p>
                </>
              )}
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

            <div className="space-y-2">
              <Label htmlFor="temp_oncall_start_date">On-Call Start Date (Temp)</Label>
              <Input
                id="temp_oncall_start_date"
                type="date"
                value={formData.temp_oncall_start_date}
                onChange={(e) => setFormData({ ...formData, temp_oncall_start_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>
                Work Dates {!isHartfordHospitalRVUBased && !isDirectorship && '*'}
                {(isHartfordHospitalRVUBased || isDirectorship) && <span className="text-xs text-slate-500 font-normal ml-2">(Optional)</span>}
              </Label>
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
                    required={!isHartfordHospitalRVUBased && !isDirectorship && index === 0}
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
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3 flex-shrink-0">
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