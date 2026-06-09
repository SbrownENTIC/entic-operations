import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MARK NOTIFICATION FAILED
 * Called by Power Automate if sending the Outlook email fails.
 *
 * Power Automate HTTP action:
 *   Method: POST
 *   URI:    https://base44.app/api/apps/691521cbabed77e5043c7037/functions/markNotificationFailed
 *   Headers: { "Content-Type": "application/json" }
 *   Body:
 *   {
 *     "notification_id": "<NotificationQueue record id>",
 *     "error_message":   "<error detail from Outlook or Power Automate>"
 *   }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { notification_id, error_message } = body;

    if (!notification_id) {
      return Response.json({ success: false, error: 'notification_id is required' }, { status: 400 });
    }

    const allNotifications = await base44.asServiceRole.entities.NotificationQueue.list();
    const notification = (allNotifications || []).find(n => n.id === notification_id);
    const errorText = error_message || 'Unknown error from Power Automate';

    await base44.asServiceRole.entities.NotificationQueue.update(notification_id, {
      status:        'Failed',
      error_message: errorText,
      ready_to_send: false,       // prevents re-trigger; human must reset manually
    });

    if (notification?.related_entity === 'Invoice' && notification.related_record_id) {
      await base44.asServiceRole.entities.Invoice.update(notification.related_record_id, {
        invoice_email_sent: false,
        invoice_email_send_status: 'Failed',
        invoice_email_error_message: errorText,
        invoice_email_notification_id: notification_id
      });
    }

    return Response.json({ success: true, notification_id, status: 'Failed' });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});