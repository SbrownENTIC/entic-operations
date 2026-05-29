import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STAGES = [
  { days: 30, label: '30 Day' },
  { days: 14, label: '14 Day' },
  { days: 7, label: '7 Day' }
];

const CC_RECIPIENTS = 'HEldridge@enticmd.com;Steve.brown@enticmd.com';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00-04:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function subtractDays(dateString, days) {
  return addDays(dateString, -days);
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function formatLongDate(dateString) {
  if (!dateString) return '';
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
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

function getSubject(stage, licenseType, expirationDate) {
  if (stage === '30 Day') return `Automatic Reminder: Your ${licenseType} expires on ${expirationDate}`;
  if (stage === '14 Day') return `Automatic Reminder Action Needed: Your ${licenseType} is set to expire on ${expirationDate}`;
  return `Automatic Notification Urgent Action Needed: Your ${licenseType} is set to expire on ${expirationDate}`;
}

function getMessage(stage, providerFirstName, licenseType, expirationDate) {
  if (stage === '30 Day') {
    return `<p style="margin: 0 0 12px 0;">Hi ${escapeHtml(providerFirstName)},</p>

  <p style="margin: 0 0 12px 0;">Just a quick reminder that your ${escapeHtml(licenseType)} is set to expire on ${escapeHtml(expirationDate)}.</p>

  <p style="margin: 0 0 12px 0;">Please make sure to begin any necessary renewal steps. If you've already taken care of this, please send us a copy of the renewed license so we can have it on file for compliance.</p>`;
  }

  if (stage === '14 Day') {
    return `<p style="margin: 0 0 12px 0;">Hi ${escapeHtml(providerFirstName)},</p>

  <p style="margin: 0 0 12px 0;">We wanted to let you know that your ${escapeHtml(licenseType)} is set to expire on ${escapeHtml(expirationDate)}, which is coming up in just two weeks!</p>

  <p style="margin: 0 0 12px 0;">If you haven't started the renewal process, now's the time. If you've already submitted your renewal, please send us a copy so we can keep everything up to date for compliance.</p>`;
  }

  return `<p style="margin: 0 0 12px 0;">Hi ${escapeHtml(providerFirstName)},</p>

  <p style="margin: 0 0 12px 0;">This is an urgent reminder that your ${escapeHtml(licenseType)} will expire on ${escapeHtml(expirationDate)}, just one week away.</p>

  <p style="margin: 0 0 12px 0;">If you haven't completed your renewal, please do so as soon as possible to avoid any interruption in compliance. If you have already renewed, please reply with a copy so we can have it on file for compliance purposes.</p>`;
}

function buildBody(stage, providerName, licenseType, expirationDate) {
  const providerFirstName = String(providerName || '').trim().split(/\s+/)[0] || providerName;
  return `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px;">
  <div style="border-bottom: 3px solid #1f4e78; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #1f4e78; font-size: 20px;">License Expiration Reminder</h2>
    <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Ear, Nose &amp; Throat Institute of Connecticut</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 0 0 18px 0; font-size: 14px;">
    <tr><td style="padding: 4px 8px 4px 0; color: #6b7280;">Provider</td><td style="padding: 4px 0; font-weight: bold; color: #1f2937;">${escapeHtml(providerName)}</td></tr>
    <tr><td style="padding: 4px 8px 4px 0; color: #6b7280;">License Type</td><td style="padding: 4px 0; font-weight: bold; color: #1f2937;">${escapeHtml(licenseType)}</td></tr>
    <tr><td style="padding: 4px 8px 4px 0; color: #6b7280;">Expiration Date</td><td style="padding: 4px 0; font-weight: bold; color: #1f2937;">${escapeHtml(expirationDate)}</td></tr>
    <tr><td style="padding: 4px 8px 4px 0; color: #6b7280;">Reminder Stage</td><td style="padding: 4px 0; font-weight: bold; color: #1f2937;">${escapeHtml(stage)}</td></tr>
  </table>

  ${getMessage(stage, providerFirstName, licenseType, expirationDate)}

  ${signatureBlock()}
  </div>`;
}

function providerEmail(provider) {
  return provider?.work_email || provider?.email || '';
}

function isActiveLicense(license, provider) {
  return license.status !== 'expired' && provider?.status === 'active';
}

async function createForLicense(base44, license, provider, existingQueue, requestedStage = null, manual = false) {
  const results = [];
  const email = providerEmail(provider).trim();
  const providerName = provider?.full_name || '';

  if (!providerName || !email || !license.expiration_date || !isActiveLicense(license, provider)) {
    return [{ license_id: license.id, provider_name: providerName, status: 'skipped', reason: !email ? 'Missing provider work email' : !license.expiration_date ? 'Missing expiration date' : 'License or provider is inactive' }];
  }

  const currentDate = todayET();
  const expirationDateFormatted = formatLongDate(license.expiration_date);

  for (const stage of STAGES) {
    if (requestedStage && requestedStage !== stage.label) continue;

    const sendDate = subtractDays(license.expiration_date, stage.days);
    if (!manual && sendDate !== currentDate) continue;

    const duplicate = existingQueue.find(record =>
      record.notification_type === 'License Expiration Reminder' &&
      record.related_entity === 'License' &&
      record.related_record_id === license.id &&
      record.reminder_stage === stage.label &&
      record.send_date === sendDate &&
      record.expiration_date === license.expiration_date
    );

    if (duplicate) {
      results.push({ license_id: license.id, provider_name: providerName, reminder_stage: stage.label, status: 'skipped', reason: `Already ${duplicate.status}` });
      continue;
    }

    const subject = getSubject(stage.label, license.license_type, expirationDateFormatted);
    const record = await base44.asServiceRole.entities.NotificationQueue.create({
      notification_type: 'License Expiration Reminder',
      related_entity: 'License',
      related_record_id: license.id,
      reminder_stage: stage.label,
      send_date: sendDate,
      license_type: license.license_type,
      expiration_date: license.expiration_date,
      provider_name: providerName,
      to: email,
      cc: CC_RECIPIENTS,
      bcc: '',
      subject,
      body: buildBody(stage.label, providerName, license.license_type, expirationDateFormatted),
      status: 'Ready to Send',
      ready_to_send: true,
      sent_date: null,
      sent_by: null,
      error_message: null
    });

    results.push({ license_id: license.id, provider_name: providerName, reminder_stage: stage.label, status: 'created', notification_id: record.id, send_date: sendDate });
  }

  if (results.length === 0) {
    results.push({ license_id: license.id, provider_name: providerName, status: 'skipped', reason: 'No reminder stage is due today' });
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { license_id, reminder_stage, manual } = body;

    const licenses = await base44.asServiceRole.entities.License.list();
    const providers = await base44.asServiceRole.entities.Provider.list();
    const queue = await base44.asServiceRole.entities.NotificationQueue.list();
    const targets = license_id ? licenses.filter(license => license.id === license_id) : licenses;

    const providerById = new Map((providers || []).map(provider => [provider.id, provider]));
    const details = [];

    for (const license of targets) {
      const provider = providerById.get(license.provider_id);
      const result = await createForLicense(base44, license, provider, queue, reminder_stage || null, !!manual || !!license_id);
      details.push(...result);
    }

    const created = details.filter(d => d.status === 'created').length;
    const skipped = details.length - created;

    return Response.json({
      success: true,
      scanned: targets.length,
      created,
      skipped,
      details,
      message: `Created ${created} license reminder queue record(s). Skipped ${skipped}.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});