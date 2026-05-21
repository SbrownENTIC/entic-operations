/**
 * auditAnomalyDetector.js
 * Scheduled every 5 minutes.
 * Scans recent AuditLog entries for suspicious activity patterns.
 * Creates SECURITY_ALERT entries + notifies admins if thresholds exceeded.
 * Never blocks system operation.
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
    // Look back 10 minutes max (covers all windows)
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const recentLogs = await base44.asServiceRole.entities.AuditLog.filter(
      { timestamp: { $gte: windowStart } },
      '-timestamp',
      2000
    );

    const alerts = [];

    // ── Threshold 1: >100 UPDATEs by same user within 5 minutes ───────────────
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).getTime();
    const updatesByUser = {};
    for (var i = 0; i < recentLogs.length; i++) {
      var log = recentLogs[i];
      if (log.actionType !== 'UPDATE') continue;
      var logTime = new Date(log.timestamp).getTime();
      if (logTime < fiveMinAgo) continue;
      var key = log.userEmail || 'unknown';
      updatesByUser[key] = (updatesByUser[key] || 0) + 1;
    }
    var updateUsers = Object.keys(updatesByUser);
    for (var ui = 0; ui < updateUsers.length; ui++) {
      var email = updateUsers[ui];
      if (updatesByUser[email] > 100) {
        alerts.push({
          triggerType: 'BULK_UPDATE',
          userId: email,
          count: updatesByUser[email],
          timeWindow: '5 minutes'
        });
      }
    }

    // ── Threshold 2: >20 DELETEs by same user within 1 minute ────────────────
    var oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000).getTime();
    var deletesByUser = {};
    for (var di = 0; di < recentLogs.length; di++) {
      var dlog = recentLogs[di];
      if (dlog.actionType !== 'DELETE') continue;
      var dlogTime = new Date(dlog.timestamp).getTime();
      if (dlogTime < oneMinAgo) continue;
      var dkey = dlog.userEmail || 'unknown';
      deletesByUser[dkey] = (deletesByUser[dkey] || 0) + 1;
    }
    var deleteUsers = Object.keys(deletesByUser);
    for (var dui = 0; dui < deleteUsers.length; dui++) {
      var demail = deleteUsers[dui];
      if (deletesByUser[demail] > 20) {
        alerts.push({
          triggerType: 'BULK_DELETE',
          userId: demail,
          count: deletesByUser[demail],
          timeWindow: '1 minute'
        });
      }
    }

    // ── Threshold 3: >5 LOGIN_FAILED within 10 minutes ───────────────────────
    var tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).getTime();
    var failedLoginsByUser = {};
    for (var fi = 0; fi < recentLogs.length; fi++) {
      var flog = recentLogs[fi];
      if (flog.actionType !== 'AUTH_EVENT') continue;
      if (flog.fieldName !== 'LOGIN_FAILED') continue;
      var flogTime = new Date(flog.timestamp).getTime();
      if (flogTime < tenMinAgo) continue;
      var fkey = flog.userEmail || 'unknown';
      failedLoginsByUser[fkey] = (failedLoginsByUser[fkey] || 0) + 1;
    }
    var failedUsers = Object.keys(failedLoginsByUser);
    for (var fui = 0; fui < failedUsers.length; fui++) {
      var femail = failedUsers[fui];
      if (failedLoginsByUser[femail] > 5) {
        alerts.push({
          triggerType: 'LOGIN_FAILED_BURST',
          userId: femail,
          count: failedLoginsByUser[femail],
          timeWindow: '10 minutes'
        });
      }
    }

    if (alerts.length === 0) {
      return Response.json({ status: 'ok', alerts: 0 });
    }

    // ── Write SECURITY_ALERT entries ──────────────────────────────────────────
    var alertEntries = [];
    for (var ai = 0; ai < alerts.length; ai++) {
      var alert = alerts[ai];
      alertEntries.push({
        timestamp: now.toISOString(),
        userId: alert.userId,
        userEmail: alert.userId,
        entityName: 'SYSTEM',
        recordId: '',
        actionType: 'SECURITY_ALERT',
        fieldName: 'ANOMALY',
        oldValue: '',
        newValue: JSON.stringify({
          userId: alert.userId,
          triggerType: alert.triggerType,
          count: alert.count,
          timeWindow: alert.timeWindow
        })
      });
    }

    await base44.asServiceRole.entities.AuditLog.bulkCreate(alertEntries);

    // ── Notify admin users (in-app via SendEmail integration) ─────────────────
    try {
      var admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      var alertSummary = alerts.map(function(a) {
        return a.triggerType + ': ' + a.userId + ' (' + a.count + ' events in ' + a.timeWindow + ')';
      }).join('\n');

      for (var ni = 0; ni < admins.length; ni++) {
        var admin = admins[ni];
        if (!admin.email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: '[SECURITY ALERT] Anomalous audit activity detected',
          body: 'The audit anomaly detector flagged the following:\n\n' + alertSummary + '\n\nPlease review the Audit Log immediately.'
        });
      }
    } catch (notifyErr) {
      console.error('[AuditAnomaly] Notification failed (non-fatal):', notifyErr.message);
    }

    return Response.json({ status: 'alerts_created', count: alerts.length, alerts: alerts });
  } catch (error) {
    console.error('[AuditAnomalyDetector] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});