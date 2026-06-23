import { differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import {
  aggregateInboundByMonth,
  CALL_LOG_TRACKING_START_MONTH,
  enumerateMonthKeys,
} from '@/components/calllog/AggregationLogic';

const DEFAULT_BATCH_SIZE = 5000;
/** Ranges longer than this are fetched one calendar month at a time. */
const MONTH_CHUNK_THRESHOLD_DAYS = 45;

export function isCallLogTimeoutError(error) {
  if (!error) return false;
  const code = error.code ?? error.data?.code ?? error.response?.data?.code;
  const message = String(error.message ?? error.data?.message ?? '');
  return (
    code === 'MaxTimeMSExpired' ||
    message.includes('MaxTimeMSExpired') ||
    message.includes('time limit') ||
    message.includes('operation exceeded')
  );
}

export function getCallLogFetchErrorMessage(error) {
  if (isCallLogTimeoutError(error)) {
    return 'This call log query timed out. Try a shorter reporting period such as Current Month, Last Month, or Prior Week.';
  }
  if (error?.message) return error.message;
  return 'Failed to load call log data. Please try again.';
}

function clipDateRangeToMonth(monthKey, startDate, endDate) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
  return {
    start: monthStart > startDate ? monthStart : startDate,
    end: monthEnd < endDate ? monthEnd : endDate,
  };
}

async function fetchCallRecordsSingleRange(entity, startDate, endDate, batchSize = DEFAULT_BATCH_SIZE) {
  const allRows = [];
  let skip = 0;

  while (true) {
    let batch;
    try {
      batch = await entity.filter(
        { call_date: { $gte: startDate, $lte: endDate } },
        '-call_date',
        batchSize,
        skip
      );
    } catch (error) {
      if (isCallLogTimeoutError(error)) {
        const rangeError = new Error(getCallLogFetchErrorMessage(error));
        rangeError.code = 'MaxTimeMSExpired';
        rangeError.cause = error;
        throw rangeError;
      }
      throw error;
    }

    if (!batch || batch.length === 0) break;

    allRows.push(...batch);
    skip += batch.length;

    if (batch.length < batchSize) break;
  }

  return allRows;
}

/**
 * Fetch raw call records for an inclusive call_date range.
 * Wide ranges are split by calendar month to avoid deep skip pagination.
 */
export async function fetchCallRecordsByDateRange(entity, startDate, endDate) {
  if (!startDate || !endDate) return [];

  const spanDays = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;

  if (spanDays <= MONTH_CHUNK_THRESHOLD_DAYS) {
    return fetchCallRecordsSingleRange(entity, startDate, endDate);
  }

  const monthKeys = enumerateMonthKeys(startDate.slice(0, 7), endDate.slice(0, 7));
  const allRows = [];

  for (const monthKey of monthKeys) {
    const { start, end } = clipDateRangeToMonth(monthKey, startDate, endDate);
    const rows = await fetchCallRecordsSingleRange(entity, start, end);
    allRows.push(...rows);
  }

  return allRows;
}

/**
 * Fetch inbound aggregates month-by-month for the Monthly KPI Summary (Jan 2026 → current month).
 */
export async function fetchMonthlyInboundAggregates(entity, extToUser, benchmarkUserIds) {
  const endMonthKey = format(startOfMonth(new Date()), 'yyyy-MM');
  const monthKeys = enumerateMonthKeys(CALL_LOG_TRACKING_START_MONTH, endMonthKey);
  const aggregatedRows = [];

  for (const monthKey of monthKeys) {
    const start = `${monthKey}-01`;
    const end = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd');
    const rows = await fetchCallRecordsSingleRange(entity, start, end);
    const monthAgg = aggregateInboundByMonth(rows, extToUser, benchmarkUserIds);

    if (monthAgg.length > 0) {
      aggregatedRows.push(monthAgg[0]);
    } else {
      aggregatedRows.push({
        month: monthKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0,
        answer_rate: 0,
        benchmark_answer_rate: 0,
      });
    }
  }

  return aggregatedRows;
}

/** @deprecated Use fetchCallRecordsByDateRange with explicit start/end dates. */
export async function fetchAllCallRecords(entity) {
  console.warn('fetchAllCallRecords is deprecated — use fetchCallRecordsByDateRange instead.');
  return fetchCallRecordsSingleRange(entity, '1900-01-01', '2099-12-31');
}
