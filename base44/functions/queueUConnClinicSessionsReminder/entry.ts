import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REMINDER_NAME = 'UConn Clinic Sessions Reminder';
const TO_RECIPIENTS = 'SBrown@enticmd.com;BTessema@enticmd.com;HWang@enticmd.com';
const CC_RECIPIENTS = 'Steve.brown@enticmd.com;HEldridge@enticmd.com';
const ALL_RECIPIENTS = [
  'SBrown@enticmd.com',
  'BTessema@enticmd.com',
  'HWang@enticmd.com',
  'Steve.brown@enticmd.com',
  'HEldridge@enticmd.com'
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function addMonths(dateString, count) {
  const date = new Date(dateString + 'T12:00:00');
  date.setMonth(date.getMonth() + count);
  return date.toISOString().split('T')[0];
}

function previousMonthName(sendDate) {
  const date = new Date(sendDate + 'T12:00:00');
  date.setMonth(date.getMonth() - 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
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

function buildBody() {
  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px;">
  <div style="border-bottom: 3px solid #1f4e78; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1f4e78; font-size: 20px;">Reminder Notification</h2>
    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Ear, Nose &amp; Throat Institute of Connecticut</p>
  </div>

  <p style="margin: 0 0 12px 0;">Good morning ENTIC Docs,</p>

  <p style="margin: 0 0 12px 0;">This is your reminder to supply us with your clinic sessions for UConn for last month.</p>

  ${signatureBlock()}
  </div>`;
}

async function ensureReminder(base44, sendDate) {
  const reminders = await base44.asServiceRole.entities.Reminder.filter({ reminder_name: REMINDER_NAME }, '', 1);
  const existing = reminders?.[0] || null;
  const reminderData = {
    reminder_name: REMINDER_NAME,
    reminder_type: 'Reminder Notification',
    email_notification_eligible: true,
    email_subject: `UConn Clinic Sessions – ${previousMonthName(sendDate)}`,
    email_body: 'Good morning ENTIC Docs,<br><br>This is your reminder to supply us with your clinic sessions for UConn for last month.',
    recipients: ALL_RECIPIENTS,
    bcc: '',
    send_date: sendDate,
    next_send_date: addMonths(sendDate, 1),
    frequency: 'monthly',
    frequency_count: 1,
    status: 'active'
  };

  if (existing) {
    await base44.asServiceRole.entities.Reminder.update(existing.id, reminderData);
    return { ...existing, ...reminderData };
  }

  return await base44.asServiceRole.entities.Reminder.create(reminderData);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const sendDate = payload.send_date || todayET();

    if (!/^\d{4}-\d{2}-01$/.test(sendDate)) {
      return Response.json({
        success: true,
        skipped: true,
        message: 'UConn Clinic Sessions reminders only queue on the 1st day of each month.',
        send_date: sendDate
      });
    }

    const reminder = await ensureReminder(base44, sendDate);
    const subject = `UConn Clinic Sessions – ${previousMonthName(sendDate)}`;
    const queueRecords = await base44.asServiceRole.entities.NotificationQueue.list();
    const existing = (queueRecords || []).find(n =>
      n.notification_type === 'Reminder Notification' &&
      n.related_entity === 'Reminder' &&
      n.related_record_id === reminder.id &&
      n.send_date === sendDate &&
      ['Ready to Send', 'Sent', 'Failed', 'Cancelled'].includes(n.status)
    );

    if (existing) {
      return Response.json({
        success: true,
        duplicate: true,
        notification_id: existing.id,
        existing_status: existing.status,
        subject: existing.subject,
        to: existing.to,
        cc: existing.cc,
        bcc: existing.bcc || '',
        send_date: sendDate,
        message: `UConn Clinic Sessions reminder for ${sendDate} is already ${existing.status === 'Ready to Send' ? 'queued' : existing.status.toLowerCase()}.`
      });
    }

    const record = await base44.asServiceRole.entities.NotificationQueue.create({
      notification_type: 'Reminder Notification',
      related_entity: 'Reminder',
      related_record_id: reminder.id,
      closure_type: REMINDER_NAME,
      send_date: sendDate,
      to: TO_RECIPIENTS,
      cc: CC_RECIPIENTS,
      bcc: '',
      subject,
      body: buildBody(),
      status: 'Ready to Send',
      ready_to_send: true,
      sent_date: null,
      sent_by: null,
      error_message: null
    });

    return Response.json({
      success: true,
      notification_id: record.id,
      reminder_id: reminder.id,
      subject,
      to: TO_RECIPIENTS,
      cc: CC_RECIPIENTS,
      bcc: '',
      send_date: sendDate,
      next_send_date: addMonths(sendDate, 1),
      message: 'UConn Clinic Sessions reminder queued successfully.'
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});