import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  todayET,
  validateLicenseReminderNotification,
  cancelInvalidLicenseReminder,
  isUnsentLicenseReminder,
} from '../_shared/licenseReminderValidation.ts';

/**
 * GET READY NOTIFICATIONS
 * Called by Power Automate to retrieve all NotificationQueue records
 * where status = "Ready to Send" and ready_to_send = true and sent_date is blank.
 *
 * License Expiration Reminders are validated against the live License record
 * before being returned. Stale reminders are auto-cancelled.
 *
 * Power Automate HTTP action:
 *   Method: POST
 *   URI:    https://api.base44.com/api/apps/{app_id}/functions/getReadyNotifications
 *   Headers: { "Content-Type": "application/json" }
 *   Body:   {} (empty JSON object)
 *
 * Authentication: None required — uses internal service role.
 * Caller IP must be whitelisted or a shared secret passed if desired.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const allRecords = await base44.asServiceRole.entities.NotificationQueue.list();
    const today = todayET();

    // Proactively cancel any unsent license reminders that no longer match live license data
    // (e.g. expiration date updated but queue row was not cancelled).
    const cancelled = [];

    for (const notification of allRecords || []) {
      if (!isUnsentLicenseReminder(notification)) continue;

      const validation = await validateLicenseReminderNotification(base44, notification, today);
      if (!validation.valid) {
        await cancelInvalidLicenseReminder(base44, notification, validation.reason);
        cancelled.push({
          id: notification.id,
          notification_type: notification.notification_type,
          reminder_stage: notification.reminder_stage || '',
          send_date: notification.send_date || '',
          reason: validation.reason,
        });
      }
    }

    const cancelledIds = new Set(cancelled.map((c) => c.id));

    // Filter: status = Ready to Send, ready_to_send = true, sent_date blank, send_date = today
    const candidates = (allRecords || []).filter((n) =>
      !cancelledIds.has(n.id) &&
      n.status === 'Ready to Send' &&
      n.ready_to_send === true &&
      (!n.sent_date || n.sent_date === '' || n.sent_date === null) &&
      n.send_date === today
    );

    const ready = [];

    for (const notification of candidates) {
      const validation = await validateLicenseReminderNotification(base44, notification, today);
      if (!validation.valid) {
        await cancelInvalidLicenseReminder(base44, notification, validation.reason);
        cancelled.push({
          id: notification.id,
          notification_type: notification.notification_type,
          reminder_stage: notification.reminder_stage || '',
          send_date: notification.send_date || '',
          reason: validation.reason,
        });
        continue;
      }

      ready.push(notification);
    }

    return Response.json({
      success: true,
      count: ready.length,
      cancelled_stale_count: cancelled.length,
      cancelled_stale: cancelled.length > 0 ? cancelled : null,
      notifications: ready.map((n) => ({
        id:                   n.id,
        notification_type:    n.notification_type,
        closure_type:         n.closure_type || '',
        location:             n.location || '',
        send_date:            n.send_date || '',
        closure_date:         n.closure_date || '',
        reminder_stage:       n.reminder_stage || '',
        license_type:         n.license_type || '',
        expiration_date:      n.expiration_date || '',
        provider_name:        n.provider_name || '',
        subject:              n.subject,
        body:                 n.body,
        to:                   n.to,
        cc:                   (n.cc || '').split(',').map((e: string) => e.trim()).filter(Boolean).join('; '),
        bcc:                  n.bcc || '',
        related_record_id:    n.related_record_id || '',
        invoice_number:       n.invoice_number || '',
        invoice_month:        n.invoice_month || '',
        facility_name:        n.facility_name || '',
        attachment_filename:  n.attachment_filename || '',
        attachment_content_type: n.attachment_content_type || '',
        has_attachment:       n.notification_type === 'Invoice Email' && !!n.attachment_filename,
        created_date:         n.created_date,
      }))
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
