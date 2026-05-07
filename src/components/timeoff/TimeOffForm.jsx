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
import { addDays, format, parseISO, differenceInDays, parse, isValid } from "date-fns";
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
  const [pasteInput, setPasteInput] = useState("");
  const [formData, setFormData] = useState({
    provider_id: '',
    start_date: '',
    end_date: '',
    type: 'time_off',
    cme_hours: '',
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

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Clear cme_hours when switching away from CME
      if (field === 'type' && value !== 'cme') {
        updated.cme_hours = '';
      }
      return updated;
    });
    setIsDirty(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.provider_id) {
      alert("Please select a provider.");
      return;
    }

    if (formData.type === 'cme') {
      const hours = parseFloat(formData.cme_hours);
      if (!formData.cme_hours || isNaN(hours) || hours < 0.25 || hours > 24) {
        alert("CME Hours is required and must be between 0.25 and 24.");
        return;
      }
    }

    if (!timeOff) {
      // Create Mode
      let datesToSubmit = new Set(selectedDates);

      // Auto-process paste input if exists
      if (pasteInput) {
        const lines = pasteInput.split(/[\r\n,]+/);
        lines.forEach(line => {
          const dateMatch = line.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
          if (dateMatch) {
            try {
              const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
              const parsedDate = parse(dateStr, 'M/d/yyyy', new Date());
              if (isValid(parsedDate)) {
                datesToSubmit.add(format(parsedDate, 'yyyy-MM-dd'));
              }
            } catch (e) {
              console.error("Failed to parse date from line:", line);
            }
          }
        });
      }

      if (datesToSubmit.size === 0) {
        alert("Please select dates or paste a list of dates.");
        return;
      }

      setIsDirty(false);

      // Process multiple dates into consecutive ranges
      const sortedDates = Array.from(datesToSubmit).sort();
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
      const cmeHoursValue = formData.type === 'cme' && formData.cme_hours ? parseFloat(formData.cme_hours) : null;
      const entries = ranges.map(range => ({
        ...formData,
        start_date: range.start,
        end_date: range.end,
        cme_hours: cmeHoursValue,
      }));
      
      onSubmit(entries);
    } else {
      // Edit Mode (Single Entry)
      setIsDirty(false);
      onSubmit(formData);
    }
  };

  return (
    <Card className="border-slate-200 shadow-none border-0">
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
                onChange={(value) => handleChange('provider_id', value)}
                placeholder="Select provider..."
                searchPlaceholder="Search providers..."
                emptyText="No provider found"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => handleChange('type', value)}
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
                    onChange={(date) => handleChange('start_date', date)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <DatePicker
                    value={formData.end_date}
                    onChange={(date) => handleChange('end_date', date)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label>Select Dates *</Label>
                <MultiDatePicker
                  value={selectedDates}
                  onChange={(dates) => { setSelectedDates(dates); setIsDirty(true); }}
                  placeholder="Pick multiple days (consecutive days will be grouped)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Consecutive days will be grouped into a single entry. Non-consecutive days will create separate entries.
                </p>
                
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <Label htmlFor="paste_dates" className="text-sm font-medium text-slate-700">
                    Or Paste List of Dates
                  </Label>
                  <div className="flex gap-2 mt-2">
                    <Textarea
                      id="paste_dates"
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder="e.g. 1/19/2026, 2/12/2026&#10;or list them on separate lines"
                      className="text-sm font-mono"
                      rows={5}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-slate-500">
                      Supports MM/DD/YYYY formats. Separate by new lines or commas. Ignores numbering.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!pasteInput) return;

                        const lines = pasteInput.split(/[\r\n,]+/);
                        const newDates = new Set(selectedDates);
                        let addedCount = 0;

                        lines.forEach(line => {
                          // 1. Clean the line (remove numbering, bullets, etc.)
                          const cleanLine = line.replace(/^[\d\-\*\.]+\s+/, '').trim();
                          if (!cleanLine) return;

                          let parsedDate = null;

                          // 2. Try finding standard numeric formats: M/D/Y, M-D-Y, Y-M-D
                          const digitGroups = cleanLine.match(/(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);

                          if (digitGroups) {
                            const p1 = parseInt(digitGroups[1]);
                            const p2 = parseInt(digitGroups[2]);
                            const p3 = parseInt(digitGroups[3]);

                            if (p1 > 1000) {
                              // YYYY-MM-DD
                              parsedDate = new Date(p1, p2 - 1, p3);
                            } else if (p3 > 1000) {
                              // MM/DD/YYYY
                              parsedDate = new Date(p3, p1 - 1, p2);
                            } else {
                              // Assume MM/DD/YY (2 digit year)
                              const year = p3 < 100 ? p3 + 2000 : p3;
                              parsedDate = new Date(year, p1 - 1, p2);
                            }
                          }

                          // 3. Fallback: Try natural language parsing (e.g., "Jan 15, 2025")
                          if (!parsedDate || !isValid(parsedDate)) {
                              const d = new Date(cleanLine);
                              // Basic validation to ensure it's reasonable (e.g. not year 1900 from "1")
                              if (isValid(d) && d.getFullYear() > 2000 && d.getFullYear() < 2100) {
                                  parsedDate = d;
                              }
                          }

                          if (parsedDate && isValid(parsedDate)) {
                            newDates.add(format(parsedDate, 'yyyy-MM-dd'));
                            addedCount++;
                          }
                        });

                        if (newDates.size === selectedDates.length) {
                           alert("No valid dates found in the text. Please check the format.");
                        } else {
                           setSelectedDates(Array.from(newDates).sort());
                           setIsDirty(true);
                           setPasteInput(""); // Clear input after processing
                        }
                      }}
                      disabled={!pasteInput}
                    >
                      Process & Add Dates
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'cme' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cme_hours">CME Hours *</Label>
                <Input
                  id="cme_hours"
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={formData.cme_hours}
                  onChange={(e) => handleChange('cme_hours', e.target.value)}
                  placeholder="e.g., 4 or 1.5"
                  required
                />
                <p className="text-xs text-slate-500">Enter hours in 0.25 increments (min 0.25, max 24)</p>
              </div>
            )}

            {formData.type === 'partial_day' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partial_day_end_time">End Time</Label>
                <Input
                  id="partial_day_end_time"
                  type="time"
                  value={formData.partial_day_end_time}
                  onChange={(e) => handleChange('partial_day_end_time', e.target.value)}
                  placeholder="e.g., 12:00 PM"
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Combobox
                options={[...new Set([...COMMON_REASONS, ...(formData.reason ? [formData.reason] : [])])].map(r => ({ value: r, label: r }))}
                value={formData.reason}
                onChange={(value) => handleChange('reason', value)}
                placeholder="Select or type a reason..."
                searchPlaceholder="Search reasons..."
                creatable
                onCreate={(value) => handleChange('reason', value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => handleChange('status', value)}
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
              onChange={(e) => handleChange('notes', e.target.value)}
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