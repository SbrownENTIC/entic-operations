/**
 * CdrNormalization.js
 * 
 * Processes raw Vonage CDR rows (inbound + outbound) into TRUE operational call metrics
 * by grouping all routing events by Call ID to eliminate hunt-group inflation.
 *
 * VONAGE CDR STRUCTURE:
 *   - Each unique Call ID = one physical patient interaction
 *   - One call may generate 10-15 rows (simultaneous ring, hunt group, overflow, etc.)
 *   - Rows share the same Call ID but differ by extension/user/result
 *
 * NORMALIZATION RULES:
 *   - A call is ANSWERED if any row for that Call ID has result=answered AND duration > 0
 *   - A call is VOICEMAIL if no answered row exists but a voicemail row does
 *   - A call is TRULY MISSED only if ALL rows for that Call ID are missed/unanswered
 *   - Duration = the LONGEST answered duration for that call (the actual talk time)
 *   - Speed to Answer = time from first ring event to the answered row's timestamp
 */

/**
 * Parse a duration string like "0:06:58" or "0:01:23" into total seconds
 */
export function parseDurationToSeconds(durStr) {
  if (!durStr || durStr === "0:00:00" || durStr === "") return 0;
  const parts = String(durStr).split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(parts[0]) || 0;
}

/**
 * Parse a Vonage date string like "5/8/26 23:55" or "5/8/2026 23:55" to a Date
 */
export function parseVonageDateTime(dtStr) {
  if (!dtStr) return null;
  const s = String(dtStr).trim();
  // Try "M/D/YY H:MM" or "M/D/YYYY H:MM"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const month = parseInt(m[1], 10) - 1;
  const day = parseInt(m[2], 10);
  const hour = parseInt(m[4], 10);
  const min = parseInt(m[5], 10);
  const sec = m[6] ? parseInt(m[6], 10) : 0;
  return new Date(year, month, day, hour, min, sec);
}

/**
 * Classify the destination of a call row to determine if it's a real user extension,
 * a hunt group number, a queue, a voicemail box, etc.
 *
 * Returns one of: "user_ext" | "hunt_group" | "queue" | "voicemail_box" | "main_line" | "unknown"
 */
export function classifyDestination(row, userExtensionMap) {
  const to = String(row["To"] || "").trim();
  const destUserId = String(row["Destination UserId"] || "").trim();
  const destDevice = String(row["Destination Device"] || "").trim();

  // If To is a 3-4 digit extension number (internal routing)
  const extNum = parseInt(to, 10);
  if (!isNaN(extNum) && extNum >= 100 && extNum <= 999) {
    if (userExtensionMap && userExtensionMap.has(extNum)) return "user_ext";
    // Extensions like 300, 301, 303, 404 etc. are voicemail/queue
    if ([300, 301, 303, 304, 305, 404, 403, 410].includes(extNum)) return "voicemail_box";
    return "hunt_group";
  }

  // If it's a phone number (main line routing)
  if (/^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(to) || to.startsWith("+")) {
    return "main_line";
  }

  return "unknown";
}

/**
 * Core normalization function.
 * 
 * Takes an array of raw CDR rows (from the CSV) and returns:
 *   - normalizedCalls: Map<callId, NormalizedCall>
 *   - summary: aggregate operational metrics
 *
 * @param {Array} rows - Raw CDR rows parsed from CSV/Excel
 * @param {Set|null} userExtensionSet - Set of known user extension numbers (for classification)
 * @returns {{ normalizedCalls: Map, summary: Object, hourlyBreakdown: Array }}
 */
export function normalizeCdrRows(rows, userExtensionSet = null) {
  if (!rows || rows.length === 0) {
    return { normalizedCalls: new Map(), summary: buildEmptySummary(), hourlyBreakdown: [] };
  }

  // Group all rows by Call ID
  const callGroups = new Map();

  for (const row of rows) {
    const callId = String(row["Call ID"] || "").trim();
    if (!callId) continue;

    if (!callGroups.has(callId)) {
      callGroups.set(callId, []);
    }
    callGroups.get(callId).push(row);
  }

  const normalizedCalls = new Map();

  for (const [callId, callRows] of callGroups) {
    const normalized = normalizeCallGroup(callId, callRows, userExtensionSet);
    if (normalized) normalizedCalls.set(callId, normalized);
  }

  // Build summary from normalized calls
  const summary = buildSummary(normalizedCalls);
  const hourlyBreakdown = buildHourlyBreakdown(normalizedCalls);

  return { normalizedCalls, summary, hourlyBreakdown };
}

