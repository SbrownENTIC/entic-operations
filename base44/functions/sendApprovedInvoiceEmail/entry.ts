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

function safeInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber || 'approved-invoice').replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
}

function fileNameFromUrl(fileUrl) {
  const rawName = decodeURIComponent(String(fileUrl || '').split('?')[0].split('/').pop() || '');
  return rawName.replace(/^[a-f0-9]{6,}_/i, '').trim();
}

function fileNameFromContentDisposition(header) {
  const value = String(header || '');
  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) return decodeURIComponent(encodedMatch[1].replace(/"/g, '')).trim();
  const plainMatch = value.match(/filename="?([^";]+)"?/i);
  if (plainMatch) return plainMatch[1].trim();
  return '';
}

function urlLooksLike(fileUrl, extensions) {
  const value = String(fileUrl || '').toLowerCase().split('?')[0];
  return extensions.some(ext => value.endsWith(ext) || value.includes(ext));
}

function inferMimeType(fileUrl, responseType) {
  const contentType = String(responseType || '').split(';')[0].trim().toLowerCase();
  if (contentType === 'application/pdf') return 'application/pdf';
  if (contentType === 'application/vnd.ms-excel') return 'application/vnd.ms-excel';
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return contentType;
  if (urlLooksLike(fileUrl, ['.xlsx'])) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (urlLooksLike(fileUrl, ['.xls'])) return 'application/vnd.ms-excel';
  return 'application/pdf';
}

function fileTypeFromMime(mimeType) {
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (mimeType === 'application/vnd.ms-excel') return 'xls';
  return 'pdf';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  }
  return btoa(binary);
}

async function buildAttachment({ fileUrl, invoiceId, invoiceNumber, sourceField, required, label }) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Unable to download ${label} attachment from ${sourceField}`);
  }

  const buffer = await response.arrayBuffer();
  const mimeType = inferMimeType(fileUrl, response.headers.get('content-type'));
  const fileType = fileTypeFromMime(mimeType);

  const responseFileName = fileNameFromContentDisposition(response.headers.get('content-disposition'));
  const sourceFileName = responseFileName || fileNameFromUrl(fileUrl);
  const fallbackFileName = `${safeInvoiceNumber(invoiceNumber)} ${label}.${fileType}`;
  const fileName = sourceFileName && sourceFileName.includes('.') ? sourceFileName : fallbackFileName;

  return {
    invoice_id: invoiceId,
    source_field: sourceField,
    file_name: fileName,
    file_type: fileType,
    mime_type: mimeType,
    file_url: fileUrl,
    download_url: fileUrl,
    content_base64: arrayBufferToBase64(buffer),
    required
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

    const approvedPdfUrl = invoice.approved_invoice_pdf_url || (urlLooksLike(invoice.approved_invoice_url, ['.pdf']) ? invoice.approved_invoice_url : '');
    const approvedExcelUrl = invoice.approved_invoice_excel_url || (urlLooksLike(invoice.approved_invoice_url, ['.xlsx', '.xls']) ? invoice.approved_invoice_url : '');

    if (!approvedPdfUrl && !approvedExcelUrl) {
      return Response.json({ success: false, error: 'Approved invoice file is required before sending.' }, { status: 400 });
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
    const primaryFileUrl = approvedPdfUrl || approvedExcelUrl;
    const primaryIsPdf = !!approvedPdfUrl;
    const primaryAttachment = await buildAttachment({
      fileUrl: primaryFileUrl,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      sourceField: primaryIsPdf
        ? (invoice.approved_invoice_pdf_url ? 'approved_invoice_pdf_url' : 'approved_invoice_url')
        : (invoice.approved_invoice_excel_url ? 'approved_invoice_excel_url' : 'approved_invoice_url'),
      required: true,
      label: primaryIsPdf ? 'Approved_PDF_Invoice' : 'Approved_Excel_Invoice'
    });
    const attachments = [primaryAttachment];

    if (approvedPdfUrl && approvedExcelUrl && approvedExcelUrl !== approvedPdfUrl) {
      attachments.push(await buildAttachment({
        fileUrl: approvedExcelUrl,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        sourceField: invoice.approved_invoice_excel_url ? 'approved_invoice_excel_url' : 'approved_invoice_url',
        required: false,
        label: 'Approved_Excel_Invoice'
      }));
    }

    const attachmentSummary = approvedPdfUrl && approvedExcelUrl && approvedExcelUrl !== approvedPdfUrl
      ? 'Approved PDF included; approved Excel included.'
      : primaryIsPdf
        ? 'Approved PDF included.'
        : 'Approved Excel included.';
    const outlookAttachments = attachments.map(attachment => ({
      Name: attachment.file_name,
      ContentBytes: attachment.content_base64,
      ContentType: attachment.mime_type
    }));

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
      attachment_url: primaryAttachment.file_url,
      attachment_filename: primaryAttachment.file_name,
      attachment_mime_type: primaryAttachment.mime_type,
      attachment_content_base64: primaryAttachment.content_base64,
      power_automate_attachment_name: primaryAttachment.file_name,
      power_automate_attachment_content_base64: primaryAttachment.content_base64,
      power_automate_attachment_mime_type: primaryAttachment.mime_type,
      attachments,
      outlook_attachments: outlookAttachments,
      attachment_count: attachments.length,
      attachment_summary: attachmentSummary,
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