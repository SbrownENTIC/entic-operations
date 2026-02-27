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

/** Convert various date formats to YYYY-MM-DD (no week normalization — raw value only) */
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
  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY (4-digit year)
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) return `${mdy4[3]}-${String(mdy4[1]).padStart(2,"0")}-${String(mdy4[2]).padStart(2,"0")}`;
  // MM/DD/YY (2-digit year — treat 00-99 as 2000-2099)
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const year = 2000 + parseInt(mdy2[3], 10);
    return `${year}-${String(mdy2[1]).padStart(2,"0")}-${String(mdy2[2]).padStart(2,"0")}`;
  }
  return null;
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
 */
function groupRowsByWeek(rows, headerMap) {
  const hasStart = PERIOD_COL_START in headerMap;
  const hasEnd   = PERIOD_COL_END   in headerMap;
  if (!hasStart || !hasEnd) {
    return { error: 'Reporting Period Start and End columns are required in the worksheet.' };
  }
  const groups = new Map();
  for (const row of rows) {
    const weekStart = toIsoDate(row[headerMap[PERIOD_COL_START]]);
    const weekEnd   = toIsoDate(row[headerMap[PERIOD_COL_END]]);
    if (!weekStart || !weekEnd) continue;
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

/** Aggregate user data from a group of rows. Returns per-user objects with minute fields. */
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
        inbound_answered: 0,
        missed: 0,
        voicemail: 0,
        total_duration_minutes: 0,
        inbound_duration_minutes: 0,
        outbound_duration_minutes: 0,
      };
    }
    const totalMin = parseFloat(String(get(row, 'total call duration (minutes)') || '0').trim()) || 0;
    const inMin    = parseFloat(String(get(row, 'inbound call duration (minutes)') || '0').trim()) || 0;
    const outMin   = parseFloat(String(get(row, 'outbound call duration (minutes)') || '0').trim()) || 0;

    const totalCalls   = Number(get(row, 'total calls'))    || 0;
    const inboundCalls = Number(get(row, 'inbound calls'))  || 0;
    const outboundCalls= Number(get(row, 'outbound calls')) || 0;
    const answeredCalls= Number(get(row, 'answered calls')) || 0;
    // Inbound answered = answered minus outbound (outbound calls are always "answered")
    // Clamp to 0 to avoid negatives
    const inboundAnswered = Math.max(0, answeredCalls - outboundCalls);

    agg[key].total_calls               += totalCalls;
    agg[key].inbound                   += inboundCalls;
    agg[key].outbound                  += outboundCalls;
    agg[key].answered                  += answeredCalls;
    agg[key].inbound_answered          += inboundAnswered;
    agg[key].missed                    += Number(get(row, 'missed calls'))   || 0;
    agg[key].voicemail                 += Number(get(row, 'voicemail calls'))|| 0;
    agg[key].total_duration_minutes    += totalMin;
    agg[key].inbound_duration_minutes  += inMin;
    agg[key].outbound_duration_minutes += outMin;
  }
  return Object.values(agg);
}

/**
 * Build the enforced week snapshot shape:
 * { week_start, week_end, totals: {...}, user_snapshot: [...] }
 */
