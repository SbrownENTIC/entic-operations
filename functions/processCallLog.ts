import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildHeaderMap(sampleRow) {
  const map = {};
  for (const key of Object.keys(sampleRow)) {
    map[normalizeHeader(key)] = key;
  }
  return map;
}

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

const PERIOD_COL_START = "reporting period start";
const PERIOD_COL_END   = "reporting period end";

/** Convert various date formats to YYYY-MM-DD */
function toIsoDate(val) {
  if (!val && val !== 0) return null;
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${String(mdy[1]).padStart(2,"0")}-${String(mdy[2]).padStart(2,"0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  return null;
}

/** Extract period start/end from row data if columns exist */
function extractPeriodFromRows(rows, headerMap) {
  const hasStart = PERIOD_COL_START in headerMap;
  const hasEnd   = PERIOD_COL_END   in headerMap;
  if (!hasStart || !hasEnd) return null; // columns not present

  const startVals = rows.map(r => toIsoDate(r[headerMap[PERIOD_COL_START]])).filter(Boolean);
  const endVals   = rows.map(r => toIsoDate(r[headerMap[PERIOD_COL_END]])).filter(Boolean);

  if (!startVals.length || !endVals.length) return null;

  const uniqueStarts = [...new Set(startVals)];
  const uniqueEnds   = [...new Set(endVals)];

  if (uniqueStarts.length > 1) {
    return { error: `Inconsistent Reporting Period Start values (found: ${uniqueStarts.join(", ")}).` };
  }
  if (uniqueEnds.length > 1) {
    return { error: `Inconsistent Reporting Period End values (found: ${uniqueEnds.join(", ")}).` };
  }

  return { start: uniqueStarts[0], end: uniqueEnds[0] };
}

function parseMinutesToSeconds(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).trim());
  if (isNaN(n)) return 0;
  return Math.round(n * 60);
}

