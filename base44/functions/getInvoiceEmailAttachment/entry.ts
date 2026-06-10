import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function contentTypeFromFilename(filename, fallback = '') {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return fallback || 'application/octet-stream';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function filenameFromUrl(fileUrl, fallback) {
  try {
    const url = new URL(fileUrl);
    const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    if (lastPart && lastPart.includes('.')) return lastPart;
  } catch (_) {
    const lastPart = String(fileUrl || '').split('/').pop()?.split('?')[0] || '';
    if (lastPart && lastPart.includes('.')) return decodeURIComponent(lastPart);
  }
  return fallback || 'approved_invoice.pdf';
}

async function markAttachmentFailed(base44, notificationId, errorMessage) {
  if (!base44 || !notificationId) return;
  try {
    await base44.asServiceRole.entities.NotificationQueue.update(notificationId, {
      status: 'Failed',
      ready_to_send: false,
      error_message: errorMessage || 'Invoice attachment retrieval failed.'
    });
  } catch (_) {
    // Do not hide the original attachment retrieval error.
  }
}

Deno.serve(async (req) => {
  let base44;
  let notificationIdForFailure = '';

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { notification_id } = body;
    notificationIdForFailure = notification_id || '';

    if (!notification_id) {
      return Response.json({ success: false, error: 'notification_id is required' }, { status: 400 });
    }

    const allNotifications = await base44.asServiceRole.entities.NotificationQueue.list();
    const notification = (allNotifications || []).find(n => n.id === notification_id);
    if (!notification) {
      return Response.json({ success: false, error: 'NotificationQueue record not found' }, { status: 404 });
    }

    if (notification.notification_type !== 'Invoice Email') {
      return Response.json({ success: false, error: 'This notification is not an Invoice Email record.' }, { status: 400 });
    }

    if (!notification.related_record_id) {
      const errorMessage = 'Invoice Email notification is missing related invoice ID.';
      await markAttachmentFailed(base44, notification.id, errorMessage);
      return Response.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const allInvoices = await base44.asServiceRole.entities.Invoice.list();
    const invoice = (allInvoices || []).find(i => i.id === notification.related_record_id);
    if (!invoice) {
      const errorMessage = 'Related invoice record not found.';
      await markAttachmentFailed(base44, notification.id, errorMessage);
      return Response.json({ success: false, error: errorMessage }, { status: 404 });
    }

    const fileUrl = invoice.approved_invoice_url || notification.attachment_url;
    if (!fileUrl) {
      const errorMessage = 'Cannot retrieve attachment because the related invoice has no approved invoice attachment.';
      await markAttachmentFailed(base44, notification.id, errorMessage);
      return Response.json({ success: false, error: errorMessage }, { status: 400 });
    }

    let downloadableUrl = fileUrl;
    if (!String(fileUrl).startsWith('http')) {
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUrl, expires_in: 300 });
      downloadableUrl = signed.signed_url;
    }

    const fileResponse = await fetch(downloadableUrl);
    if (!fileResponse.ok) {
      const errorMessage = `Could not download approved invoice attachment. HTTP ${fileResponse.status}`;
      await markAttachmentFailed(base44, notification.id, errorMessage);
      return Response.json({ success: false, error: errorMessage }, { status: 502 });
    }

    const filename = notification.attachment_filename || filenameFromUrl(fileUrl, `Approved_Invoice_${invoice.invoice_number || invoice.id}.pdf`);
    const headerContentType = fileResponse.headers.get('content-type') || '';
    const contentType = contentTypeFromFilename(filename, headerContentType.split(';')[0]);
    const buffer = await fileResponse.arrayBuffer();

    if (!buffer || buffer.byteLength === 0) {
      const errorMessage = 'Approved invoice attachment was downloaded but contained no file content.';
      await markAttachmentFailed(base44, notification.id, errorMessage);
      return Response.json({ success: false, error: errorMessage }, { status: 502 });
    }

    return Response.json({
      success: true,
      filename,
      contentType,
      base64Content: arrayBufferToBase64(buffer)
    });
  } catch (error) {
    await markAttachmentFailed(base44, notificationIdForFailure, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});