function buildWeekSnapshot(weekStart, weekEnd, weekUserData, userConfigMap) {
  const user_snapshot = weekUserData.map(u => {
    const cfg = userConfigMap[u.user] || null;
    const isActive = cfg && cfg.active !== false;
    return {
      user:                       u.user,
      total_calls:                u.total_calls,
      inbound:                    u.inbound,
      outbound:                   u.outbound,
      answered:                   u.answered,
      inbound_answered:           u.inbound_answered,
      missed:                     u.missed,
      voicemail:                  u.voicemail,
      total_duration_minutes:     u.total_duration_minutes,
      inbound_duration_minutes:   u.inbound_duration_minutes,
      outbound_duration_minutes:  u.outbound_duration_minutes,
      // Enriched from CallLogUserConfig
      location:              isActive ? (cfg.location || "") : "",
      benchmark_group:       isActive ? (cfg.benchmark_group || "Other") : "Other",
      include_in_benchmark:  isActive ? (cfg.include_in_benchmark || false) : false,
    };
  });

  // Compute totals from user_snapshot
  const totals = {
    total_calls:               user_snapshot.reduce((s, u) => s + (u.total_calls || 0), 0),
    inbound:                   user_snapshot.reduce((s, u) => s + (u.inbound || 0), 0),
    outbound:                  user_snapshot.reduce((s, u) => s + (u.outbound || 0), 0),
    answered:                  user_snapshot.reduce((s, u) => s + (u.answered || 0), 0),
    inbound_answered:          user_snapshot.reduce((s, u) => s + (u.inbound_answered || 0), 0),
    missed:                    user_snapshot.reduce((s, u) => s + (u.missed || 0), 0),
    voicemail:                 user_snapshot.reduce((s, u) => s + (u.voicemail || 0), 0),
    total_duration_minutes:    user_snapshot.reduce((s, u) => s + (u.total_duration_minutes || 0), 0),
    inbound_duration_minutes:  user_snapshot.reduce((s, u) => s + (u.inbound_duration_minutes || 0), 0),
    outbound_duration_minutes: user_snapshot.reduce((s, u) => s + (u.outbound_duration_minutes || 0), 0),
  };

  return {
    week_start: weekStart,
    week_end: weekEnd,
    processed_at: new Date().toISOString(),
    totals,
    user_snapshot,
  };
}

