import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, user: filterUser } = await req.json();

    // Build filter
    const filter = {};
    if (month) {
      // Assuming month is passed as 'YYYY-MM-DD' (first of month)
      filter.month = month;
    }
    if (filterUser && filterUser !== 'all') {
      filter.user = filterUser;
    }

    // Fetch logs (limit 1000 for now, could need pagination for large datasets)
    // For a real reporting system, we might need to iterate through all pages
    let allLogs = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        // Using filter directly if SDK supports it, or listing and filtering in memory if needed
        // base44.entities.CallLog.filter(query, sort, limit, skip)
        // If filter is empty object, it returns all. 
        const logs = await base44.entities.CallLog.filter(filter, '-week_ending', 1000, (page - 1) * 1000);
        allLogs = [...allLogs, ...logs];
        if (logs.length < 1000) hasMore = false;
        page++;
        // Safety break
        if (page > 10) hasMore = false;
    }

    // Aggregate Data
    const summary = {
      total_calls: 0,
      inbound_calls: 0,
      outbound_calls: 0,
      answered_calls: 0,
      missed_calls: 0,
      voicemail_calls: 0,
      total_duration_minutes: 0,
      inbound_duration_minutes: 0,
      outbound_duration_minutes: 0,
      user_breakdown: {}
    };

    allLogs.forEach(log => {
      // Global totals
      summary.total_calls += log.total_calls || 0;
      summary.inbound_calls += log.inbound_calls || 0;
      summary.outbound_calls += log.outbound_calls || 0;
      summary.answered_calls += log.answered_calls || 0;
      summary.missed_calls += log.missed_calls || 0;
      summary.voicemail_calls += log.voicemail_calls || 0;
      summary.total_duration_minutes += log.total_duration_minutes || 0;
      summary.inbound_duration_minutes += log.inbound_duration_minutes || 0;
      summary.outbound_duration_minutes += log.outbound_duration_minutes || 0;

      // User breakdown
      const userName = log.user || 'Unknown';
      if (!summary.user_breakdown[userName]) {
        summary.user_breakdown[userName] = {
          user: userName,
          total_calls: 0,
          inbound_calls: 0,
          outbound_calls: 0,
          answered_calls: 0,
          missed_calls: 0,
          voicemail_calls: 0,
          total_duration_minutes: 0,
          inbound_duration_minutes: 0,
          outbound_duration_minutes: 0,
          weeks: [] // For trend chart
        };
      }
      
      const u = summary.user_breakdown[userName];
      u.total_calls += log.total_calls || 0;
      u.inbound_calls += log.inbound_calls || 0;
      u.outbound_calls += log.outbound_calls || 0;
      u.answered_calls += log.answered_calls || 0;
      u.missed_calls += log.missed_calls || 0;
      u.voicemail_calls += log.voicemail_calls || 0;
      u.total_duration_minutes += log.total_duration_minutes || 0;
      u.inbound_duration_minutes += log.inbound_duration_minutes || 0;
      u.outbound_duration_minutes += log.outbound_duration_minutes || 0;
      u.weeks.push({
        date: log.week_ending,
        calls: log.total_calls || 0
      });
    });

    // Calculate derived metrics for global
    summary.answer_rate_percent = summary.total_calls > 0 ? (summary.answered_calls / summary.total_calls) * 100 : 0;
    summary.missed_rate_percent = summary.total_calls > 0 ? (summary.missed_calls / summary.total_calls) * 100 : 0;
    summary.avg_call_duration_minutes = summary.total_calls > 0 ? summary.total_duration_minutes / summary.total_calls : 0;
    summary.avg_answered_call_duration_minutes = summary.answered_calls > 0 ? summary.total_duration_minutes / summary.answered_calls : 0;

    // Calculate derived metrics for users
    const userList = Object.values(summary.user_breakdown).map(u => ({
      ...u,
      answer_rate_percent: u.total_calls > 0 ? (u.answered_calls / u.total_calls) * 100 : 0,
      missed_rate_percent: u.total_calls > 0 ? (u.missed_calls / u.total_calls) * 100 : 0,
      avg_call_duration_minutes: u.total_calls > 0 ? u.total_duration_minutes / u.total_calls : 0,
      avg_answered_call_duration_minutes: u.answered_calls > 0 ? u.total_duration_minutes / u.answered_calls : 0
    }));

    // Weekly trend (aggregate all users by week)
    const weeklyTrend = {};
    allLogs.forEach(log => {
      if (!weeklyTrend[log.week_ending]) {
        weeklyTrend[log.week_ending] = { date: log.week_ending, total_calls: 0, answered_calls: 0, missed_calls: 0 };
      }
      weeklyTrend[log.week_ending].total_calls += log.total_calls || 0;
      weeklyTrend[log.week_ending].answered_calls += log.answered_calls || 0;
      weeklyTrend[log.week_ending].missed_calls += log.missed_calls || 0;
    });
    const trend = Object.values(weeklyTrend).sort((a, b) => new Date(a.date) - new Date(b.date));

    return Response.json({
      summary: {
        ...summary,
        user_breakdown: undefined // Remove raw object from summary
      },
      user_breakdown: userList,
      trend
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});