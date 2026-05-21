/**
 * auditLogger.js
 * HIPAA-compliant audit logging utility.
 *
 * IMPORTANT: All exported functions are FIRE-AND-FORGET safe.
 * Call them with .catch() — they will NEVER throw or block primary operations.
 *
 * Usage (post-mutation pattern):
 *   auditCreate('Provider', data).catch(e => console.error('[Audit]', e));
 *   auditUpdate('Provider', id, changes, oldRecord).catch(e => console.error('[Audit]', e));
 *   auditDelete('Provider', id, snapshot).catch(e => console.error('[Audit]', e));
 */

import { base44 } from '@/api/base44Client';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_VALUE_LENGTH = 2000; // Truncate large field values
const BLOCKED_ENTITIES = new Set(['AuditLog']); // Prevent recursive logging

// ─── User cache ─────────────────────────────────────────────────────────────
let _currentUser = null;

async function getCurrentUser() {
  if (_currentUser) return _currentUser;
  try {
    _currentUser = await base44.auth.me();
    return _currentUser;
  } catch {
    return null;
  }
}

/** Call on logout/re-login to clear cached user */
export function clearAuditUserCache() {
  _currentUser = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeStringify(val) {
  if (val === null || val === undefined) return '';
  let str;
  try {
    str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  } catch {
    str = '[unstringifiable]';
  }
  // Truncate oversized values (e.g. base64, large arrays)
  if (str.length > MAX_VALUE_LENGTH) {
    return str.slice(0, MAX_VALUE_LENGTH) + '…[truncated]';
  }
  return str;
}

function buildBaseEntry(user, entityName, recordId, actionType) {
  return {
    timestamp: new Date().toISOString(),
    userId: user?.id || '',
    userEmail: user?.email || 'unknown',
    entityName,
    recordId: String(recordId || ''),
    actionType,
  };
}

async function writeLog(entries) {
  if (!entries || entries.length === 0) return;
  try {
    await base44.entities.AuditLog.bulkCreate(entries);
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entries:', err);
  }
}

// ─── Guard ────────────────────────────────────────────────────────────────────
function isBlocked(entityName) {
  if (BLOCKED_ENTITIES.has(entityName)) {
    console.warn(`[AuditLog] Blocked recursive logging for entity: ${entityName}`);
    return true;
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Log a CREATE event.
 * Call AFTER the entity has been created (post-mutation).
 * Pass the data payload used for creation.
 */
export async function auditCreate(entityName, data, recordId = null) {
  if (isBlocked(entityName)) return;
  if (!data || typeof data !== 'object') return;

  const user = await getCurrentUser();
  const id = recordId || data?.id || 'unknown';

  const entries = Object.entries(data)
    .filter(([key]) => !['id', 'created_date', 'updated_date', 'created_by'].includes(key))
    .map(([field, value]) => ({
      ...buildBaseEntry(user, entityName, id, 'CREATE'),
      fieldName: field,
      oldValue: '',
      newValue: safeStringify(value),
    }));

  if (entries.length === 0) {
    // At minimum log one entry to confirm the create happened
    entries.push({
      ...buildBaseEntry(user, entityName, id, 'CREATE'),
      fieldName: null,
      oldValue: '',
      newValue: '',
    });
  }

  await writeLog(entries);
}

/**
 * Log an UPDATE event — only logs fields that actually changed.
 * Call AFTER the entity has been updated (post-mutation).
 * @param {string} entityName
 * @param {string} id - Record ID
 * @param {object} changes - The fields that were sent in the update call
 * @param {object|null} oldRecord - Snapshot of the record before the update (optional but recommended)
 */
export async function auditUpdate(entityName, id, changes, oldRecord = null) {
  if (isBlocked(entityName)) return;
  if (!changes || typeof changes !== 'object') return;

  const user = await getCurrentUser();
  const entries = [];
  const now = new Date().toISOString();

  for (const [field, newVal] of Object.entries(changes)) {
    if (['id', 'created_date', 'updated_date', 'created_by'].includes(field)) continue;

    const oldVal = oldRecord != null ? oldRecord[field] : undefined;
    const oldStr = safeStringify(oldVal);
    const newStr = safeStringify(newVal);

    // Only log fields that actually changed
    if (oldStr === newStr) continue;

    entries.push({
      ...buildBaseEntry(user, entityName, id, 'UPDATE'),
      timestamp: now,
      fieldName: field,
      oldValue: oldStr,
      newValue: newStr,
    });
  }

  // If no actual changes detected, skip logging entirely
  if (entries.length === 0) {
    console.debug(`[AuditLog] No field changes detected for ${entityName}#${id} — skipping log.`);
    return;
  }

  await writeLog(entries);
}

/**
 * Log a DELETE event — logs all fields of the deleted record as a snapshot.
 * Call AFTER the entity has been deleted (post-mutation).
 * @param {string} entityName
 * @param {string} id - Record ID
 * @param {object|null} snapshot - The full record before deletion (optional but recommended)
 */
export async function auditDelete(entityName, id, snapshot = null) {
  if (isBlocked(entityName)) return;

  const user = await getCurrentUser();
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};

  const entries = Object.entries(snap)
    .filter(([key]) => !['created_date', 'updated_date', 'created_by'].includes(key))
    .map(([field, value]) => ({
      ...buildBaseEntry(user, entityName, id, 'DELETE'),
      fieldName: field,
      oldValue: safeStringify(value),
      newValue: '',
    }));

  // Always write at least one DELETE tombstone entry
  if (entries.length === 0) {
    entries.push({
      ...buildBaseEntry(user, entityName, id, 'DELETE'),
      fieldName: null,
      oldValue: '',
      newValue: '',
    });
  }

  await writeLog(entries);
}

/**
 * Log an AUTH event (login / logout / failed login).
 * @param {'LOGIN'|'LOGOUT'|'LOGIN_FAILED'} eventType
 * @param {string} userEmail
 * @param {string} [detail] - Optional extra context
 */
export async function auditAuthEvent(eventType, userEmail, detail = '') {
  if (!userEmail) return;
  const entry = {
    timestamp: new Date().toISOString(),
    userId: '',
    userEmail,
    entityName: 'AUTH',
    recordId: userEmail,
    actionType: 'AUTH_EVENT',
    fieldName: eventType,
    oldValue: '',
    newValue: detail ? safeStringify(detail) : '',
  };
  await writeLog([entry]);
}