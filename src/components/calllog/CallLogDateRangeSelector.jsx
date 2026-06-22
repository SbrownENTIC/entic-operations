import React from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  CALL_LOG_DATE_PRESETS,
  formatCallLogDateRangeLabel,
  isCallLogDateRangeReady,
} from '@/lib/callLogDateRange';

export default function CallLogDateRangeSelector({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  dateRange,
}) {
  const rangeReady = isCallLogDateRangeReady(dateRange);
  const rangeLabel = rangeReady
    ? formatCallLogDateRangeLabel(dateRange.start, dateRange.end)
    : 'Select a start and end date';

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/40 shadow-sm">
      <CardContent className="p-4 pt-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Reporting Date Range</h2>
          <p className="text-sm text-slate-600 mt-1">
            Filter KPIs, performance tables, and exports by call date.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
            <div className="space-y-2 min-w-[220px]">
              <Label htmlFor="call-log-date-preset">Reporting Period</Label>
              <Select value={preset} onValueChange={onPresetChange}>
                <SelectTrigger id="call-log-date-preset">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_LOG_DATE_PRESETS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preset === 'custom' && (
              <>
                <div className="space-y-2 min-w-[200px]">
                  <Label>Start Date</Label>
                  <DatePicker
                    value={customStart}
                    onChange={onCustomStartChange}
                    placeholder="Start date"
                  />
                </div>
                <div className="space-y-2 min-w-[200px]">
                  <Label>End Date</Label>
                  <DatePicker
                    value={customEnd}
                    onChange={onCustomEndChange}
                    placeholder="End date"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>
              {preset === 'custom' && !rangeReady
                ? 'Choose both dates to apply the custom range.'
                : rangeLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
