import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function todayET() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function splitCc(value) {
  return (value || '')
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .join('; ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = todayET();

    const records = await base44.asServiceRole.entities.NotificationQueue.filter({
      status: 'Ready to Send',
      ready_to_send: true,
      send_date: today,
    });

    const ready = (records || []).filter((n) =>
      !n.sent_date || n.sent_date === '' || n.sent_date === null
    );

    return Response.json({
      success: true,
      count: ready.length,
      cancelled_stale_count: 0,
      cancelled_stale: null,
      notifications: ready.map((n) => ({
        id: n.id,
        notification_type: n.notification_type,
        closure_type: n.closure_type || '',
        location: n.location || '',
        send_date: n.send_date || '',
        closure_date: n.closure_date || '',
        reminder_stage: n.reminder_stage || '',
        license_type: n.license_type || '',
        expiration_date: n.expiration_date || '',
        provider_name: n.provider_name || '',
        subject: n.subject,
        body: n.body,
        to: n.to,
        cc: splitCc(n.cc),
        bcc: n.bcc || '',
        related_record_id: n.related_record_id || '',
        invoice_number: n.invoice_number || '',
        invoice_month: n.invoice_month || '',
        facility_name: n.facility_name || '',
        attachment_filename: n.attachment_filename || '',
        attachment_content_type: n.attachment_content_type || '',
        has_attachment: n.notification_type === 'Invoice Email' && !!n.attachment_filename,
        created_date: n.created_date,
      })),
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});