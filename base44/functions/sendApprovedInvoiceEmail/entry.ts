import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TEST_PROGRAM = 'Test Program';
const TEST_RECIPIENT = 'brownsteven89@gmail.com';
const FROM_EMAIL = 'Steve.brown@enticmd.com';

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

function buildEmailBody(program, monthYear) {
  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 640px;">
    <p>Hello,</p>
    <p>Please find the approved ENTIC invoice attached for ${escapeHtml(program)} for ${escapeHtml(monthYear)}.</p>
    <p>Please let me know if you have any questions.</p>
    <p>Thank you,</p>
    <p style="margin-bottom: 0;"><strong>Steve Brown</strong><br>
    Operations Project Manager<br>
    Ear, Nose &amp; Throat Institute of CT</p>
  </div>`;
}

function getAttachmentInfo(fileUrl, invoiceNumber) {
  const pathname = new URL(fileUrl).pathname.toLowerCase();
  const extension = pathname.endsWith('.xlsx') ? 'xlsx' : pathname.endsWith('.xls') ? 'xls' : 'pdf';
  const mimeTypes = {
    pdf: 'application/pdf',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  const safeNumber = String(invoiceNumber || 'approved-invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    filename: `${safeNumber}.${extension}`,
    mimeType: mimeTypes[extension]
  };
}

Deno.serve(async (req) => {
  let base44;
  let invoiceId;

  try {
    if (req.method !== 'POST') {
      return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
    }

    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    invoiceId = body.invoice_id;
    const confirmResend = body.confirm_resend === true;

    if (!invoiceId) {
      return Response.json({ success: false, error: 'invoice_id is required' }, { status: 400 });
    }

    const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId);
    if (!invoice) {
      return Response.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.program_group !== TEST_PROGRAM) {
      return Response.json({
        success: false,
        error: 'Phase 1 test mode only allows sending invoices for Test Program.'
      }, { status: 400 });
    }

    if (!invoice.approved_invoice_url) {
      return Response.json({ success: false, error: 'Approved invoice PDF or Excel file is required before sending.' }, { status: 400 });
    }

    if (!(invoice.status === 'approved' || invoice.invoice_ready_to_send === true)) {
      return Response.json({ success: false, error: 'Invoice must be Approved or marked Invoice Ready to Send.' }, { status: 400 });
    }

    if (invoice.invoice_email_sent === true && !confirmResend) {
      return Response.json({
        success: false,
        duplicate: true,
        sent_date: invoice.invoice_email_sent_date || '',
        sent_to: invoice.invoice_email_sent_to || '',
        error: 'This invoice was already emailed. Confirm resend to continue.'
      }, { status: 409 });
    }

    const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
    const program = (programLocations || []).find(item =>
      item.program_group === TEST_PROGRAM || item.program_location === TEST_PROGRAM
    );
    const recipient = program?.invoice_recipient_email || TEST_RECIPIENT;

    if (recipient !== TEST_RECIPIENT) {
      return Response.json({
        success: false,
        error: 'Phase 1 safeguard failed: Test Program recipient must be brownsteven89@gmail.com.'
      }, { status: 400 });
    }

    const monthYear = invoice.month || 'Invoice Period';
    const subject = `ENTIC Invoice - ${TEST_PROGRAM} - ${monthYear}`;
    const attachment = getAttachmentInfo(invoice.approved_invoice_url, invoice.invoice_number);

    const notification = await base44.asServiceRole.entities.NotificationQueue.create({
      notification_type: 'Invoice',
      related_entity: 'Invoice',
      related_record_id: invoice.id,
      location: TEST_PROGRAM,
      send_date: todayET(),
      from_email: FROM_EMAIL,
      to: recipient,
      cc: '',
      bcc: '',
      subject,
      body: buildEmailBody(TEST_PROGRAM, monthYear),
      attachment_url: invoice.approved_invoice_url,
      attachment_filename: attachment.filename,
      attachment_mime_type: attachment.mimeType,
      status: 'Ready to Send',
      ready_to_send: true,
      sent_date: null,
      sent_by: null,
      error_message: null
    });

    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      invoice_email_sent: invoice.invoice_email_sent === true,
      invoice_email_send_status: 'Ready to Send',
      invoice_email_error_message: null,
      invoice_email_notification_id: notification.id
    });

    return Response.json({
      success: true,
      queued: true,
      notification_id: notification.id,
      to: recipient,
      from: FROM_EMAIL,
      subject,
      message: 'Approved invoice email queued for Power Automate sending.'
    });
  } catch (error) {
    if (base44 && invoiceId) {
      try {
        await base44.asServiceRole.entities.Invoice.update(invoiceId, {
          invoice_email_sent: false,
          invoice_email_send_status: 'Failed',
          invoice_email_error_message: error.message
        });
      } catch (_) {
        // Ignore secondary update failures so the original error is returned.
      }
    }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});