/**
 * auditIntegrityCheck.js
 * Scheduled daily at midnight.
 * Hashes all AuditLog entries for the previous day and stores in AuditIntegrity.
 * If a hash for that date already exists and doesn't match, creates INTEGRITY_ALERT.
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
    // Previous day boundaries
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const dayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0).toISOString();
    const dayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999).toISOString();
    const dateStr = yesterday.toISOString().split('T')[0];

    // Fetch all audit entries for that day (paginate if needed)
    var allEntries = [];
    var page = 0;
    var batchSize = 1000;

    while (true) {
      var batch = await base44.asServiceRole.entities.AuditLog.filter(
        { timestamp: { $gte: dayStart, $lte: dayEnd } },
        'timestamp',
        batchSize,
        page * batchSize
      );
      if (!batch || batch.length === 0) break;
      for (var bi = 0; bi < batch.length; bi++) {
        allEntries.push(batch[bi]);
      }
      if (batch.length < batchSize) break;
      page = page + 1;
    }

    // Build deterministic string for hashing
    // Sort by id for determinism, then concat key fields
    allEntries.sort(function(a, b) {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    var hashInput = '';
    for (var ei = 0; ei < allEntries.length; ei++) {
      var e = allEntries[ei];
      hashInput = hashInput + (e.id || '') + '|' +
        (e.timestamp || '') + '|' +
        (e.userEmail || '') + '|' +
        (e.entityName || '') + '|' +
        (e.recordId || '') + '|' +
        (e.actionType || '') + '|' +
        (e.fieldName || '') + '|' +
        (e.oldValue || '') + '|' +
        (e.newValue || '') + '\n';
    }

    // SHA-256 using Web Crypto API
    var encoder = new TextEncoder();
    var data = encoder.encode(hashInput);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    var hashHex = hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    // Check if an integrity record for this date already exists
    var existing = await base44.asServiceRole.entities.AuditIntegrity.filter({ date: dateStr });

    if (existing && existing.length > 0) {
      var prevHash = existing[0].hash;
      if (prevHash !== hashHex) {
        // INTEGRITY MISMATCH — create alert
        await base44.asServiceRole.entities.AuditLog.create({
          timestamp: now.toISOString(),
          userId: 'SYSTEM',
          userEmail: 'system',
          entityName: 'SYSTEM',
          recordId: '',
          actionType: 'INTEGRITY_ALERT',
          fieldName: 'HASH_MISMATCH',
          oldValue: prevHash,
          newValue: dateStr
        });

        // Notify admins
        try {
          var admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          for (var ni = 0; ni < admins.length; ni++) {
            var admin = admins[ni];
            if (!admin.email) continue;
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: admin.email,
              subject: '[INTEGRITY ALERT] Audit log hash mismatch for ' + dateStr,
              body: 'The audit integrity check detected a hash mismatch for ' + dateStr + '.\n\nThis may indicate tampering with audit records. Please investigate immediately.\n\nExpected: ' + prevHash + '\nActual: ' + hashHex
            });
          }
        } catch (notifyErr) {
          console.error('[AuditIntegrity] Notification failed (non-fatal):', notifyErr.message);
        }

        return Response.json({ status: 'MISMATCH', date: dateStr, expected: prevHash, actual: hashHex });
      }
      // Hash matches — no action needed
      return Response.json({ status: 'ok', date: dateStr, records: allEntries.length, hash: hashHex, note: 'Hash already recorded and matches.' });
    }

    // No existing record — store the hash
    await base44.asServiceRole.entities.AuditIntegrity.create({
      date: dateStr,
      hash: hashHex,
      record_count: allEntries.length,
      created_at: now.toISOString()
    });

    console.log('[AuditIntegrity] Stored hash for ' + dateStr + ' — ' + allEntries.length + ' records.');
    return Response.json({ status: 'ok', date: dateStr, records: allEntries.length, hash: hashHex });

  } catch (error) {
    console.error('[AuditIntegrityCheck] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});