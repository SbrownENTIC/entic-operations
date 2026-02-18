import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { month, user: filterUser } = await req.json();

    // Calculate start and end of the selected month
    let startOfMonthStr, endOfMonthStr;
    
    if (month) {
        // month is YYYY-MM-DD (first of month)
        const d = new Date(month);
        startOfMonthStr = month;
        
        // Calculate next month first day
        const nextMonth = new Date(d);
        nextMonth.setMonth(d.getMonth() + 1);
        endOfMonthStr = nextMonth.toISOString().split('T')[0];
    } else {
        // Default to current month if not provided
        const d = new Date();
        d.setDate(1);
        startOfMonthStr = d.toISOString().split('T')[0];
        const nextMonth = new Date(d);
        nextMonth.setMonth(d.getMonth() + 1);
        endOfMonthStr = nextMonth.toISOString().split('T')[0];
    }

    // Build filter
    // We want periods that START within the selected month
    // reporting_period_start >= startOfMonth AND reporting_period_start < endOfMonth
    const filter = {
        reporting_period_start: {
            $gte: startOfMonthStr,
            $lt: endOfMonthStr
        }
    };
    
    if (filterUser && filterUser !== 'all') {
      filter.user = filterUser;
    }

    // Fetch records
    // Assuming < 2000 records per month (users * periods)
    const logs = await base44.entities.CallLogPeriod.filter(filter, 'user', 1000);

    // Aggregate Data
    const summary = {
      total_calls: 0,
      inbound_calls: 0,
      outbound_calls: 0,
      answered_calls: 0,
      missed_calls: 0,
      voicemail_calls: 0,
      total_duration_seconds: 0,
      inbound_duration_seconds: 0,
      outbound_duration_seconds: 0,
      user_breakdown: {}
    };

    logs.forEach(log => {
        // Global totals
        summary.total_calls += log.total_calls || 0;
        summary.inbound_calls += log.inbound_calls || 0;
        summary.outbound_calls += log.outbound_calls || 0;
        summary.answered_calls += log.answered_calls || 0;
        summary.missed_calls += log.missed_calls || 0;
        summary.voicemail_calls += log.voicemail_calls || 0;
        summary.total_duration_seconds += log.total_duration_seconds || 0;
        summary.inbound_duration_seconds += log.inbound_duration_seconds || 0;
        summary.outbound_duration_seconds += log.outbound_duration_seconds || 0;

        // User breakdown aggregation
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
                total_duration_seconds: 0,
                inbound_duration_seconds: 0,
                outbound_duration_seconds: 0,
                weeks: [] // For trend
            };
        }
        
        const u = summary.user_breakdown[userName];
        u.total_calls += log.total_calls || 0;
        u.inbound_calls += log.inbound_calls || 0;
        u.outbound_calls += log.outbound_calls || 0;
        u.answered_calls += log.answered_calls || 0;
        u.missed_calls += log.missed_calls || 0;
        u.voicemail_calls += log.voicemail_calls || 0;
        u.total_duration_seconds += log.total_duration_seconds || 0;
        u.inbound_duration_seconds += log.inbound_duration_seconds || 0;
        u.outbound_duration_seconds += log.outbound_duration_seconds || 0;
        
        // Add to weeks (using reporting start as "week" marker for trend chart)
        u.weeks.push({
            date: log.reporting_period_start,
            calls: log.total_calls || 0
        });
    });

    // Calculate global derived metrics
    summary.answer_rate_percent = summary.total_calls > 0 ? (summary.answered_calls / summary.total_calls) * 100 : 0;
    summary.missed_rate_percent = summary.total_calls > 0 ? (summary.missed_calls / summary.total_calls) * 100 : 0;
    summary.avg_call_duration_seconds = summary.total_calls > 0 ? summary.total_duration_seconds / summary.total_calls : 0;
    summary.avg_answered_call_duration_seconds = summary.answered_calls > 0 ? summary.total_duration_seconds / summary.answered_calls : 0;

    // Calculate user derived metrics
    const userList = Object.values(summary.user_breakdown).map(u => ({
        ...u,
        answer_rate_percent: u.total_calls > 0 ? (u.answered_calls / u.total_calls) * 100 : 0,
        missed_rate_percent: u.total_calls > 0 ? (u.missed_calls / u.total_calls) * 100 : 0,
        avg_call_duration_seconds: u.total_calls > 0 ? u.total_duration_seconds / u.total_calls : 0,
        avg_answered_call_duration_seconds: u.answered_calls > 0 ? u.total_duration_seconds / u.answered_calls : 0
    }));

    // Generate trend data (aggregated by period start date)
    const trendMap = {};
    logs.forEach(log => {
        const date = log.reporting_period_start;
        if (!trendMap[date]) {
            trendMap[date] = { date, total_calls: 0, answered_calls: 0, missed_calls: 0 };
        }
        trendMap[date].total_calls += log.total_calls || 0;
        trendMap[date].answered_calls += log.answered_calls || 0;
        trendMap[date].missed_calls += log.missed_calls || 0;
    });
    
    const trend = Object.values(trendMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    return Response.json({
      summary: {
        ...summary,
        user_breakdown: undefined
      },
      user_breakdown: userList,
      trend
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});