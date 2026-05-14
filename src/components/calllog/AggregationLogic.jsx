import { startOfWeek, startOfMonth, format, parseISO } from 'date-fns';

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
    const user = extToUser[call.extension];
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
        total_duration_seconds: 0
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
    avg_duration_seconds: user.total_inbound === 0 ? 0 : Math.round(user.total_duration_seconds / user.total_inbound)
  }));
}

/**
 * Aggregate outbound by user
 */
export function aggregateOutboundByUser(outboundCalls, extToUser, users) {
  const userMap = {};

  outboundCalls.forEach(call => {
    const user = extToUser[call.extension];
    if (!user) return;

    const userId = user.id;
    if (!userMap[userId]) {
      userMap[userId] = {
        user_id: userId,
        user_name: user.name,
        total_outbound: 0,
        total_duration_seconds: 0
      };
    }

    userMap[userId].total_outbound++;
    userMap[userId].total_duration_seconds += call.duration_seconds || 0;
  });

  return Object.values(userMap).map(user => ({
    ...user,
    avg_duration_seconds: user.total_outbound === 0 ? 0 : Math.round(user.total_duration_seconds / user.total_outbound)
  }));
}