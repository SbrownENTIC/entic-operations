import { startOfWeek, startOfMonth, format, parseISO } from 'date-fns';

/**
 * Normalize extension: remove spaces, dashes, parentheses
 */
function normalizeExtension(ext) {
  if (!ext || typeof ext !== 'string') return '';
  return String(ext).trim().replace(/[\s\-()]/g, '').replace(/\D/g, '');
}

/**
 * Get Monday-based week start for a date
 */
function getWeekStart(dateStr) {
  const date = parseISO(dateStr);
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Get month start for a date
 */
function getMonthStart(dateStr) {
  const date = parseISO(dateStr);
  return format(startOfMonth(date), 'yyyy-MM');
}

/**
 * Aggregate inbound calls by week
 */
export function aggregateInboundByWeek(inboundCalls, extToUser, benchmarkUserIds) {
  const weekMap = {};

  inboundCalls.forEach(call => {
    const weekKey = getWeekStart(call.call_date);
    const user = extToUser[call.extension];
    const isBenchmark = user && benchmarkUserIds.has(user.id);

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        week_start: weekKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0
      };
    }

    weekMap[weekKey].total_inbound++;
    if (call.answered) weekMap[weekKey].total_answered++;
    if (call.missed) weekMap[weekKey].total_missed++;

    if (isBenchmark) {
      weekMap[weekKey].benchmark_inbound++;
      if (call.answered) weekMap[weekKey].benchmark_answered++;
    }
  });

  return Object.values(weekMap).map(week => ({
    ...week,
    answer_rate: week.total_inbound === 0 ? 0 : Math.min(week.total_answered / week.total_inbound, 1.0),
    benchmark_answer_rate: week.benchmark_inbound === 0 ? 0 : 
      Math.min(week.benchmark_answered / week.benchmark_inbound, 1.0)
  }));
}

/**
 * Aggregate inbound calls by month
 */
export function aggregateInboundByMonth(inboundCalls, extToUser, benchmarkUserIds) {
  const monthMap = {};

  inboundCalls.forEach(call => {
    const monthKey = getMonthStart(call.call_date);
    const user = extToUser[call.extension];
    const isBenchmark = user && benchmarkUserIds.has(user.id);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0
      };
    }

    monthMap[monthKey].total_inbound++;
    if (call.answered) monthMap[monthKey].total_answered++;
    if (call.missed) monthMap[monthKey].total_missed++;

    if (isBenchmark) {
      monthMap[monthKey].benchmark_inbound++;
      if (call.answered) monthMap[monthKey].benchmark_answered++;
    }
  });

  return Object.values(monthMap).map(month => ({
    ...month,
    answer_rate: month.total_inbound === 0 ? 0 : Math.min(month.total_answered / month.total_inbound, 1.0),
    benchmark_answer_rate: month.benchmark_inbound === 0 ? 0 :
      Math.min(month.benchmark_answered / month.benchmark_inbound, 1.0)
  }));
}

/**
 * Aggregate by user (for individual performance)
 */
export function aggregateByUser(inboundCalls, extToUser, users) {
  const userMap = {};

  inboundCalls.forEach(call => {
    const normalizedExt = normalizeExtension(call.extension);
    const user = extToUser[normalizedExt] || extToUser[call.extension];
    if (!user) return;

    const userId = user.id;
    if (!userMap[userId]) {
      userMap[userId] = {
        user_id: userId,
        user_name: user.name,
        benchmark_group: user.benchmark_group,
        include_in_benchmark: user.include_in_benchmark,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        total_duration_seconds: 0,
        total_outbound: 0,
        outbound_connected: 0
      };
    }

    userMap[userId].total_inbound++;
    if (call.answered) userMap[userId].total_answered++;
    if (call.missed) userMap[userId].total_missed++;
    userMap[userId].total_duration_seconds += call.duration_seconds || 0;
  });

  return Object.values(userMap).map(user => ({
    ...user,
    answer_rate: user.total_inbound === 0 ? 0 : Math.min(user.total_answered / user.total_inbound, 1.0),
    avg_duration_seconds: user.total_inbound === 0 ? 0 : Math.round(user.total_duration_seconds / user.total_inbound),
    outbound_contact_rate: 0,
    overall_contact_rate: 0
  }));
}