// Determine monthly status: true Monthly only if week covers entire month
function classifyMonthlyStatus(weekStart, weekEnd, monthKey) {
  const [sy, sm] = monthKey.split('-').map(Number);
  const firstDay = `${monthKey}-01`;
  const lastDay = new Date(sy, sm, 0).getDate();
  const lastDayStr = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  if (weekStart === firstDay && weekEnd === lastDayStr) return "Monthly";
  return "Monthly (Aggregated)";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows, periodStart: clientStart, periodEnd: clientEnd, fileName, replaceWeek } = await req.json();

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

    // Determine period dates: prefer worksheet columns, fall back to client-provided values
    const periodExtracted = extractPeriodFromRows(rows, headerMap);

    let periodStart, periodEnd;

    if (periodExtracted && periodExtracted.error) {
      return Response.json({ error: periodExtracted.error }, { status: 400 });
    }

    if (periodExtracted && periodExtracted.start && periodExtracted.end) {
      // Use dates from worksheet columns (source of truth)
      periodStart = periodExtracted.start;
      periodEnd   = periodExtracted.end;
    } else if (clientStart && clientEnd) {
      // Fallback: use client-provided dates (backward compat)
      periodStart = clientStart;
      periodEnd   = clientEnd;
    } else {
      return Response.json({
        error: 'Reporting Period Start and End columns are required in the worksheet.'
      }, { status: 400 });
    }

    const get = (row, normalizedName) => row[headerMap[normalizedName]];

    // Determine monthly key from periodStart (YYYY-MM)
    const monthKey = periodStart.substring(0, 7);

    // Aggregate this week's data by user
    const weekAgg = {};
    for (const row of rows) {
      const userName = String(get(row, 'user') || '').trim();
      if (!userName) continue;

      const key = userName.toLowerCase();
      if (!weekAgg[key]) {
        weekAgg[key] = {
          user: userName,
          total_calls: 0,
          inbound: 0,
          outbound: 0,
          answered: 0,
          missed: 0,
          voicemail: 0,
          total_duration_seconds: 0,
          inbound_duration_seconds: 0,
          outbound_duration_seconds: 0
        };
      }

      weekAgg[key].total_calls              += Number(get(row, 'total calls'))              || 0;
      weekAgg[key].inbound                  += Number(get(row, 'inbound calls'))             || 0;
      weekAgg[key].outbound                 += Number(get(row, 'outbound calls'))            || 0;
      weekAgg[key].answered                 += Number(get(row, 'answered calls'))            || 0;
      weekAgg[key].missed                   += Number(get(row, 'missed calls'))              || 0;
      weekAgg[key].voicemail                += Number(get(row, 'voicemail calls'))           || 0;
      weekAgg[key].total_duration_seconds   += parseMinutesToSeconds(get(row, 'total call duration (minutes)'));
      weekAgg[key].inbound_duration_seconds += parseMinutesToSeconds(get(row, 'inbound call duration (minutes)'));
      weekAgg[key].outbound_duration_seconds+= parseMinutesToSeconds(get(row, 'outbound call duration (minutes)'));
    }

    const weekUserData = Object.values(weekAgg);

    // --- Find existing monthly record ---
    const existingMonths = await base44.asServiceRole.entities.CallLogPeriod.filter({ monthly_key: monthKey });
    const existingPeriod = existingMonths && existingMonths.length > 0 ? existingMonths[0] : null;

    if (existingPeriod) {
      const uploadedWeeks = existingPeriod.uploaded_weeks || [];

      // Check for duplicate week
      const isDuplicate = uploadedWeeks.some(
        w => w.week_start === periodStart && w.week_end === periodEnd
      );

      if (isDuplicate && !replaceWeek) {
        // Return a special flag so the UI can prompt the user
        return Response.json({
          duplicate_week: true,
          message: "This weekly reporting range has already been uploaded for this month.",
          week_start: periodStart,
          week_end: periodEnd,
          month: monthKey
        });
      }

      // Load existing user summaries for this month
      const existingSummaries = await base44.asServiceRole.entities.CallLogUserSummary.filter({
        period_id: existingPeriod.id
      });

      let updatedSummaries = existingSummaries.map(s => ({ ...s }));

      if (isDuplicate && replaceWeek) {
        // We need to subtract the prior week's contribution.
        // Since we don't store per-week user data separately, we store it in the week entry.
        // Find old week entry to get prior snapshot
        const oldWeekEntry = uploadedWeeks.find(
          w => w.week_start === periodStart && w.week_end === periodEnd
        );

        if (oldWeekEntry && oldWeekEntry.user_snapshot) {
          for (const priorUser of oldWeekEntry.user_snapshot) {
            const key = (priorUser.user || '').toLowerCase();
            const existing = updatedSummaries.find(
              s => (s.user || '').toLowerCase() === key
            );
            if (existing) {
              existing.total_calls              -= priorUser.total_calls || 0;
              existing.inbound                  -= priorUser.inbound || 0;
              existing.outbound                 -= priorUser.outbound || 0;
              existing.answered                 -= priorUser.answered || 0;
              existing.missed                   -= priorUser.missed || 0;
              existing.voicemail                -= priorUser.voicemail || 0;
              existing.total_duration_seconds   -= priorUser.total_duration_seconds || 0;
              existing.inbound_duration_seconds -= priorUser.inbound_duration_seconds || 0;
              existing.outbound_duration_seconds-= priorUser.outbound_duration_seconds || 0;
            }
          }
        }
      }

      // Merge new week data into summaries
      for (const weekUser of weekUserData) {
        const key = (weekUser.user || '').toLowerCase();
        const existingIdx = updatedSummaries.findIndex(
          s => (s.user || '').toLowerCase() === key
        );

        if (existingIdx >= 0) {
          updatedSummaries[existingIdx].total_calls               += weekUser.total_calls;
          updatedSummaries[existingIdx].inbound                   += weekUser.inbound;
          updatedSummaries[existingIdx].outbound                  += weekUser.outbound;
          updatedSummaries[existingIdx].answered                  += weekUser.answered;
          updatedSummaries[existingIdx].missed                    += weekUser.missed;
          updatedSummaries[existingIdx].voicemail                 = (updatedSummaries[existingIdx].voicemail || 0) + weekUser.voicemail;
          updatedSummaries[existingIdx].total_duration_seconds    += weekUser.total_duration_seconds;
          updatedSummaries[existingIdx].inbound_duration_seconds  += weekUser.inbound_duration_seconds;
          updatedSummaries[existingIdx].outbound_duration_seconds += weekUser.outbound_duration_seconds;
        } else {
          // New user for this month - will be created
          updatedSummaries.push({
            ...weekUser,
            period_id: existingPeriod.id,
            _isNew: true
          });
        }
      }

      // Recalculate derived metrics
      updatedSummaries = updatedSummaries.map(s => ({
        ...s,
        answer_rate: s.total_calls > 0 ? s.answered / s.total_calls : 0,
        avg_duration_seconds: s.total_calls > 0 ? s.total_duration_seconds / s.total_calls : 0
      }));

      // Persist: update existing summaries, create new ones
      for (const s of updatedSummaries) {
        if (s._isNew) {
          const { _isNew, ...data } = s;
          await base44.asServiceRole.entities.CallLogUserSummary.create(data);
        } else {
          await base44.asServiceRole.entities.CallLogUserSummary.update(s.id, {
            total_calls: s.total_calls,
            inbound: s.inbound,
            outbound: s.outbound,
            answered: s.answered,
            missed: s.missed,
            voicemail: s.voicemail,
            total_duration_seconds: s.total_duration_seconds,
            inbound_duration_seconds: s.inbound_duration_seconds,
            outbound_duration_seconds: s.outbound_duration_seconds,
            answer_rate: s.answer_rate,
            avg_duration_seconds: s.avg_duration_seconds
          });
        }
      }

      // Update uploaded_weeks: remove old entry if replacing, then append new
      let newUploadedWeeks = isDuplicate && replaceWeek
        ? uploadedWeeks.filter(w => !(w.week_start === periodStart && w.week_end === periodEnd))
        : [...uploadedWeeks];

      newUploadedWeeks.push({
        week_start: periodStart,
        week_end: periodEnd,
        user_snapshot: weekUserData // store for potential future rollback
      });

      // Recompute period start/end to span all uploaded weeks
      const allStarts = newUploadedWeeks.map(w => w.week_start).sort();
      const allEnds   = newUploadedWeeks.map(w => w.week_end).sort();
      const spanStart = allStarts[0];
      const spanEnd   = allEnds[allEnds.length - 1];
      const newStatus = classifyMonthlyStatus(spanStart, spanEnd, monthKey);

      await base44.asServiceRole.entities.CallLogPeriod.update(existingPeriod.id, {
        reporting_period_start: spanStart,
        reporting_period_end: spanEnd,
        status: newStatus,
        uploaded_weeks: newUploadedWeeks,
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      });

      return Response.json({
        success: true,
        period_id: existingPeriod.id,
        status: newStatus,
        users_imported: weekUserData.length,
        is_replacement: isDuplicate,
        weeks_in_month: newUploadedWeeks.length
      });

    } else {
      // --- Create new monthly record ---
      const status = classifyMonthlyStatus(periodStart, periodEnd, monthKey);

      const weekEntry = {
        week_start: periodStart,
        week_end: periodEnd,
        user_snapshot: weekUserData
      };

      const period = await base44.asServiceRole.entities.CallLogPeriod.create({
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        monthly_key: monthKey,
        status,
        uploaded_weeks: [weekEntry],
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      });

      const userSummaries = weekUserData.map(u => ({
        ...u,
        period_id: period.id,
        answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
        avg_duration_seconds: u.total_calls > 0 ? u.total_duration_seconds / u.total_calls : 0
      }));

      for (const summary of userSummaries) {
        await base44.asServiceRole.entities.CallLogUserSummary.create(summary);
      }

      return Response.json({
        success: true,
        period_id: period.id,
        status,
        users_imported: userSummaries.length,
        is_replacement: false,
        weeks_in_month: 1
      });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});