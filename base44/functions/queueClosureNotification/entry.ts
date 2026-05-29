import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLongDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function signatureBlock() {
  return `<p style="margin: 16px 0 12px 0;">Thank you,</p>

  <p style="margin: 0 0 4px 0; font-weight: bold; color: #003366; font-size: 16px;">Steve Brown</p>
  <p style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px;">Operations Manager</p>

  <div style="margin: 16px 0 12px 0;">
    <img src="https://enticmd.com/wp-content/uploads/2024/07/ENT-CT-logo-1.png" alt="ENTIC Logo" style="max-width: 220px; height: auto; display: block;">
  </div>

  <p style="margin: 0 0 4px 0; font-size: 13px; color: #1f2937;"><strong>Ear, Nose &amp; Throat Institute of CT</strong></p>
  <p style="margin: 0; font-size: 12px; color: #6b7280;">599 Farmington Ave., Suite 102<br>Farmington, CT 06032</p>
  <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;"><a href="tel:860-284-4950">(860) 284-4950</a><br><a href="http://www.enticmd.com" style="color: #1f4e78; text-decoration: none;">www.enticmd.com</a></p>

  <p style="margin: 12px 0 0 0; font-weight: bold; color: #ff6b35; font-size: 15px;">ENT Express – Now Open in Farmington!</p>`;
}

function buildClosureBody(reminder, notificationType) {
  const closureName = reminder.closure_name || reminder.reminder_name || 'Office Closure';
  const closureDateFormatted = formatLongDate(reminder.closure_date);
  const reopenDateFormatted = formatLongDate(reminder.reopen_date);
  const reopenTime = reminder.reopen_time || '8:00 AM';
  const closureTime = reminder.closure_time ? ` at ${escapeHtml(reminder.closure_time)}` : '';
  const oncallProvider = reminder.oncall_provider_list || '';
  const oncallPhone = reminder.oncall_phone_list || '';

  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px;">
  <div style="border-bottom: 3px solid #1f4e78; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1f4e78; font-size: 20px;">${notificationType === 'Holiday Closure' ? 'Holiday' : 'Office'} Closure Notification</h2>
    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Ear, Nose &amp; Throat Institute of Connecticut</p>
  </div>

  <p style="margin: 0 0 12px 0;">Good Morning,</p>

  <p style="margin: 0 0 12px 0;">This email is to notify you that our office will be closed${closureTime ? ` ${closureTime}` : ''} on <strong>${escapeHtml(closureDateFormatted)}${closureName && closureName !== 'Office Closure' ? ` in observance of ${escapeHtml(closureName)}` : ''}</strong>.</p>

  ${reopenDateFormatted ? `<p style="margin: 0 0 12px 0;">The office will re-open on <strong>${escapeHtml(reopenDateFormatted)} at ${escapeHtml(reopenTime)}</strong>.</p>` : ''}

  ${oncallProvider ? `<p style="margin: 0 0 12px 0;"><strong>On-call provider:</strong> ${escapeHtml(oncallProvider)}${oncallPhone ? `<br><strong>Contact:</strong> ${escapeHtml(oncallPhone)}` : ''}</p>` : ''}

  <p style="margin: 0 0 12px 0;">If you have any urgent needs during this time, please contact our on-call provider listed above.</p>

  ${signatureBlock()}
  </div>`;
}

function buildReminderBody(reminder) {
  const reminderDate = reminder.send_date ? formatLongDate(reminder.send_date) : '';
  const details = reminder.email_body || '';

  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px;">
  <div style="border-bottom: 3px solid #1f4e78; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1f4e78; font-size: 20px;">Reminder Notification</h2>
  </div>

  <p style="margin: 0 0 12px 0;">Good Morning,</p>

  <p style="margin: 0 0 8px 0;"><strong>Reminder:</strong> ${escapeHtml(reminder.reminder_name)}</p>
  ${reminderDate ? `<p style="margin: 0 0 12px 0;"><strong>Reminder Date:</strong> ${escapeHtml(reminderDate)}</p>` : ''}

  <div style="margin: 12px 0 16px 0;">${details}</div>

  ${signatureBlock()}
  </div>`;
}

