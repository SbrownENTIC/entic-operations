/**
 * auditLogger.js
 * Utility for HIPAA-compliant audit logging.
 * Wraps base44 entity operations and logs all changes to the AuditLog entity.
 */

import { base44 } from '@/api/base44Client';

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

// Invalidate cached user on logout/re-login
export function clearAuditUserCache() {
  _currentUser = null;
}

function stringify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

async function writeLog(entries) {
  if (!entries || entries.length === 0) return;
  try {
    await base44.entities.AuditLog.bulkCreate(entries);
  } catch (err) {
    // Never let audit logging failures break the main flow
    console.error('[AuditLog] Failed to write audit entries:', err);
  }
}

/**
 * Audit-wrapped CREATE
 * Usage: await auditCreate('Provider', data)
 */
export async function auditCreate(entityName, data) {
  const entity = base44.entities[entityName];
  const record = await entity.create(data);
  const user = await getCurrentUser();

  const now = new Date().toISOString();
  const entries = Object.keys(data).map(field => ({
    timestamp: now,
    userId: user?.id || '',
    userEmail: user?.email || 'unknown',
    entityName,
    recordId: record.id,
    actionType: 'CREATE',
    fieldName: field,
    oldValue: '',
    newValue: stringify(data[field]),
  }));

  await writeLog(entries);
  return record;
}

/**
 * Audit-wrapped UPDATE
 * Usage: await auditUpdate('Provider', id, changes, oldRecord)
 * oldRecord is optional — pass it if you already have it to avoid an extra fetch
 */
export async function auditUpdate(entityName, id, changes, oldRecord = null) {
  const entity = base44.entities[entityName];

  if (!oldRecord) {
    try {
      oldRecord = await entity.get ? entity.get(id) : null;
    } catch {
      oldRecord = null;
    }
  }

  const record = await entity.update(id, changes);
  const user = await getCurrentUser();

  const now = new Date().toISOString();
  const entries = [];

  for (const field of Object.keys(changes)) {
    const oldVal = oldRecord ? oldRecord[field] : undefined;
    const newVal = changes[field];
    // Only log if value actually changed
    if (stringify(oldVal) !== stringify(newVal)) {
      entries.push({
        timestamp: now,
        userId: user?.id || '',
        userEmail: user?.email || 'unknown',
        entityName,
        recordId: id,
        actionType: 'UPDATE',
        fieldName: field,
        oldValue: stringify(oldVal),
        newValue: stringify(newVal),
      });
    }
  }

  await writeLog(entries);
  return record;
}

/**
 * Audit-wrapped DELETE
 * Usage: await auditDelete('Provider', id, oldRecord)
 * oldRecord is optional snapshot of the record before deletion
 */
export async function auditDelete(entityName, id, oldRecord = null) {
  const entity = base44.entities[entityName];
  const user = await getCurrentUser();
  const now = new Date().toISOString();

  // Snapshot all fields of the deleted record
  const snapshot = oldRecord || {};
  const entries = Object.keys(snapshot).map(field => ({
    timestamp: now,
    userId: user?.id || '',
    userEmail: user?.email || 'unknown',
    entityName,
    recordId: id,
    actionType: 'DELETE',
    fieldName: field,
    oldValue: stringify(snapshot[field]),
    newValue: '',
  }));

  // Always write at least one DELETE entry even if no snapshot
  if (entries.length === 0) {
    entries.push({
      timestamp: now,
      userId: user?.id || '',
      userEmail: user?.email || 'unknown',
      entityName,
      recordId: id,
      actionType: 'DELETE',
      fieldName: null,
      oldValue: '',
      newValue: '',
    });
  }

  await entity.delete(id);
  await writeLog(entries);
}