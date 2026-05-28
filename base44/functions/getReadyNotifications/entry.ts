import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all NotificationQueue records as service role
    const allRecords = await base44.asServiceRole.entities.NotificationQueue.list();

    // Filter: status = "Ready to Send", ready_to_send = true, sent_date blank
    const ready = (allRecords || []).filter(n =>
      n.status === 'Ready to Send' &&
      n.ready_to_send === true &&
      (!n.sent_date || n.sent_date === '' || n.sent_date === null)
    );

    return Response.json({
      success: true,
      count: ready.length,
      notifications: ready.map(n => ({
        id:                   n.id,
        notification_type:    n.notification_type,
        closure_type:         n.closure_type || '',
        location:             n.location || '',
        closure_date:         n.closure_date || '',
        subject:              n.subject,
        body:                 n.body,
        to:                   n.to,
        cc:                   (n.cc || '').split(',').map(e => e.trim()).filter(Boolean).join('; '),
        bcc:                  n.bcc || '',
        related_record_id:    n.related_record_id || '',
        created_date:         n.created_date,
      }))
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});