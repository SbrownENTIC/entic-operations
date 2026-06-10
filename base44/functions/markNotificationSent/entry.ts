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

    const sentAt = new Date().toISOString();
    const sentBy = sent_by || 'Steve Brown';
    const notifications = await base44.asServiceRole.entities.NotificationQueue.filter({ id: notification_id }, '', 1);
    const notification = notifications?.[0] || null;

    const updateData = {
      status:    'Sent',
      sent_date: sentAt,
      sent_by:   sentBy,
      ready_to_send: false,         // prevents re-trigger on next poll
    };

    if (email_provider_message_id) {
      updateData.email_provider_message_id = email_provider_message_id;
    }

    await base44.asServiceRole.entities.NotificationQueue.update(notification_id, updateData);

    let invoice_status_updated = false;
    if (
      notification?.notification_type === 'Invoice Email' &&
      notification?.related_entity === 'Invoice' &&
      notification?.related_record_id
    ) {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: notification.related_record_id }, '', 1);
      const invoice = invoices?.[0] || null;
      const eligibleStatuses = ['approved', 'draft', 'not_started'];

      if (invoice && eligibleStatuses.includes(invoice.status)) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          status: 'sent_to_vendor',
          invoice_sent_to_vendor: true,
          sent_to_vendor_at: sentAt
        });
        invoice_status_updated = true;
      }
    }

    return Response.json({ success: true, notification_id, status: 'Sent', invoice_status_updated });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});