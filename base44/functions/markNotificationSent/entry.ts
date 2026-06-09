import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MARK NOTIFICATION SENT
 * Called by Power Automate after successfully sending an Outlook email.
 *
 * Power Automate HTTP action:
 *   Method: POST
 *   URI:    https://base44.app/api/apps/691521cbabed77e5043c7037/functions/markNotificationSent
 *   Headers: { "Content-Type": "application/json" }
 *   Body:
 *   {
 *     "notification_id":          "<NotificationQueue record id>",
 *     "sent_by":                  "Steve Brown",
 *     "email_provider_message_id": "<Outlook message id if available, otherwise omit>"
 *   }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { notification_id, sent_by, email_provider_message_id } = body;

    if (!notification_id) {
      return Response.json({ success: false, error: 'notification_id is required' }, { status: 400 });
    }

    const updateData = {
      status:    'Sent',
      sent_date: new Date().toISOString(),
      sent_by:   sent_by || 'Steve Brown',
      ready_to_send: false,         // prevents re-trigger on next poll
    };

    if (email_provider_message_id) {
      updateData.email_provider_message_id = email_provider_message_id;
    }

    const allNotifications = await base44.asServiceRole.entities.NotificationQueue.list();
    const notification = (allNotifications || []).find(n => n.id === notification_id);

    if (notification?.related_entity === 'Invoice') {
      const attachments = notification.attachments || [];
      const hasApprovedPdf = attachments.some(att =>
        att?.required === true &&
        att?.source_field &&
        String(att.mime_type || '').toLowerCase() === 'application/pdf' &&
        att.file_name &&
        (att.file_url || att.download_url || att.content_base64)
      ) || String(notification.attachment_mime_type || '').toLowerCase() === 'application/pdf';

      if (!hasApprovedPdf) {
        return Response.json({
          success: false,
          error: 'Cannot mark invoice email Sent because the approved PDF attachment was not included.'
        }, { status: 400 });
      }
    }

    await base44.asServiceRole.entities.NotificationQueue.update(notification_id, updateData);

    if (notification?.related_entity === 'Invoice' && notification.related_record_id) {
      await base44.asServiceRole.entities.Invoice.update(notification.related_record_id, {
        invoice_email_sent: true,
        invoice_email_sent_date: updateData.sent_date,
        invoice_email_sent_to: notification.to || '',
        invoice_email_sent_by: updateData.sent_by,
        invoice_email_send_status: 'Sent',
        invoice_email_error_message: null,
        invoice_email_notification_id: notification_id
      });
    }

    return Response.json({ success: true, notification_id, status: 'Sent' });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});