import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'steve.brown@enticmd.com',
      subject,
      body: body_html,
      from_name: 'ENTIC Supply Orders'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});