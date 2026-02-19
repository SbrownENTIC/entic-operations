import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REQUIRED_HEADERS = [
  "User",
  "Total Calls",
  "Inbound",
  "Outbound",
  "Answered",
  "Missed",
  "Total Call Duration (Minutes)",
  "Inbound Call Duration (Minutes)",
  "Outbound Call Duration (Minutes)"
];

function classifyPeriod(startStr, endStr) {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  // Monthly: starts on first day of a month and ends on last day of same month
  const isFirstDay = start.getDate() === 1;
  const nextDay = new Date(end);
  nextDay.setDate(nextDay.getDate() + 1);
  const isLastDay = nextDay.getDate() === 1 && nextDay.getMonth() === end.getMonth() + 1 % 12 || nextDay.getDate() === 1;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (isFirstDay && sameMonth) {
    // Check if end is actually the last day of the month
    const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    if (end.getDate() === lastDayOfMonth) {
      return "Monthly";
    }
  }

  // Weekly: inclusive duration <= 5 days means end - start <= 4 days
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays <= 4) {
    return "Weekly";
  }

  return "Custom Range";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows, periodStart, periodEnd, fileName } = await req.json();

    if (!periodStart || !periodEnd) {
      return Response.json({ error: 'Reporting period start and end dates are required.' }, { status: 400 });
    }

    if (!rows || rows.length === 0) {
      return Response.json({ error: 'No data rows provided.' }, { status: 400 });
    }

    // Validate headers from the first row keys
    const headers = Object.keys(rows[0]);
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return Response.json({ error: 'Invalid file format. Required headers missing.' }, { status: 400 });
    }

    // Aggregate by user
    const aggregated = {};
    for (const row of rows) {
      const userName = (row["User"] || "").trim();
      if (!userName) continue; // skip blank user rows

      const key = userName.toLowerCase();
      if (!aggregated[key]) {
        aggregated[key] = {
          user: userName,
          total_calls: 0,
          inbound: 0,
          outbound: 0,
          answered: 0,
          missed: 0,
          total_duration_minutes: 0,
          inbound_duration_minutes: 0,
          outbound_duration_minutes: 0
        };
      }

      aggregated[key].total_calls += Number(row["Total Calls"]) || 0;
      aggregated[key].inbound += Number(row["Inbound"]) || 0;
      aggregated[key].outbound += Number(row["Outbound"]) || 0;
      aggregated[key].answered += Number(row["Answered"]) || 0;
      aggregated[key].missed += Number(row["Missed"]) || 0;
      aggregated[key].total_duration_minutes += Number(row["Total Call Duration (Minutes)"]) || 0;
      aggregated[key].inbound_duration_minutes += Number(row["Inbound Call Duration (Minutes)"]) || 0;
      aggregated[key].outbound_duration_minutes += Number(row["Outbound Call Duration (Minutes)"]) || 0;
    }

    // Compute derived metrics
    const userSummaries = Object.values(aggregated).map(u => ({
      ...u,
      answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
      avg_duration_minutes: u.total_calls > 0 ? u.total_duration_minutes / u.total_calls : 0
    }));

    // Classify the period
    const status = classifyPeriod(periodStart, periodEnd);

    // Check for duplicate period (same start + end)
    const existingPeriods = await base44.asServiceRole.entities.CallLogPeriod.filter({
      reporting_period_start: periodStart,
      reporting_period_end: periodEnd
    });

    let periodId;
    if (existingPeriods && existingPeriods.length > 0) {
      // Replace: delete old user summaries for this period
      periodId = existingPeriods[0].id;
      const oldSummaries = await base44.asServiceRole.entities.CallLogUserSummary.filter({ period_id: periodId });
      for (const s of oldSummaries) {
        await base44.asServiceRole.entities.CallLogUserSummary.delete(s.id);
      }
      // Update the period record
      await base44.asServiceRole.entities.CallLogPeriod.update(periodId, {
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString(),
        status
      });
    } else {
      // Create new period
      const period = await base44.asServiceRole.entities.CallLogPeriod.create({
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        status,
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      });
      periodId = period.id;
    }

    // Bulk create user summaries
    for (const summary of userSummaries) {
      await base44.asServiceRole.entities.CallLogUserSummary.create({
        period_id: periodId,
        ...summary
      });
    }

    return Response.json({
      success: true,
      period_id: periodId,
      status,
      users_imported: userSummaries.length,
      is_replacement: existingPeriods && existingPeriods.length > 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});