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

function parseMinutesToSeconds(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).trim());
  if (isNaN(n)) return 0;
  return Math.round(n * 60);
}

function classifyMonthlyStatus(weekStart, weekEnd, monthKey) {
  const [sy, sm] = monthKey.split('-').map(Number);
  const firstDay = `${monthKey}-01`;
  const lastDay = new Date(sy, sm, 0).getDate();
  const lastDayStr = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  if (weekStart === firstDay && weekEnd === lastDayStr) return "Monthly";
  return "Monthly (Aggregated)";
}

/**
 * Group rows by (Reporting Period Start, Reporting Period End) pairs.
 * Returns array of { weekStart, weekEnd, rows } or { error }.
 */
function groupRowsByWeek(rows, headerMap) {
  const hasStart = PERIOD_COL_START in headerMap;
  const hasEnd   = PERIOD_COL_END   in headerMap;

  if (!hasStart || !hasEnd) {
    return { error: 'Reporting Period Start and End columns are required in the worksheet.' };
  }

  const groups = new Map(); // key: "start|end" -> { weekStart, weekEnd, rows[] }

  for (const row of rows) {
    const weekStart = toIsoDate(row[headerMap[PERIOD_COL_START]]);
    const weekEnd   = toIsoDate(row[headerMap[PERIOD_COL_END]]);

    if (!weekStart || !weekEnd) continue; // skip rows with no period

    const key = `${weekStart}|${weekEnd}`;
    if (!groups.has(key)) {
      groups.set(key, { weekStart, weekEnd, rows: [] });
    }
    groups.get(key).rows.push(row);
  }

  if (groups.size === 0) {
    return { error: 'No rows with valid Reporting Period Start/End found.' };
  }

  return { groups: [...groups.values()] };
}

