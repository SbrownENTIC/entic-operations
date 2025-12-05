import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiDatePicker } from "@/components/ui/multi-date-picker";
import { Combobox } from "@/components/ui/combobox";
import { addDays, format, parseISO, differenceInDays } from "date-fns";
import { useFormState } from "@/components/FormContext";

const COMMON_REASONS = [
  "Vacation",
  "Sick Time", 
  "CME",
  "Personal Day",
  "Holiday",
  "Jury Duty",
  "Bereavement",
  "Family Leave",
  "Conference"
];

export default function TimeOffForm({ timeOff, onSubmit, onCancel, isLoading }) {
  const { setIsDirty } = useFormState();
  const [selectedDates, setSelectedDates] = useState([]);
  const [formData, setFormData] = useState({
    provider_id: '',
    start_date: '',
    end_date: '',
    type: 'time_off',
    partial_day_end_time: '',
    reason: '',
    status: 'approved',
    notes: ''
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  useEffect(() => {
    if (timeOff) {
      setFormData(timeOff);
    }
  }, [timeOff]);

  // Auto-set end date to start date if not set (only in single edit mode)
  useEffect(() => {
    if (timeOff && formData.start_date && !formData.end_date) {
      setFormData(prev => ({ ...prev, end_date: formData.start_date }));
    }
  }, [formData.start_date, formData.end_date, timeOff]);



  const handleSubmit = (e) => {
    setIsDirty(false);
    e.preventDefault();
    
    if (!timeOff && selectedDates.length > 0) {
      // Process multiple dates into consecutive ranges
      const sortedDates = [...selectedDates].sort();
      const ranges = [];
      
      if (sortedDates.length > 0) {
        let currentRange = { start: sortedDates[0], end: sortedDates[0] };
        
        for (let i = 1; i < sortedDates.length; i++) {
          const current = parseISO(sortedDates[i]);
          const prev = parseISO(sortedDates[i-1]);
          const diff = differenceInDays(current, prev);
          
          if (diff === 1) {
            // Consecutive day, extend current range
            currentRange.end = sortedDates[i];
          } else {
            // Non-consecutive, push current range and start new one
            ranges.push(currentRange);
            currentRange = { start: sortedDates[i], end: sortedDates[i] };
          }
        }
        ranges.push(currentRange);
      }
      
      // Create an entry for each range
      const entries = ranges.map(range => ({
        ...formData,
        start_date: range.start,
        end_date: range.end,
      }));
      
      onSubmit(entries);
    } else {
      // Single entry update or create (fallback)
      onSubmit(formData);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{timeOff ? 'Edit Time Off Entry' : 'Add Time Off / CME'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Combobox
                options={providers.map(p => ({ value: p.id, label: p.full_name }))}
                value={formData.provider_id}
                onChange={(value) => { setIsDirty(true); setFormData({ ...formData, provider_id: value })}
                placeholder="Select provider..."
                searchPlaceholder="Search providers..."
                emptyText="No provider found"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_off">Time off</SelectItem>
                  <SelectItem value="cme">CME</SelectItem>
                  <SelectItem value="partial_day">Partial day</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeOff ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <DatePicker
                    value={formData.start_date}
                    onChange={(date) => { setIsDirty(true); setFormData({ ...formData, start_date: date })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <DatePicker
                    value={formData.end_date}
                    onChange={(date) => { setIsDirty(true); setFormData({ ...formData, end_date: date })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label>Select Dates *</Label>
                <MultiDatePicker
                  value={selectedDates}
                  onChange={(dates) => { setIsDirty(true); setSelectedDates(dates); }}
                  placeholder="Pick multiple days (consecutive days will be grouped)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Consecutive days will be grouped into a single entry. Non-consecutive days will create separate entries.
                </p>
              </div>
            )}

            {formData.type === 'partial_day' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partial_day_end_time">End Time</Label>
                <Input
                  id="partial_day_end_time"
                  type="time"
                  value={formData.partial_day_end_time}
                  onChange={(e) => { setIsDirty(true); setFormData({ ...formData, partial_day_end_time: e.target.value })}
                  placeholder="e.g., 12:00 PM"
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Combobox
                options={[...new Set([...COMMON_REASONS, ...(formData.reason ? [formData.reason] : [])])].map(r => ({ value: r, label: r }))}
                value={formData.reason}
                onChange={(value) => { setIsDirty(true); setFormData({ ...formData, reason: value })}
                placeholder="Select or type a reason..."
                searchPlaceholder="Search reasons..."
                creatable
                onCreate={(value) => setFormData({ ...formData, reason: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => { setIsDirty(true); setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes or details"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : timeOff ? 'Update Entry' : 'Add Entry'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}