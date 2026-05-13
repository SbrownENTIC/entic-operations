/**
 * Core March 2026 worksheet calculation helpers for Call Log Excel export.
 * All functions are pure — no side effects.
 */

// Extension numbers classified as "Call Center" role
// Source: operational reference workbook (May 2026 worksheet)
const CALL_CENTER_EXTENSIONS = new Set([
  353, 7, 163, 101, 82, 86, 55, 38, 4, 104, 112, 120, 128,
  127, 114, 124, 126, 116, 106, 113, 115, 123, 105, 403,
]);

/**
 * Convert a duration value stored in minutes to total minutes (numeric).
 * Accepts numbers (already minutes) or HH:MM:SS strings.
 */
export function durationToMinutes(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  // HH:MM:SS or H:MM:SS
  const parts = s.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Compute inbound answered from raw inbound/missed counts.
 * inbound_answered = max(inbound_calls - missed_calls, 0)
 */
export function calcInboundAnswered(inboundCalls, missedCalls) {
  const inbound = Number(inboundCalls || 0);
  const missed  = Number(missedCalls  || 0);
  return Math.max(inbound - missed, 0);
}

/**
 * Compute inbound answer rate as a decimal [0, 1].
 * If inbound_calls == 0 → returns 0.
 */
export function calcInboundAnswerRate(inboundCalls, inboundAnswered) {
  const inbound  = Number(inboundCalls   || 0);
  const answered = Number(inboundAnswered || 0);
  if (inbound === 0) return 0;
  return answered / inbound;
}

/**
 * Determine Phone Role based on extension number.
 * Returns "Call Center" or "Client Facing".
 */
export function getPhoneRole(extension) {
  const ext = typeof extension === "string" ? parseInt(extension, 10) : Number(extension);
  if (!isNaN(ext) && CALL_CENTER_EXTENSIONS.has(ext)) return "Call Center";
  return "Client Facing";
}

/**
 * Get Expected Answer Rate based on phone role.
 * Call Center → 0.85, Client Facing → 0.65
 */
export function getExpectedAnswerRate(phoneRole) {
  return phoneRole === "Call Center" ? 0.85 : 0.65;
}

/**
 * Determine Answer Rate Status by comparing actual vs expected.
 * Returns "Meets Target" | "Below Target"
 */
export function getAnswerRateStatus(actualRate, expectedRate) {
  if (actualRate === null || actualRate === undefined) return "";
  return actualRate >= expectedRate ? "Meets Target" : "Below Target";
}

/**
 * Compute outbound answered.
 * outbound_answered = max(answered_calls - inbound_answered, 0)
 */
export function calcOutboundAnswered(answeredCalls, inboundAnswered) {
  const answered = Number(answeredCalls  || 0);
  const inbAns   = Number(inboundAnswered || 0);
  return Math.max(answered - inbAns, 0);
}

/**
 * Compute outbound rate as a decimal [0, 1].
 * If total_calls == 0 → returns 0.
 * outbound_rate = outbound_calls / total_calls
 */
export function calcOutboundRate(outboundCalls, totalCalls) {
  const outbound = Number(outboundCalls || 0);
  const total    = Number(totalCalls    || 0);
  if (total === 0) return 0;
  return outbound / total;
}

/**
 * Get Expected Outbound % based on phone role.
 * Call Center → 0.15, Client Facing → 0.25
 */
export function getExpectedOutboundRate(phoneRole) {
  return phoneRole === "Call Center" ? 0.15 : 0.25;
}

/**
 * Determine Outbound Activity status by comparing actual vs expected outbound rate.
 * Returns "Meets Target" | "Below Target"
 */
export function getOutboundActivityStatus(actualRate, expectedRate) {
  if (actualRate === null || actualRate === undefined) return "";
  return actualRate >= expectedRate ? "Meets Target" : "Below Target";
}

/**
 * Compute calls per hour.
 * calls_per_hour = total_calls / 7.5
 */
export function calcCallsPerHour(totalCalls) {
  const total = Number(totalCalls || 0);
  return total / 7.5;
}

/**
 * Get Expected Calls Per Hour based on phone role.
 * Call Center → 10, Client Facing → 7
 */
export function getExpectedCallsPerHour(phoneRole) {
  return phoneRole === "Call Center" ? 10 : 7;
}

/**
 * Determine Call Volume Status by comparing actual vs expected calls per hour.
 * Returns "Meets Target" | "Below Target"
 */
export function getCallVolumeStatus(actualCph, expectedCph) {
  if (actualCph === null || actualCph === undefined) return "";
  return actualCph >= expectedCph ? "Meets Target" : "Below Target";
}