/**
 * Aggregate outbound by user
 */
export function aggregateOutboundByUser(outboundCalls, extToUser, users) {
  const userMap = {};

  outboundCalls.forEach(call => {
    // Normalize extension before lookup
    const normalizedExt = normalizeExtension(call.extension);
    const user = extToUser[normalizedExt] || extToUser[call.extension];
    if (!user) return;

    const userId = user.id;
    if (!userMap[userId]) {
      userMap[userId] = {
        user_id: userId,
        user_name: user.name,
        benchmark_group: user.benchmark_group,
        include_in_benchmark: user.include_in_benchmark,
        total_outbound: 0,
        outbound_connected: 0,
        total_duration_seconds: 0
      };
    }

    userMap[userId].total_outbound++;
    if (call.result === 'answered' && (call.duration_seconds || 0) >= 30) userMap[userId].outbound_connected++;
    userMap[userId].total_duration_seconds += call.duration_seconds || 0;
  });

  return Object.values(userMap).map(user => ({
    ...user,
    outbound_contact_rate: user.total_outbound === 0 ? 0 : Math.min(user.outbound_connected / user.total_outbound, 1.0),
    overall_contact_rate: 0, // Will be merged with inbound data
    avg_duration_seconds: user.total_outbound === 0 ? 0 : Math.round(user.total_duration_seconds / user.total_outbound)
  }));
}

/**
 * Aggregate outbound calls by week
 */
export function aggregateOutboundByWeek(outboundCalls, extToUser, benchmarkUserIds) {
  const weekMap = {};

  outboundCalls.forEach(call => {
    const weekKey = getWeekStart(call.call_date);
    const normalizedExt = normalizeExtension(call.extension);
    const user = extToUser[normalizedExt] || extToUser[call.extension];
    const isBenchmark = user && benchmarkUserIds.has(user.id);

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        week_start: weekKey,
        total_outbound: 0,
        connected_outbound: 0,
        benchmark_outbound: 0,
        benchmark_connected: 0
      };
    }

    weekMap[weekKey].total_outbound++;
    if (call.result === 'answered' && (call.duration_seconds || 0) >= 30) weekMap[weekKey].connected_outbound++;

    if (isBenchmark) {
      weekMap[weekKey].benchmark_outbound++;
      if (call.result === 'answered' && (call.duration_seconds || 0) >= 30) weekMap[weekKey].benchmark_connected++;
    }
  });

  return Object.values(weekMap).map(week => ({
    ...week,
    outbound_answer_rate: week.total_outbound === 0 ? 0 : Math.min(week.connected_outbound / week.total_outbound, 1.0),
    benchmark_outbound_answer_rate: week.benchmark_outbound === 0 ? 0 :
      Math.min(week.benchmark_connected / week.benchmark_outbound, 1.0)
  }));
}

/**
 * Aggregate outbound calls by month
 */
export function aggregateOutboundByMonth(outboundCalls, extToUser, benchmarkUserIds) {
  const monthMap = {};

  outboundCalls.forEach(call => {
    const monthKey = getMonthStart(call.call_date);
    const normalizedExt = normalizeExtension(call.extension);
    const user = extToUser[normalizedExt] || extToUser[call.extension];
    const isBenchmark = user && benchmarkUserIds.has(user.id);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        total_outbound: 0,
        connected_outbound: 0,
        benchmark_outbound: 0,
        benchmark_connected: 0
      };
    }

    monthMap[monthKey].total_outbound++;
    if (call.result === 'answered' && (call.duration_seconds || 0) >= 30) monthMap[monthKey].connected_outbound++;

    if (isBenchmark) {
      monthMap[monthKey].benchmark_outbound++;
      if (call.result === 'answered' && (call.duration_seconds || 0) >= 30) monthMap[monthKey].benchmark_connected++;
    }
  });

  return Object.values(monthMap).map(month => ({
    ...month,
    outbound_answer_rate: month.total_outbound === 0 ? 0 : Math.min(month.connected_outbound / month.total_outbound, 1.0),
    benchmark_outbound_answer_rate: month.benchmark_outbound === 0 ? 0 :
      Math.min(month.benchmark_connected / month.benchmark_outbound, 1.0)
  }));
}