import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalize a header string: lowercase + collapse whitespace
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Build a lookup map from normalized header -> actual key in the row object
function buildHeaderMap(sampleRow) {
  const map = {};
  for (const key of Object.keys(sampleRow)) {
    map[normalizeHeader(key)] = key;
  }
  return map;
}

// Required logical field names (normalized)
const REQUIRED_NORMALIZED = [
  "user",
  "total calls",
  "inbound calls",
  "outbound calls",
  "answered calls",
  "missed calls",
  "voicemail calls",
  "total call duration (minutes)",
  "inbound call duration (minutes)",
  "outbound call duration (minutes)"
];

// Parse a numeric minutes value → seconds (stored as seconds in DB)
function parseMinutesToSeconds(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).trim());
  if (isNaN(n)) return 0;
  return Math.round(n * 60);
}

function classifyPeriod(startStr, endStr) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);

  // Monthly: starts on 1st, ends on last day of same month
  if (sd === 1 && sy === ey && sm === em) {
    const lastDay = new Date(sy, sm, 0).getDate(); // day 0 of next month = last day of this month
    if (ed === lastDay) return "Monthly";
  }

  // Weekly: inclusive duration <= 5 days
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays <= 4) return "Weekly";

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

    // Build normalized header map from first row
    const headerMap = buildHeaderMap(rows[0]);

    // Validate required headers
    const missing = REQUIRED_NORMALIZED.filter(h => !(h in headerMap));
    if (missing.length > 0) {
      return Response.json({
        error: `Invalid file format. Required headers missing: ${missing.join(', ')}`
      }, { status: 400 });
    }

    // Helper to safely get a value by normalized header name
    const get = (row, normalizedName) => row[headerMap[normalizedName]];

    // Aggregate by user
    const aggregated = {};
    for (const row of rows) {
      const userName = String(get(row, 'user') || '').trim();
      if (!userName) continue;

      const key = userName.toLowerCase();
      if (!aggregated[key]) {
        aggregated[key] = {
          user: userName,
          total_calls: 0,
          inbound: 0,
          outbound: 0,
          answered: 0,
          missed: 0,
          total_duration_seconds: 0,
          inbound_duration_seconds: 0,
          outbound_duration_seconds: 0
        };
      }

      aggregated[key].total_calls           += Number(get(row, 'total calls')) || 0;
      aggregated[key].inbound               += Number(get(row, 'inbound calls')) || 0;
      aggregated[key].outbound              += Number(get(row, 'outbound calls')) || 0;
      aggregated[key].answered              += Number(get(row, 'answered calls')) || 0;
      aggregated[key].missed                += Number(get(row, 'missed calls')) || 0;
      aggregated[key].total_duration_seconds    += parseMinutesToSeconds(get(row, 'total call duration (minutes)'));
      aggregated[key].inbound_duration_seconds  += parseMinutesToSeconds(get(row, 'inbound call duration (minutes)'));
      aggregated[key].outbound_duration_seconds += parseMinutesToSeconds(get(row, 'outbound call duration (minutes)'));
    }

    // Compute derived metrics
    const userSummaries = Object.values(aggregated).map(u => ({
      ...u,
      answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
      avg_duration_seconds: u.total_calls > 0 ? u.total_duration_seconds / u.total_calls : 0
    }));

    const status = classifyPeriod(periodStart, periodEnd);

    // Check for duplicate period
    const existingPeriods = await base44.asServiceRole.entities.CallLogPeriod.filter({
      reporting_period_start: periodStart,
      reporting_period_end: periodEnd
    });

    let periodId;
    const isReplacement = existingPeriods && existingPeriods.length > 0;

    if (isReplacement) {
      periodId = existingPeriods[0].id;
      const oldSummaries = await base44.asServiceRole.entities.CallLogUserSummary.filter({ period_id: periodId });
      for (const s of oldSummaries) {
        await base44.asServiceRole.entities.CallLogUserSummary.delete(s.id);
      }
      await base44.asServiceRole.entities.CallLogPeriod.update(periodId, {
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString(),
        status
      });
    } else {
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
      is_replacement: isReplacement
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});