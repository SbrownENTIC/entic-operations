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
      filter.month = month;
    }
    if (filterUser && filterUser !== 'all') {
      filter.user = filterUser;
    }

    // Fetch monthly records
    // Assuming < 1000 users per month
    const logs = await base44.entities.CallLog.filter(filter, 'user', 1000);

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
    };

    const user_breakdown = logs.map(log => {
        // Update global summary
        summary.total_calls += log.total_calls || 0;
        summary.inbound_calls += log.inbound_calls || 0;
        summary.outbound_calls += log.outbound_calls || 0;
        summary.answered_calls += log.answered_calls || 0;
        summary.missed_calls += log.missed_calls || 0;
        summary.voicemail_calls += log.voicemail_calls || 0;
        summary.total_duration_seconds += log.total_duration_seconds || 0;
        summary.inbound_duration_seconds += log.inbound_duration_seconds || 0;
        summary.outbound_duration_seconds += log.outbound_duration_seconds || 0;

        // Calculate per-user metrics
        const total = log.total_calls || 0;
        const answered = log.answered_calls || 0;
        const missed = log.missed_calls || 0;
        const duration = log.total_duration_seconds || 0;

        return {
            ...log,
            answer_rate_percent: total > 0 ? (answered / total) * 100 : 0,
            missed_rate_percent: total > 0 ? (missed / total) * 100 : 0,
            avg_call_duration_seconds: total > 0 ? duration / total : 0,
            avg_answered_call_duration_seconds: answered > 0 ? duration / answered : 0
        };
    });

    // Calculate global metrics
    summary.answer_rate_percent = summary.total_calls > 0 ? (summary.answered_calls / summary.total_calls) * 100 : 0;
    summary.missed_rate_percent = summary.total_calls > 0 ? (summary.missed_calls / summary.total_calls) * 100 : 0;
    summary.avg_call_duration_seconds = summary.total_calls > 0 ? summary.total_duration_seconds / summary.total_calls : 0;
    summary.avg_answered_call_duration_seconds = summary.answered_calls > 0 ? summary.total_duration_seconds / summary.answered_calls : 0;

    return Response.json({
      summary,
      user_breakdown
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});