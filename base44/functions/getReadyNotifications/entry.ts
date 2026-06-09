import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizeOutlookAttachments(notification) {
  const savedOutlookAttachments = Array.isArray(notification.outlook_attachments)
    ? notification.outlook_attachments
    : [];

  if (savedOutlookAttachments.length > 0) {
    return savedOutlookAttachments.filter(att => att?.Name && att?.ContentBytes);
  }

  const detailedAttachments = Array.isArray(notification.attachments)
    ? notification.attachments
    : [];

  const normalized = detailedAttachments
    .filter(att => att?.file_name && att?.content_base64)
    .map(att => ({
      Name: att.file_name,
      ContentBytes: att.content_base64,
      ContentType: att.mime_type || notification.attachment_mime_type || 'application/octet-stream'
    }));

  if (normalized.length > 0) return normalized;

  if (notification.attachment_filename && notification.attachment_content_base64) {
    return [{
      Name: notification.attachment_filename,
      ContentBytes: notification.attachment_content_base64,
      ContentType: notification.attachment_mime_type || 'application/octet-stream'
    }];
  }

  return [];
}

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

    // Get today's date in Eastern Time (YYYY-MM-DD)
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Filter: status = Ready to Send, ready_to_send = true, sent_date blank, send_date = today
    const ready = (allRecords || []).filter(n =>
      n.status === 'Ready to Send' &&
      n.ready_to_send === true &&
      (!n.sent_date || n.sent_date === '' || n.sent_date === null) &&
      n.send_date === todayET
    );

    return Response.json({
      success: true,
      count: ready.length,
      notifications: ready.map(n => {
        const outlookAttachments = normalizeOutlookAttachments(n);
        const primaryAttachment = outlookAttachments[0] || {};

        return {
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
          from_email:           n.from_email || '',
          to:                   n.to,
          cc:                   (n.cc || '').split(/[;,]/).map(e => e.trim()).filter(Boolean).join('; '),
          bcc:                  n.bcc || '',
          attachment_url:       n.attachment_url || '',
          attachment_filename:  n.attachment_filename || primaryAttachment.Name || '',
          attachment_mime_type: n.attachment_mime_type || primaryAttachment.ContentType || '',
          attachment_content_base64: n.attachment_content_base64 || primaryAttachment.ContentBytes || '',
          attachment_name:      primaryAttachment.Name || n.attachment_filename || '',
          attachment_content:   primaryAttachment.ContentBytes || n.attachment_content_base64 || '',
          attachment_content_bytes: primaryAttachment.ContentBytes || n.attachment_content_base64 || '',
          attachment_content_type: primaryAttachment.ContentType || n.attachment_mime_type || '',
          power_automate_attachment_name: n.power_automate_attachment_name || primaryAttachment.Name || n.attachment_filename || '',
          power_automate_attachment_content_base64: n.power_automate_attachment_content_base64 || primaryAttachment.ContentBytes || n.attachment_content_base64 || '',
          power_automate_attachment_mime_type: n.power_automate_attachment_mime_type || primaryAttachment.ContentType || n.attachment_mime_type || '',
          raw_attachments:      n.attachments || [],
          attachments:          outlookAttachments,
          outlook_attachments:  outlookAttachments,
          attachment_count:     outlookAttachments.length,
          attachment_summary:   n.attachment_summary || '',
          related_entity:       n.related_entity || '',
          related_record_id:    n.related_record_id || '',
          created_date:         n.created_date,
        };
      })
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});