/**
 * Normalize a single group of CDR rows that all share the same Call ID.
 * Returns a single logical call record with the true outcome.
 */
function normalizeCallGroup(callId, rows, userExtensionSet) {
  if (!rows || rows.length === 0) return null;

  // Sort by timestamp ascending (earliest first = first ring event)
  const sorted = rows.slice().sort((a, b) => {
    const ta = parseVonageDateTime(a["Date/Time"]);
    const tb = parseVonageDateTime(b["Date/Time"]);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta - tb;
  });

  const firstRow = sorted[0];
  const direction = String(firstRow["Direction"] || "").toLowerCase();
  const fromNumber = String(firstRow["From"] || "").trim();
  const location = String(firstRow["Location"] || "").trim();
  const firstTimestamp = parseVonageDateTime(firstRow["Date/Time"]);

  // Find the main line row (the "To" is a phone number, not an extension)
  // This represents the call as seen from the outside
  const mainLineRows = sorted.filter(r => {
    const to = String(r["To"] || "").trim();
    return /^\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(to) || to.startsWith("+");
  });

  // Find answered rows — these indicate the call was picked up
  const answeredRows = sorted.filter(r =>
    String(r["Result"] || "").toLowerCase() === "answered" &&
    parseDurationToSeconds(r["Duration"]) > 0
  );

  // Find voicemail rows
  const voicemailRows = sorted.filter(r =>
    String(r["Result"] || "").toLowerCase() === "voicemail"
  );

  // Find truly missed rows (result=missed, duration=0)
  const missedRows = sorted.filter(r =>
    String(r["Result"] || "").toLowerCase() === "missed"
  );

  // ── Determine TRUE outcome ─────────────────────────────────────────────────
  let outcome;
  let talkDurationSeconds = 0;
  let answeredByExtension = null;
  let answeredByUser = null;
  let answeredTimestamp = null;
  let speedToAnswerSeconds = null;

  if (answeredRows.length > 0) {
    outcome = "answered";
    // Use the answered row with the longest duration (the actual conversation)
    const bestAnswered = answeredRows.reduce((best, r) => {
      const d = parseDurationToSeconds(r["Duration"]);
      return d > parseDurationToSeconds(best["Duration"]) ? r : best;
    }, answeredRows[0]);

    talkDurationSeconds = parseDurationToSeconds(bestAnswered["Duration"]);
    answeredByExtension = String(bestAnswered["To"] || "").trim();
    answeredByUser = String(bestAnswered["Destination UserId"] || bestAnswered["Destination Device"] || "").trim();
    answeredTimestamp = parseVonageDateTime(bestAnswered["Date/Time"]);

    // Speed to answer: time from first ring to when it was picked up
    if (firstTimestamp && answeredTimestamp) {
      speedToAnswerSeconds = Math.max(0, Math.round((answeredTimestamp - firstTimestamp) / 1000));
    }
  } else if (voicemailRows.length > 0) {
    outcome = "voicemail";
    // Voicemail = caller left a message — NOT a truly missed call operationally
    const bestVm = voicemailRows.reduce((best, r) => {
      const d = parseDurationToSeconds(r["Duration"]);
      return d > parseDurationToSeconds(best["Duration"]) ? r : best;
    }, voicemailRows[0]);
    talkDurationSeconds = parseDurationToSeconds(bestVm["Duration"]);
    answeredByExtension = String(bestVm["To"] || "").trim();
    answeredByUser = String(bestVm["Destination UserId"] || "").trim();
  } else {
    // All rows missed = truly abandoned call
    outcome = "missed";
  }

  // ── Determine which line/number was called ─────────────────────────────────
  let calledNumber = "";
  if (mainLineRows.length > 0) {
    calledNumber = String(mainLineRows[0]["To"] || "").trim();
  } else if (firstRow) {
    calledNumber = String(firstRow["To"] || "").trim();
  }

  // ── Count unique extension ring attempts (for reference) ───────────────────
  const uniqueExtensionsRung = new Set(
    rows.map(r => String(r["To"] || "").trim()).filter(t => /^\d{2,4}$/.test(t))
  ).size;

  return {
    call_id: callId,
    direction,
    from_number: fromNumber,
    called_number: calledNumber,
    location,
    timestamp: firstTimestamp,
    outcome,          // "answered" | "voicemail" | "missed"
    talk_duration_seconds: talkDurationSeconds,
    answered_by_extension: answeredByExtension,
    answered_by_user: answeredByUser,
    answered_timestamp: answeredTimestamp,
    speed_to_answer_seconds: speedToAnswerSeconds,
    routing_events: rows.length,          // total CDR rows for this call (noise level indicator)
    unique_extensions_rung: uniqueExtensionsRung,
    raw_rows: rows,
  };
}

