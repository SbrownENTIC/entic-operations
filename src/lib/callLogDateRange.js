import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  isValid,
} from 'date-fns';

export const CALL_LOG_DATE_PRESETS = [
  { id: 'current_week', label: 'Current Week' },
  { id: 'current_month', label: 'Current Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'current_quarter', label: 'Current Quarter' },
  { id: 'current_year', label: 'Current Year' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Date Range' },
];

const toDateString = (date) => format(date, 'yyyy-MM-dd');

export function resolveCallLogDateRange(preset, customStart = '', customEnd = '') {
  const today = new Date();

  switch (preset) {
    case 'current_week':
      return {
        preset,
        start: toDateString(startOfWeek(today, { weekStartsOn: 1 })),
        end: toDateString(endOfWeek(today, { weekStartsOn: 1 })),
        label: 'Current Week',
      };
    case 'current_quarter':
      return {
        preset,
        start: toDateString(startOfQuarter(today)),
        end: toDateString(endOfQuarter(today)),
        label: 'Current Quarter',
      };
    case 'current_year':
      return {
        preset,
        start: toDateString(startOfYear(today)),
        end: toDateString(endOfYear(today)),
        label: 'Current Year',
      };
    case 'last_month': {
      const previousMonth = subMonths(today, 1);
      return {
        preset,
        start: toDateString(startOfMonth(previousMonth)),
        end: toDateString(endOfMonth(previousMonth)),
        label: 'Last Month',
      };
    }
    case 'last_90_days':
      return {
        preset,
        start: toDateString(subDays(today, 89)),
        end: toDateString(today),
        label: 'Last 90 Days',
      };
    case 'custom':
      return {
        preset,
        start: customStart || '',
        end: customEnd || '',
        label: formatCallLogDateRangeLabel(customStart, customEnd) || 'Custom Date Range',
      };
    case 'current_month':
    default:
      return {
        preset: 'current_month',
        start: toDateString(startOfMonth(today)),
        end: toDateString(endOfMonth(today)),
        label: 'Current Month',
      };
  }
}

export function formatCallLogDateRangeLabel(start, end) {
  if (!start && !end) return '';
  const fmt = (value) => {
    if (!value) return '';
    const parsed = parseISO(value);
    return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : value;
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `Through ${fmt(end)}`;
}

export function isCallLogDateRangeReady(dateRange) {
  if (!dateRange) return false;
  if (dateRange.preset !== 'custom') return Boolean(dateRange.start && dateRange.end);
  return Boolean(dateRange.start && dateRange.end);
}

/** Filter raw call records by call_date (YYYY-MM-DD), inclusive. */
export function filterCallsByDateRange(calls, start, end) {
  if (!Array.isArray(calls)) return [];
  return calls.filter((call) => {
    const callDate = call?.call_date;
    if (!callDate) return false;
    if (start && callDate < start) return false;
    if (end && callDate > end) return false;
    return true;
  });
}
