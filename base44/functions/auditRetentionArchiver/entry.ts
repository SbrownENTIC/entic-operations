/**
 * auditRetentionArchiver.js
 * Scheduled daily.
 * Moves AuditLog records older than 6 years into Archive_AuditLog.
 * AuditLog records under 6 years are NEVER touched.
 * Archive_AuditLog is read-only (no update/delete in RLS).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    // 6 years ago
    const sixYearsAgo = new Date(now.getFullYear() - 6, now.getMonth(), now.getDate()).toISOString();

    // Fetch records older than 6 years in batches of 500
    var archived = 0;
    var batchSize = 500;
    var page = 0;

    while (true) {
      var oldRecords = await base44.asServiceRole.entities.AuditLog.filter(
        { timestamp: { $lt: sixYearsAgo } },
        'timestamp',
        batchSize,
        page * batchSize
      );

      if (!oldRecords || oldRecords.length === 0) break;

      // Build archive entries
      var archiveEntries = [];
      for (var i = 0; i < oldRecords.length; i++) {
        var rec = oldRecords[i];
        archiveEntries.push({
          timestamp: rec.timestamp || '',
          userId: rec.userId || '',
          userEmail: rec.userEmail || '',
          entityName: rec.entityName || '',
          recordId: rec.recordId || '',
          actionType: rec.actionType || '',
          fieldName: rec.fieldName || '',
          oldValue: rec.oldValue || '',
          newValue: rec.newValue || '',
          ipAddress: rec.ipAddress || '',
          archived_date: now.toISOString(),
          original_id: rec.id || ''
        });
      }

      // Write to archive
      await base44.asServiceRole.entities.Archive_AuditLog.bulkCreate(archiveEntries);

      // Delete originals only after successful archive write
      for (var di = 0; di < oldRecords.length; di++) {
        await base44.asServiceRole.entities.AuditLog.delete(oldRecords[di].id);
      }

      archived = archived + oldRecords.length;

      // If fewer than batchSize returned, we're done
      if (oldRecords.length < batchSize) break;
      page = page + 1;
    }

    console.log('[AuditRetention] Archived ' + archived + ' records older than 6 years.');

    // Log the retention run itself
    if (archived > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        timestamp: now.toISOString(),
        userId: 'SYSTEM',
        userEmail: 'system',
        entityName: 'SYSTEM',
        recordId: '',
        actionType: 'EXPORT',
        fieldName: 'RETENTION_ARCHIVE',
        oldValue: '',
        newValue: JSON.stringify({ archivedCount: archived, cutoffDate: sixYearsAgo })
      });
    }

    return Response.json({ status: 'ok', archived: archived, cutoffDate: sixYearsAgo });
  } catch (error) {
    console.error('[AuditRetentionArchiver] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});