/** Aggregate user data from a group of rows */
function aggregateUsers(rows, headerMap) {
  const get = (row, name) => row[headerMap[name]];
  const agg = {};

  for (const row of rows) {
    const userName = String(get(row, 'user') || '').trim();
    if (!userName) continue;

    const key = userName.toLowerCase();
    if (!agg[key]) {
      agg[key] = {
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

    agg[key].total_calls               += Number(get(row, 'total calls'))                              || 0;
    agg[key].inbound                   += Number(get(row, 'inbound calls'))                            || 0;
    agg[key].outbound                  += Number(get(row, 'outbound calls'))                           || 0;
    agg[key].answered                  += Number(get(row, 'answered calls'))                           || 0;
    agg[key].missed                    += Number(get(row, 'missed calls'))                             || 0;
    agg[key].voicemail                 += Number(get(row, 'voicemail calls'))                          || 0;
    agg[key].total_duration_seconds    += parseMinutesToSeconds(get(row, 'total call duration (minutes)'));
    agg[key].inbound_duration_seconds  += parseMinutesToSeconds(get(row, 'inbound call duration (minutes)'));
    agg[key].outbound_duration_seconds += parseMinutesToSeconds(get(row, 'outbound call duration (minutes)'));
  }

  return Object.values(agg);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows, fileName } = await req.json();

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

    // Group rows by week (Reporting Period Start + End pairs)
    const groupResult = groupRowsByWeek(rows, headerMap);
    if (groupResult.error) {
      return Response.json({ error: groupResult.error }, { status: 400 });
    }

    const weekGroups = groupResult.groups;

    // Determine which month(s) are involved (group weeks by month)
    // For simplicity, process each week and handle its monthly record independently
    const monthCache = new Map(); // monthKey -> { period, summaries }

    let weeksAdded = 0;
    let weeksDuplicate = 0;

    // Load/cache monthly records for all months involved
    const monthKeys = [...new Set(weekGroups.map(g => g.weekStart.substring(0, 7)))];
    for (const monthKey of monthKeys) {
      const existing = await base44.asServiceRole.entities.CallLogPeriod.filter({ monthly_key: monthKey });
      const period = existing && existing.length > 0 ? existing[0] : null;
      let summaries = [];
      if (period) {
        summaries = await base44.asServiceRole.entities.CallLogUserSummary.filter({ period_id: period.id });
      }
      monthCache.set(monthKey, { period, summaries });
    }

    // Process each week group
    for (const group of weekGroups) {
      const { weekStart, weekEnd, rows: weekRows } = group;
      const monthKey = weekStart.substring(0, 7);
      const cache = monthCache.get(monthKey);

      const weekUserData = aggregateUsers(weekRows, headerMap);

      if (cache.period) {
        // Check for duplicate week
        const uploadedWeeks = cache.period.uploaded_weeks || [];
        const isDuplicate = uploadedWeeks.some(
          w => w.week_start === weekStart && w.week_end === weekEnd
        );

        if (isDuplicate) {
          weeksDuplicate++;
          continue; // Skip duplicate weeks
        }

        // Merge into existing summaries (in-memory, will persist after loop)
        for (const weekUser of weekUserData) {
          const key = (weekUser.user || '').toLowerCase();
          const existingIdx = cache.summaries.findIndex(
            s => (s.user || '').toLowerCase() === key
          );

          if (existingIdx >= 0) {
            cache.summaries[existingIdx].total_calls               += weekUser.total_calls;
            cache.summaries[existingIdx].inbound                   += weekUser.inbound;
            cache.summaries[existingIdx].outbound                  += weekUser.outbound;
            cache.summaries[existingIdx].answered                  += weekUser.answered;
            cache.summaries[existingIdx].missed                    += weekUser.missed;
            cache.summaries[existingIdx].voicemail                  = (cache.summaries[existingIdx].voicemail || 0) + weekUser.voicemail;
            cache.summaries[existingIdx].total_duration_seconds    += weekUser.total_duration_seconds;
            cache.summaries[existingIdx].inbound_duration_seconds  += weekUser.inbound_duration_seconds;
            cache.summaries[existingIdx].outbound_duration_seconds += weekUser.outbound_duration_seconds;
            cache.summaries[existingIdx]._dirty = true;
          } else {
            cache.summaries.push({
              ...weekUser,
              period_id: cache.period.id,
              _isNew: true
            });
          }
        }

        // Track week in uploaded_weeks
        uploadedWeeks.push({
          week_start: weekStart,
          week_end: weekEnd,
          user_snapshot: weekUserData,
          processed_at: new Date().toISOString()
        });
        cache.period._updatedWeeks = uploadedWeeks;
        cache.period._hasNewWeeks = true;
        weeksAdded++;

      } else {
        // New monthly record — create it with initial data
        const weekEntry = {
          week_start: weekStart,
          week_end: weekEnd,
          user_snapshot: weekUserData,
          processed_at: new Date().toISOString()
        };

        const newPeriod = await base44.asServiceRole.entities.CallLogPeriod.create({
          reporting_period_start: weekStart,
          reporting_period_end: weekEnd,
          monthly_key: monthKey,
          status: "Monthly (Aggregated)",
          uploaded_weeks: [weekEntry],
          source_file_name: fileName,
          uploaded_by: user.email,
          uploaded_at: new Date().toISOString()
        });

        const userSummaries = weekUserData.map(u => ({
          ...u,
          period_id: newPeriod.id,
          answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
          avg_duration_seconds: u.total_calls > 0 ? u.total_duration_seconds / u.total_calls : 0
        }));

        for (const summary of userSummaries) {
          await base44.asServiceRole.entities.CallLogUserSummary.create(summary);
        }

        // Update cache so subsequent weeks in same month can use this period
        cache.period = newPeriod;
        cache.summaries = userSummaries;
        monthCache.set(monthKey, cache);

        weeksAdded++;
      }
    }

    // If all were duplicates
    if (weeksAdded === 0) {
      return Response.json({
        success: true,
        weeks_added: 0,
        weeks_duplicate: weeksDuplicate,
        all_duplicate: true,
        message: "No new weeks were added. All selected weeks already exist."
      });
    }

    // Persist updated monthly records (for months that had new weeks added)
    for (const [monthKey, cache] of monthCache.entries()) {
      if (!cache.period || !cache.period._hasNewWeeks) continue;

      // Recalculate derived metrics for all summaries
      for (const s of cache.summaries) {
        s.answer_rate = s.total_calls > 0 ? s.answered / s.total_calls : 0;
        s.avg_duration_seconds = s.total_calls > 0 ? s.total_duration_seconds / s.total_calls : 0;
      }

      // Persist summaries
      for (const s of cache.summaries) {
        if (s._isNew) {
          const { _isNew, ...data } = s;
          await base44.asServiceRole.entities.CallLogUserSummary.create(data);
        } else if (s._dirty) {
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

      // Recompute period span and status from all uploaded weeks
      const allWeeks = cache.period._updatedWeeks || (cache.period.uploaded_weeks || []);
      const allStarts = allWeeks.map(w => w.week_start).sort();
      const allEnds   = allWeeks.map(w => w.week_end).sort();
      const spanStart = allStarts[0];
      const spanEnd   = allEnds[allEnds.length - 1];
      const newStatus = classifyMonthlyStatus(spanStart, spanEnd, monthKey);

      await base44.asServiceRole.entities.CallLogPeriod.update(cache.period.id, {
        reporting_period_start: spanStart,
        reporting_period_end: spanEnd,
        status: newStatus,
        uploaded_weeks: allWeeks,
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      weeks_added: weeksAdded,
      weeks_duplicate: weeksDuplicate,
      all_duplicate: false,
      message: weeksAdded === 1 && weeksDuplicate === 0
        ? `${weeksAdded} week added.`
        : weeksDuplicate > 0
          ? `${weeksAdded} week${weeksAdded !== 1 ? 's' : ''} added, ${weeksDuplicate} duplicate${weeksDuplicate !== 1 ? 's' : ''} skipped.`
          : `${weeksAdded} week${weeksAdded !== 1 ? 's' : ''} added.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});