import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getTodayInEasternTime() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function mapNotification(record) {
  return {
    id: record.id,
    to: record.to || '',
    cc: record.cc || '',
    bcc: record.bcc || '',
    subject: record.subject || '',
    body: record.body || '',
    notification_type: record.notification_type || '',
    send_date: record.send_date || '',
    related_record_id: record.related_record_id || '',
    invoice_number: record.invoice_number || '',
    facility_name: record.facility_name || '',
    provider_name: record.provider_name || '',
    attachment_filename: record.attachment_filename || '',
    attachment_content_type: record.attachment_content_type || '',
    has_attachment: Boolean(record.attachment_filename || record.attachment_url || record.attachment_source_id)
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const todayEastern = getTodayInEasternTime();

    const records = await base44.asServiceRole.entities.NotificationQueue.filter({
      notification_type: 'Invoice Email',
      status: 'Ready to Send',
      ready_to_send: true,
      send_date: todayEastern
    }, '-created_date', 1000);

    const notifications = records
      .filter((record) => isBlank(record.sent_date))
      .map(mapNotification);

    return Response.json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    return Response.json({
      success: false,
      count: 0,
      notifications: [],
      error: error.message
    }, { status: 500 });
  }
});