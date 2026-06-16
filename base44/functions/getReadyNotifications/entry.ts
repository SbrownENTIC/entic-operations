import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STALE_LICENSE_REMINDER_MESSAGE = 'Cancelled because license expiration date no longer matches';

/**
 * GET READY NOTIFICATIONS
 * Called by Power Automate to retrieve all NotificationQueue records
 * where status = "Ready to Send" and ready_to_send = true and sent_date is blank.
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

async function validateLicenseReminder(base44, notification) {
  if (notification.notification_type !== 'License Expiration Reminder') {
    return { valid: true };
  }

  if (!notification.related_record_id) {
    return { valid: false, reason: 'Missing related license id' };
  }

  let license;
  try {
    license = await base44.asServiceRole.entities.License.get(notification.related_record_id);
  } catch {
    return { valid: false, reason: 'Related license not found' };
  }

  if (!license?.expiration_date) {
    return { valid: false, reason: 'License missing expiration date' };
  }

  if (license.status !== 'active') {
    return { valid: false, reason: 'License is not active' };
  }

  if (license.expiration_date !== notification.expiration_date) {
    return { valid: false, reason: STALE_LICENSE_REMINDER_MESSAGE };
  }

  return { valid: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all NotificationQueue records as service role
    const allRecords = await base44.asServiceRole.entities.NotificationQueue.list();

    // Get today's date in Eastern Time (YYYY-MM-DD)
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Filter: status = Ready to Send, ready_to_send = true, sent_date blank, send_date = today
    const candidates = (allRecords || []).filter(n =>
      n.status === 'Ready to Send' &&
      n.ready_to_send === true &&
      (!n.sent_date || n.sent_date === '' || n.sent_date === null) &&
      n.send_date === todayET
    );

    const ready = [];
    const cancelled = [];

    for (const notification of candidates) {
      const validation = await validateLicenseReminder(base44, notification);
      if (!validation.valid) {
        await base44.asServiceRole.entities.NotificationQueue.update(notification.id, {
          status: 'Cancelled',
          ready_to_send: false,
          error_message: validation.reason
        });
        cancelled.push({
          id: notification.id,
          notification_type: notification.notification_type,
          reason: validation.reason
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
      notifications: ready.map(n => ({
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
        cc:                   (n.cc || '').split(',').map(e => e.trim()).filter(Boolean).join('; '),
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