function getNotificationType(reminder) {
  if (reminder.reminder_type === 'Holiday') return 'Holiday Closure';
  if (reminder.reminder_type === 'Office Closure' || reminder.reminder_type === 'Inclement Weather') return 'Office Closure';
  if (reminder.reminder_type === 'Reminder Notification') return 'Reminder Notification';
  return null;
}

async function createQueueRecord(base44, reminder, options = {}) {
  const notificationType = getNotificationType(reminder);
  if (!notificationType) {
    return { success: false, error: 'Only Office Closure, Holiday, Inclement Weather, and Reminder Notification types can be queued.' };
  }

  if (notificationType === 'Reminder Notification' && reminder.email_notification_eligible !== true) {
    return { success: false, error: 'This Reminder Notification is not marked eligible for email notification.' };
  }

  if (!reminder.send_date) return { success: false, error: 'Send Date is required before queueing.' };
  if ((notificationType === 'Office Closure' || notificationType === 'Holiday Closure') && !reminder.closure_date) {
    return { success: false, error: 'Closure Date is required before queueing.' };
  }
  if (!reminder.email_subject || !reminder.email_body) return { success: false, error: 'Subject and body are required before queueing.' };

  const recipients = Array.isArray(reminder.recipients) ? reminder.recipients.map(e => String(e || '').trim()).filter(Boolean) : [];
  if (recipients.length === 0) return { success: false, error: 'At least one recipient is required before queueing.' };

  const closureDate = reminder.closure_date || null;
  const allQueue = await base44.asServiceRole.entities.NotificationQueue.list();
  const existing = (allQueue || []).find(n =>
    n.notification_type === notificationType &&
    n.related_record_id === reminder.id &&
    (n.send_date || '') === (reminder.send_date || '') &&
    (n.closure_date || '') === (closureDate || '') &&
    ['Ready to Send', 'Sent', 'Failed', 'Cancelled'].includes(n.status)
  );

  if (existing && !options.override_duplicate) {
    return {
      success: false,
      duplicate: true,
      existing_id: existing.id,
      existing_status: existing.status,
      message: `This ${notificationType} is already ${existing.status === 'Ready to Send' ? 'queued' : existing.status.toLowerCase()}.`
    };
  }

  const toField = options.to || recipients[0];
  const ccSeparator = notificationType === 'Reminder Notification' ? ';' : '; ';
  const ccField = options.cc || recipients.slice(1).join(ccSeparator);
  const bccField = options.bcc || reminder.bcc || '';
  const htmlBody = notificationType === 'Reminder Notification'
    ? buildReminderBody(reminder)
    : buildClosureBody(reminder, notificationType);

  const record = await base44.asServiceRole.entities.NotificationQueue.create({
    notification_type: notificationType,
    related_entity: 'Reminder',
    related_record_id: reminder.id,
    closure_type: reminder.closure_name || reminder.reminder_name || '',
    location: reminder.location || '',
    send_date: reminder.send_date || null,
    closure_date: closureDate,
    to: toField,
    cc: ccField,
    bcc: bccField,
    subject: reminder.email_subject || '',
    body: htmlBody,
    status: 'Ready to Send',
    ready_to_send: true,
    sent_date: null,
    sent_by: null,
    error_message: null
  });

  return {
    success: true,
    message: `${notificationType} notification queued successfully. Power Automate will retrieve and send this at the next scheduled run.`,
    notification_id: record.id,
    to: toField,
    cc: ccField,
    recipient_count: recipients.length
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { reminder_id, to, cc, bcc, override_duplicate } = body;

    if (!reminder_id) {
      return Response.json({ error: 'reminder_id is required' }, { status: 400 });
    }

    const allReminders = await base44.asServiceRole.entities.Reminder.list();
    const reminder = (allReminders || []).find(r => r.id === reminder_id) || null;
    if (!reminder) {
      return Response.json({ error: 'Reminder not found' }, { status: 404 });
    }

    const result = await createQueueRecord(base44, reminder, { to, cc, bcc, override_duplicate });
    return Response.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});