/**
 * Build aggregate summary from normalized calls
 */
function buildSummary(normalizedCalls) {
  const all = [...normalizedCalls.values()];
  const inbound = all.filter(c => c.direction === "inbound");
  const outbound = all.filter(c => c.direction === "outbound");

  const inboundAnswered = inbound.filter(c => c.outcome === "answered");
  const inboundVoicemail = inbound.filter(c => c.outcome === "voicemail");
  const inboundMissed = inbound.filter(c => c.outcome === "missed");

  const totalTalkSec = inboundAnswered.reduce((s, c) => s + c.talk_duration_seconds, 0);
  const avgTalkSec = inboundAnswered.length > 0 ? Math.round(totalTalkSec / inboundAnswered.length) : 0;

  const speedRows = inboundAnswered.filter(c => c.speed_to_answer_seconds !== null);
  const totalSpeedSec = speedRows.reduce((s, c) => s + c.speed_to_answer_seconds, 0);
  const avgSpeedToAnswerSec = speedRows.length > 0 ? Math.round(totalSpeedSec / speedRows.length) : 0;

  const inboundAnswerRate = inbound.length > 0 ? inboundAnswered.length / inbound.length : 0;
  const abandonmentRate = inbound.length > 0 ? inboundMissed.length / inbound.length : 0;

  return {
    total_unique_calls: all.length,
    total_unique_inbound: inbound.length,
    total_unique_outbound: outbound.length,
    inbound_answered: inboundAnswered.length,
    inbound_voicemail: inboundVoicemail.length,
    inbound_truly_missed: inboundMissed.length,
    inbound_answer_rate: inboundAnswerRate,
    abandonment_rate: abandonmentRate,
    total_talk_seconds: totalTalkSec,
    avg_talk_seconds: avgTalkSec,
    avg_speed_to_answer_seconds: avgSpeedToAnswerSec,
    // Routing noise stats (for reference)
    total_raw_cdr_rows: [...normalizedCalls.values()].reduce((s, c) => s + c.routing_events, 0),
    avg_routing_events_per_call: all.length > 0
      ? Math.round([...normalizedCalls.values()].reduce((s, c) => s + c.routing_events, 0) / all.length * 10) / 10
      : 0,
  };
}

/**
 * Build hourly call volume breakdown for peak hour analysis
 */
function buildHourlyBreakdown(normalizedCalls) {
  const hourCounts = {};
  for (let h = 0; h < 24; h++) hourCounts[h] = { hour: h, total: 0, answered: 0, missed: 0 };

  for (const call of normalizedCalls.values()) {
    if (call.direction !== "inbound" || !call.timestamp) continue;
    const h = call.timestamp.getHours();
    hourCounts[h].total++;
    if (call.outcome === "answered") hourCounts[h].answered++;
    if (call.outcome === "missed") hourCounts[h].missed++;
  }

  return Object.values(hourCounts).filter(h => h.total > 0);
}

function buildEmptySummary() {
  return {
    total_unique_calls: 0, total_unique_inbound: 0, total_unique_outbound: 0,
    inbound_answered: 0, inbound_voicemail: 0, inbound_truly_missed: 0,
    inbound_answer_rate: 0, abandonment_rate: 0,
    total_talk_seconds: 0, avg_talk_seconds: 0, avg_speed_to_answer_seconds: 0,
    total_raw_cdr_rows: 0, avg_routing_events_per_call: 0,
  };
}

/**
 * Format seconds to HH:MM:SS string
 */
export function formatSeconds(secs) {
  if (!secs || secs < 0) return "0:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

/**
 * Group normalized calls by location (based on called_number mapping or Location field)
 */
export function groupCallsByLocation(normalizedCalls) {
  const locationMap = {};
  for (const call of normalizedCalls.values()) {
    if (call.direction !== "inbound") continue;
    const loc = call.location || "Unknown";
    if (!locationMap[loc]) locationMap[loc] = { location: loc, total: 0, answered: 0, missed: 0, voicemail: 0 };
    locationMap[loc].total++;
    if (call.outcome === "answered") locationMap[loc].answered++;
    else if (call.outcome === "missed") locationMap[loc].missed++;
    else if (call.outcome === "voicemail") locationMap[loc].voicemail++;
  }
  return Object.values(locationMap).sort((a, b) => b.total - a.total);
}