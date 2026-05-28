import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MARK NOTIFICATION FAILED
 * Called by Power Automate if sending the Outlook email fails.
 *
 * Power Automate HTTP action:
 *   Method: POST
 *   URI:    https://api.base44.com/api/apps/{app_id}/functions/markNotificationFailed
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

    await base44.asServiceRole.entities.NotificationQueue.update(notification_id, {
      status:        'Failed',
      error_message: error_message || 'Unknown error from Power Automate',
      ready_to_send: false,       // prevents re-trigger; human must reset manually
    });

    return Response.json({ success: true, notification_id, status: 'Failed' });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});