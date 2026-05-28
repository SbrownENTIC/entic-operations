import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Helper: safely call entity methods
async function safeFilter(entity, query) {
  try {
    return await entity.filter(query) || [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { reminder_id, to, cc, bcc, override_duplicate } = body;

  if (!reminder_id) {
    return Response.json({ error: 'reminder_id is required' }, { status: 400 });
  }

  // Fetch the Reminder record — list all and find by id
  let reminder = null;
  try {
    const allReminders = await base44.entities.Reminder.list();
    reminder = (allReminders || []).find(r => r.id === reminder_id) || null;
  } catch (e) {
    return Response.json({ error: 'Failed to fetch reminders: ' + e.message }, { status: 500 });
  }
  if (!reminder) {
    return Response.json({ error: 'Reminder not found' }, { status: 404 });
  }

  // Determine notification type
  const isHoliday = reminder.reminder_type === 'Holiday';
  const isOfficeClosure = reminder.reminder_type === 'Office Closure' || reminder.reminder_type === 'Inclement Weather';

  if (!isHoliday && !isOfficeClosure) {
    return Response.json({ error: 'Only Office Closure and Holiday reminder types are supported in Phase 1.' }, { status: 400 });
  }

  const notificationType = isHoliday ? 'Holiday Closure' : 'Office Closure';
  const closureDate = reminder.closure_date || null;

  // ── DUPLICATE PREVENTION ─────────────────────────────────────────────────
  if (!override_duplicate) {
    let existing = [];
    try {
      const allQueue = await base44.entities.NotificationQueue.list();
      existing = (allQueue || []).filter(n =>
        n.notification_type === notificationType &&
        n.related_entity === 'Reminder' &&
        n.related_record_id === reminder_id
      );
    } catch (_) { existing = []; }

    const alreadyQueued = existing.filter(n =>
      (n.status === 'Ready to Send' || n.status === 'Sent') &&
      (!closureDate || !n.closure_date || n.closure_date === closureDate)
    );

    if (alreadyQueued.length > 0) {
      return Response.json({
        success: false,
        duplicate: true,
        message: `A ${notificationType} notification already exists for this record with status "${alreadyQueued[0].status}". Use override_duplicate=true to create another.`,
        existing_id: alreadyQueued[0].id
      });
    }
  }

  // ── BUILD TO / CC / BCC ──────────────────────────────────────────────────
  // The Reminder entity stores a flat "recipients" array.
  // The caller can pass explicit to/cc/bcc splits via the request body.
  // Default: first recipient = To, rest = CC.
  const recipients = Array.isArray(reminder.recipients) ? reminder.recipients : [];

  let toField = to || '';
  let ccField = cc || '';
  const bccField = bcc || '';

  if (!toField && recipients.length > 0) {
    toField = recipients[0];
    ccField = recipients.slice(1).join(', ');
  }

  if (!toField) {
    return Response.json({ error: 'No recipients configured on this reminder.' }, { status: 400 });
  }

  // ── CREATE NotificationQueue RECORD ─────────────────────────────────────
  const record = await base44.entities.NotificationQueue.create({
    notification_type: notificationType,
    related_entity: 'Reminder',
    related_record_id: reminder_id,
    closure_type: reminder.closure_name || reminder.reminder_name || '',
    location: reminder.location || '',
    closure_date: closureDate,
    to: toField,
    cc: ccField,
    bcc: bccField,
    subject: reminder.email_subject || '',
    body: reminder.email_body || '',
    status: 'Ready to Send',
    ready_to_send: true,
    sent_date: null,
    sent_by: null,
    error_message: null
  });

  return Response.json({
    success: true,
    message: `${notificationType} notification queued successfully. Power Automate will retrieve and send this at the next scheduled run.`,
    notification_id: record.id,
    to: toField,
    cc: ccField,
    recipient_count: recipients.length
  });
});