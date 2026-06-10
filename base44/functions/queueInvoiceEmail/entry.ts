import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function signatureBlock() {
  return `<p style="margin: 16px 0 12px 0;">Thank you,</p>

  <p style="margin: 0 0 0 0; font-weight: bold; color: #003366; font-size: 18px;">Steve Brown</p>
  
  <div style="margin-top: 8px; margin-bottom: 18px;">
    <img src="https://enticmd.com/wp-content/uploads/2024/07/ENT-CT-logo-1.png" alt="ENTIC Logo" style="max-width: 340px; height: auto; display: block;">
  </div>

  <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937; font-size: 14px;">Operations Manager</p>

  <p style="margin: 0 0 4px 0; font-size: 13px; color: #1f2937;"><strong>Ear, Nose &amp; Throat Institute of CT</strong></p>
  <p style="margin: 0 0 4px 0; font-size: 12px; color: #1f2937;">599 Farmington Ave., Suite 102<br>Farmington, CT 06032</p>
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #1f2937;"><a href="tel:860-284-4950" style="color: #1f2937; text-decoration: none;">(860) 284-4950</a></p>
  <p style="margin: 0 0 12px 0; font-size: 12px;"><a href="https://www.enticmd.com" style="color: #16a34a; text-decoration: underline;">www.enticmd.com</a></p>

  <p style="margin: 0; font-weight: bold; color: #ff6b35; font-size: 16px; font-family: Georgia, serif;">ENT Express – Now Open in Farmington &amp; Glastonbury!</p>`;
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function normalizeRecipients(value) {
  return String(value || '')
    .replace(/,/g, ';')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .join('; ');
}

function filenameFromUrl(fileUrl, invoice) {
  try {
    const url = new URL(fileUrl);
    const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    if (lastPart && lastPart.includes('.')) return lastPart;
  } catch (_) {
    const lastPart = String(fileUrl || '').split('/').pop()?.split('?')[0] || '';
    if (lastPart && lastPart.includes('.')) return decodeURIComponent(lastPart);
  }
  return `Approved_Invoice_${invoice.invoice_number || invoice.id}.pdf`;
}

function contentTypeFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'application/octet-stream';
}

function getProviderName(invoice, provider) {
  return invoice.provider_name || provider?.full_name || invoice.program_group || 'the facility';
}

function buildInvoiceBody(invoice, provider) {
  const recipientName = getProviderName(invoice, provider);
  const invoiceMonth = invoice.month || 'the invoice period';

  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px;">
  <div style="border-bottom: 3px solid #1f4e78; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1f4e78; font-size: 20px;">Invoice</h2>
    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Ear, Nose &amp; Throat Institute of Connecticut</p>
  </div>

  <p style="margin: 0 0 12px 0;">Good morning,</p>

  <p style="margin: 0 0 12px 0;">Attached is the <strong>${escapeHtml(invoiceMonth)}</strong> invoice for <strong>${escapeHtml(recipientName)}</strong>.</p>

  <p style="margin: 0 0 12px 0;">Please let me know if anything else is needed.</p>

  ${signatureBlock()}
  </div>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { invoice_id, send_date, to, cc, bcc } = body;

    if (!invoice_id) {
      return Response.json({ success: false, error: 'invoice_id is required' }, { status: 400 });
    }

    const allInvoices = await base44.asServiceRole.entities.Invoice.list();
    const invoice = (allInvoices || []).find(i => i.id === invoice_id);
    if (!invoice) {
      return Response.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.approved_invoice_url) {
      return Response.json({ success: false, error: 'Cannot queue invoice email because no approved invoice attachment is attached to this invoice.' }, { status: 400 });
    }

    const toField = normalizeRecipients(to);
    const ccField = normalizeRecipients(cc);
    const bccField = normalizeRecipients(bcc);

    if (!toField) {
      return Response.json({ success: false, error: 'At least one To recipient is required.' }, { status: 400 });
    }

    const attachmentFilename = filenameFromUrl(invoice.approved_invoice_url, invoice);
    const attachmentContentType = contentTypeFromFilename(attachmentFilename);
    const allQueue = await base44.asServiceRole.entities.NotificationQueue.list();
    const existing = (allQueue || []).find(n =>
      n.notification_type === 'Invoice Email' &&
      n.related_entity === 'Invoice' &&
      n.related_record_id === invoice.id &&
      (n.invoice_number || '') === (invoice.invoice_number || '') &&
      (n.attachment_filename || '') === attachmentFilename &&
      ['Ready to Send', 'Sent'].includes(n.status)
    );

    if (existing) {
      return Response.json({
        success: false,
        duplicate: true,
        existing_id: existing.id,
        existing_status: existing.status,
        error: `This invoice email is already ${existing.status === 'Ready to Send' ? 'queued' : 'sent'}.`
      }, { status: 400 });
    }

    const facilityName = invoice.program_group || '';
    const invoiceMonth = invoice.month || '';
    const provider = invoice.staff_member_id
      ? (await base44.asServiceRole.entities.Provider.filter({ id: invoice.staff_member_id }, '', 1))[0]
      : null;
    const providerName = getProviderName(invoice, provider);
    const subject = `${facilityName || 'Invoice'} ${invoiceMonth || ''} Invoice`.replace(/\s+/g, ' ').trim();

    const record = await base44.asServiceRole.entities.NotificationQueue.create({
      notification_type: 'Invoice Email',
      related_entity: 'Invoice',
      related_record_id: invoice.id,
      invoice_number: invoice.invoice_number || '',
      invoice_month: invoiceMonth,
      facility_name: facilityName,
      provider_name: providerName,
      send_date: send_date || todayET(),
      to: toField,
      cc: ccField,
      bcc: bccField,
      subject,
      body: buildInvoiceBody(invoice, provider),
      attachment_filename: attachmentFilename,
      attachment_content_type: attachmentContentType,
      attachment_source_type: 'Invoice.approved_invoice_url',
      attachment_source_id: invoice.id,
      attachment_url: invoice.approved_invoice_url,
      status: 'Ready to Send',
      ready_to_send: true,
      sent_date: null,
      sent_by: null,
      error_message: null
    });

    return Response.json({
      success: true,
      message: 'Invoice email queued successfully.',
      notification_id: record.id,
      attachment_filename: attachmentFilename,
      attachment_content_type: attachmentContentType
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});