import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));

const maskEmail = (email) => {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '[invalid email]';
  return `${local.slice(0, 2)}***@${domain}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data } = body;

    // Only notify for public form submissions of office orders
    if (data?.submission_source !== 'public_form' || data?.category !== 'office') {
      return Response.json({ skipped: true });
    }

    const order = data;
    const itemsList = (order.items || [])
      .map(item => `<li>${item.item_number ? `<strong>#${item.item_number}</strong> – ` : ''}${item.supply_name} (Qty: ${item.quantity})</li>`)
      .join('');

    const subject = `New Supply Order – ${order.location} (${order.order_date})`;
    const body_html = `
      <p>A new supply order has been submitted via the public request form.</p>
      <table style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0; font-weight:bold; color:#555;">Location:</td><td>${order.location}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; font-weight:bold; color:#555;">Date:</td><td>${order.order_date}</td></tr>
        <tr><td style="padding:4px 12px 4px 0; font-weight:bold; color:#555;">Status:</td><td>${order.status}</td></tr>
        ${order.notes ? `<tr><td style="padding:4px 12px 4px 0; font-weight:bold; color:#555;">Notes:</td><td>${order.notes}</td></tr>` : ''}
      </table>
      <p style="font-weight:bold; margin-top:12px;">Items Ordered:</p>
      <ul style="font-family:sans-serif; font-size:14px;">${itemsList}</ul>
      <p style="margin-top:16px; color:#888; font-size:12px;">You can review this order in the ENTIC Operations Center under Office Supply Orders.</p>
    `;

    const rawRecipientEmail = Deno.env.get('SUPPLY_ORDER_NOTIFICATION_RECIPIENT');
    const normalizedSecretEmail = normalizeEmail(rawRecipientEmail);
    const recipientEmail = isValidEmail(normalizedSecretEmail) ? normalizedSecretEmail : 'steve.brown@enticmd.com';

    console.info('SUPPLY_ORDER_NOTIFICATION_RECIPIENT resolved for send', {
      masked_email: maskEmail(recipientEmail),
      normalized_length: recipientEmail.length,
      had_surrounding_whitespace: rawRecipientEmail !== String(rawRecipientEmail || '').trim(),
      used_default_recipient: recipientEmail !== normalizedSecretEmail
    });

    const appUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    const matchingUser = appUsers.find(user => normalizeEmail(user.email) === recipientEmail);

    if (!matchingUser) {
      console.warn('Supply order notification recipient is not an app user', {
        masked_email: maskEmail(recipientEmail),
        checked_field: 'User.email'
      });
      return Response.json({
        error: 'Notification recipient must be an app user',
        masked_email: maskEmail(recipientEmail),
        checked_field: 'User.email',
        normalized_length: recipientEmail.length,
        used_default_recipient: recipientEmail !== normalizedSecretEmail
      }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: matchingUser.email,
      subject,
      body: body_html,
      from_name: 'ENTIC Supply Orders'
    });

    return Response.json({ success: true, to: maskEmail(matchingUser.email) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});