/** Validate snapshot: user_snapshot > 0, totals.total_calls === sum of user total_calls */
function validateSnapshot(snapshot) {
  if (!Array.isArray(snapshot.user_snapshot) || snapshot.user_snapshot.length === 0) {
    return { valid: false, reason: `user_snapshot is empty for week ${snapshot.week_start}–${snapshot.week_end}` };
  }
  const sumCalls = snapshot.user_snapshot.reduce((s, u) => s + (u.total_calls || 0), 0);
  if (snapshot.totals.total_calls !== sumCalls) {
    return { valid: false, reason: `totals.total_calls (${snapshot.totals.total_calls}) !== sum of user_snapshot total_calls (${sumCalls}) for week ${snapshot.week_start}–${snapshot.week_end}` };
  }
  return { valid: true };
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

    // Load CallLogUserConfig for enrichment
    const allUserConfigs = await base44.asServiceRole.entities.CallLogUserConfig.list();
    const userConfigMap = {};
    for (const cfg of allUserConfigs) {
      if (cfg.user_name) userConfigMap[cfg.user_name] = cfg;
    }

    const headerMap = buildHeaderMap(rows[0]);

    const missing = REQUIRED_NORMALIZED.filter(h => !(h in headerMap));
    if (missing.length > 0) {
      return Response.json({
        error: `Invalid file format. Required headers missing: ${missing.join(', ')}`
      }, { status: 400 });
    }

    const groupResult = groupRowsByWeek(rows, headerMap);
    if (groupResult.error) {
      return Response.json({ error: groupResult.error }, { status: 400 });
    }

    const weekGroups = groupResult.groups;

    // ---- LOG: detected weeks overview ----
    const monthKeys = [...new Set(weekGroups.map(g => g.weekStart.substring(0, 7)))];
    console.log(`[processCallLog] File: "${fileName}" | monthKeys: [${monthKeys.join(", ")}] | detectedWeeks: ${weekGroups.length}`);
    for (const g of weekGroups) {
      const distinctUsers = [...new Set(g.rows.map(r => String(r[headerMap['user']] || '').trim()).filter(Boolean))];
      console.log(`[processCallLog]   Week ${g.weekStart}–${g.weekEnd}: rowCount=${g.rows.length}, distinctUsers=${distinctUsers.length} [${distinctUsers.slice(0,5).join(", ")}${distinctUsers.length > 5 ? '...' : ''}]`);
    }

    const monthCache = new Map();
    for (const monthKey of monthKeys) {
      const existing = await base44.asServiceRole.entities.CallLogPeriod.filter({ monthly_key: monthKey });
      const period = existing && existing.length > 0 ? existing[0] : null;
      let summaries = [];
      if (period) {
        const raw = await base44.asServiceRole.entities.CallLogUserSummary.filter({ period_id: period.id });
        summaries = raw.map(s => ({ ...s }));
      }
      monthCache.set(monthKey, { period, summaries });
    }

    let weeksAdded = 0;
    let weeksReplaced = 0;

    for (const group of weekGroups) {
      const { weekStart, weekEnd, rows: weekRows } = group;
      const monthKey = weekStart.substring(0, 7);
      const cache = monthCache.get(monthKey);

      // Aggregate users for this week
      const weekUserData = aggregateUsers(weekRows, headerMap);

      // ---- LOG: computed weekly totals ----
      const weekTotalCalls   = weekUserData.reduce((s, u) => s + u.total_calls, 0);
      const weekTotalInbound = weekUserData.reduce((s, u) => s + u.inbound, 0);
      const weekTotalOut     = weekUserData.reduce((s, u) => s + u.outbound, 0);
      const weekTotalAns     = weekUserData.reduce((s, u) => s + u.answered, 0);
      const weekTotalMiss    = weekUserData.reduce((s, u) => s + u.missed, 0);
      const weekTotalDurMin  = weekUserData.reduce((s, u) => s + u.total_duration_minutes, 0);
      console.log(`[processCallLog]   Week ${weekStart}–${weekEnd} computed totals: total_calls=${weekTotalCalls}, inbound=${weekTotalInbound}, outbound=${weekTotalOut}, answered=${weekTotalAns}, missed=${weekTotalMiss}, total_duration_minutes=${weekTotalDurMin.toFixed(2)}, users=${weekUserData.length}`);
      const previewUsers = weekUserData.slice(0, 3);
      for (const pu of previewUsers) {
        console.log(`[processCallLog]     user="${pu.user}" total_calls=${pu.total_calls} total_duration_minutes=${pu.total_duration_minutes.toFixed(2)}`);
      }

      // Warn about unmapped users
      const unmapped = weekUserData.filter(u => !userConfigMap[u.user]).map(u => u.user);
      if (unmapped.length > 0) {
        console.warn(`[processCallLog] Unmapped call log users found (week ${weekStart}): ${unmapped.join(", ")}`);
      }

      // Build enforced snapshot shape (with enrichment)
      const weekSnapshot = buildWeekSnapshot(weekStart, weekEnd, weekUserData, userConfigMap);

      // Validate snapshot
      const validation = validateSnapshot(weekSnapshot);
      if (!validation.valid) {
        console.error(`[processCallLog] Snapshot validation failed: ${validation.reason}`);
        return Response.json({ error: `Week snapshot validation failed: totals and user snapshot do not match. ${validation.reason}` }, { status: 500 });
      }

      try {
        if (cache.period) {
          const existingWeeks = Array.isArray(cache.period.uploaded_weeks) ? cache.period.uploaded_weeks : [];
          const dupIdx = existingWeeks.findIndex(w => w.week_start === weekStart && w.week_end === weekEnd);

          if (dupIdx >= 0) {
            // Replace the existing week (not duplicate-skip)
            console.log(`[processCallLog]   Week ${weekStart}–${weekEnd}: replacing existing snapshot at index ${dupIdx}`);
            existingWeeks[dupIdx] = weekSnapshot;
            weeksReplaced++;
          } else {
            existingWeeks.push(weekSnapshot);
            weeksAdded++;
          }

          cache.period.uploaded_weeks = existingWeeks;

          // Rebuild monthly summaries from all weeks (recompute from scratch)
          const allUserTotals = {};
          for (const wk of existingWeeks) {
            for (const u of (wk.user_snapshot || [])) {
              const key = (u.user || '').toLowerCase();
              if (!allUserTotals[key]) {
                allUserTotals[key] = { user: u.user, total_calls: 0, inbound: 0, outbound: 0, answered: 0, inbound_answered: 0, missed: 0, voicemail: 0, total_duration_seconds: 0, inbound_duration_seconds: 0, outbound_duration_seconds: 0 };
              }
              allUserTotals[key].total_calls               += u.total_calls || 0;
              allUserTotals[key].inbound                   += u.inbound || 0;
              allUserTotals[key].outbound                  += u.outbound || 0;
              allUserTotals[key].answered                  += u.answered || 0;
              allUserTotals[key].inbound_answered          += u.inbound_answered || 0;
              allUserTotals[key].missed                    += u.missed || 0;
              allUserTotals[key].voicemail                 += u.voicemail || 0;
              allUserTotals[key].total_duration_seconds    += Math.round((u.total_duration_minutes || 0) * 60);
              allUserTotals[key].inbound_duration_seconds  += Math.round((u.inbound_duration_minutes || 0) * 60);
              allUserTotals[key].outbound_duration_seconds += Math.round((u.outbound_duration_minutes || 0) * 60);
            }
          }
          cache.summaries = Object.values(allUserTotals).map(u => ({
            ...u,
            period_id: cache.period.id,
            answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
            avg_duration_seconds: u.total_calls > 0 ? u.total_duration_seconds / u.total_calls : 0,
          }));
          cache.period._hasNewWeeks = true;

        } else {
          // New monthly record
          console.log(`[processCallLog]   Creating new CallLogPeriod for month ${monthKey}`);
          console.log(`[processCallLog]   uploaded_weeks before create: length=1, keys=${Object.keys(weekSnapshot).join(",")}`);

          const newPeriod = await base44.asServiceRole.entities.CallLogPeriod.create({
            reporting_period_start: weekStart,
            reporting_period_end: weekEnd,
            monthly_key: monthKey,
            status: "Monthly (Aggregated)",
            uploaded_weeks: [weekSnapshot],
            source_file_name: fileName,
            uploaded_by: user.email,
            uploaded_at: new Date().toISOString()
          });

          console.log(`[processCallLog]   Created CallLogPeriod id=${newPeriod.id}`);

          const userSummaries = weekUserData.map(u => ({
            period_id: newPeriod.id,
            user: u.user,
            total_calls: u.total_calls,
            inbound: u.inbound,
            outbound: u.outbound,
            answered: u.answered,
            missed: u.missed,
            voicemail: u.voicemail,
            total_duration_seconds: Math.round(u.total_duration_minutes * 60),
            inbound_duration_seconds: Math.round(u.inbound_duration_minutes * 60),
            outbound_duration_seconds: Math.round(u.outbound_duration_minutes * 60),
            answer_rate: u.total_calls > 0 ? u.answered / u.total_calls : 0,
            avg_duration_seconds: u.total_calls > 0 ? Math.round(u.total_duration_minutes * 60) / u.total_calls : 0
          }));

          const createdSummaries = [];
          for (const summary of userSummaries) {
            const created = await base44.asServiceRole.entities.CallLogUserSummary.create(summary);
            createdSummaries.push({ ...summary, id: created.id });
          }

          // Verify the create persisted uploaded_weeks
          const verifyNew = await base44.asServiceRole.entities.CallLogPeriod.filter({ id: newPeriod.id });
          const verifyWeeksLen = verifyNew && verifyNew[0] && Array.isArray(verifyNew[0].uploaded_weeks) ? verifyNew[0].uploaded_weeks.length : 0;
          console.log(`[processCallLog]   After create: period ${newPeriod.id} uploaded_weeks.length=${verifyWeeksLen}`);
          if (verifyWeeksLen === 0) {
            console.error(`[processCallLog]   ERROR: uploaded_weeks not persisted after create for period ${newPeriod.id}`);
            return Response.json({ error: "Weekly snapshots were not persisted. Upload aborted, check logs." }, { status: 500 });
          }
          console.log(`[processCallLog]   Verified: week_start=${verifyNew[0].uploaded_weeks[0]?.week_start}, week_end=${verifyNew[0].uploaded_weeks[0]?.week_end}, user_snapshot.length=${verifyNew[0].uploaded_weeks[0]?.user_snapshot?.length}`);

          cache.period = newPeriod;
          cache.summaries = createdSummaries;
          monthCache.set(monthKey, cache);
          weeksAdded++;
        }
      } catch (weekErr) {
        console.error(`[processCallLog] Error processing week ${weekStart}–${weekEnd}:`, weekErr);
        return Response.json({ error: `Error processing week ${weekStart}–${weekEnd}: ${weekErr.message}` }, { status: 500 });
      }
    }

    // Persist updated monthly records
    for (const [monthKey, cache] of monthCache.entries()) {
      if (!cache.period || !cache.period._hasNewWeeks) continue;

      const allWeeks = cache.period.uploaded_weeks || [];
      const allStarts = allWeeks.map(w => w.week_start).sort();
      const allEnds   = allWeeks.map(w => w.week_end).sort();
      const spanStart = allStarts[0];
      const spanEnd   = allEnds[allEnds.length - 1];
      const newStatus = classifyMonthlyStatus(spanStart, spanEnd, monthKey);

      console.log(`[processCallLog] Saving period ${cache.period.id} for month ${monthKey}: uploaded_weeks.length=${allWeeks.length}, keys=${Object.keys(allWeeks[0] || {}).join(",")}`);
      if (allWeeks.length === 0) {
        console.error(`[processCallLog] ERROR: No weekly snapshots to store for month ${monthKey}`);
        return Response.json({ error: "Weekly snapshots were not persisted. Upload aborted, check logs." }, { status: 500 });
      }

      // Delete and recreate all summaries for a clean recompute
      const existingSummaries = await base44.asServiceRole.entities.CallLogUserSummary.filter({ period_id: cache.period.id });
      for (const s of existingSummaries) {
        await base44.asServiceRole.entities.CallLogUserSummary.delete(s.id);
      }
      for (const s of cache.summaries) {
        const { _isNew, _dirty, id, ...data } = s;
        await base44.asServiceRole.entities.CallLogUserSummary.create(data);
      }

      await base44.asServiceRole.entities.CallLogPeriod.update(cache.period.id, {
        reporting_period_start: spanStart,
        reporting_period_end: spanEnd,
        status: newStatus,
        uploaded_weeks: allWeeks,
        source_file_name: fileName,
        uploaded_by: user.email,
        uploaded_at: new Date().toISOString()
      });

      // Verify persistence
      const saved = await base44.asServiceRole.entities.CallLogPeriod.filter({ id: cache.period.id });
      const savedPeriod = saved && saved[0];
      const savedWeeksLen = savedPeriod && Array.isArray(savedPeriod.uploaded_weeks) ? savedPeriod.uploaded_weeks.length : 0;
      console.log(`[processCallLog] After save: period ${cache.period.id} uploaded_weeks.length=${savedWeeksLen}`);
      if (savedWeeksLen === 0) {
        console.error(`[processCallLog] ERROR: uploaded_weeks persisted as empty for period ${cache.period.id} (month ${monthKey})`);
        return Response.json({ error: "Weekly snapshots were not persisted. Upload aborted, check logs." }, { status: 500 });
      }
      const firstSaved = savedPeriod.uploaded_weeks[0];
      console.log(`[processCallLog]   Verified saved[0]: week_start=${firstSaved?.week_start}, week_end=${firstSaved?.week_end}, totals.total_calls=${firstSaved?.totals?.total_calls}, user_snapshot.length=${firstSaved?.user_snapshot?.length}`);
    }

    const totalProcessed = weeksAdded + weeksReplaced;
    return Response.json({
      success: true,
      weeks_added: weeksAdded,
      weeks_replaced: weeksReplaced,
      all_duplicate: false,
      message: totalProcessed === 0
        ? "No changes made."
        : `${weeksAdded > 0 ? `${weeksAdded} week${weeksAdded !== 1 ? 's' : ''} added` : ''}${weeksAdded > 0 && weeksReplaced > 0 ? ', ' : ''}${weeksReplaced > 0 ? `${weeksReplaced} week${weeksReplaced !== 1 ? 's' : ''} replaced` : ''}.`
    });

  } catch (error) {
    console.error("[processCallLog] Unhandled error:", error);
    console.error("[processCallLog] error.message:", error.message);
    console.error("[processCallLog] error.stack:", error.stack);
    return Response.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
});