import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Deployment date of the new submission logic — orders created BEFORE this are legacy
const DEPLOYMENT_DATE = new Date('2026-05-13T00:00:00.000Z');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all open orders
    const openOrders = await base44.asServiceRole.entities.SupplyOrder.filter({ status: 'open' });

    // Filter to only legacy ones (created before deployment date)
    const legacyOrders = openOrders.filter(order => {
      const created = new Date(order.created_date);
      return created < DEPLOYMENT_DATE;
    });

    if (legacyOrders.length === 0) {
      return Response.json({ success: true, message: 'No legacy open orders found.', migrated: 0 });
    }

    const recipientEmail = Deno.env.get('APPROVAL_EMAIL') || 'hollyjo@enticmd.com';
    const results = [];

    for (const order of legacyOrders) {
      // Update status to pending_review
      await base44.asServiceRole.entities.SupplyOrder.update(order.id, {
        status: 'pending_review'
      });

      // Send notification email (same logic as updatePublicOrder)
      const items = order.items || [];
      const location = order.location || 'Unknown';
      const notes = order.notes || '';
      const hasFlags = (order.review_flags || []).length > 0;

      const itemList = items.map(item =>
        `<li>${item.supply_name}${item.item_number ? ` (Item# ${item.item_number})` : ''} — Qty: ${item.quantity}</li>`
      ).join('');

      const emailBody = `
        <h2>Supply Request Submitted — ${location}</h2>
        <p><em>This order was migrated from a legacy open draft.</em></p>
        ${hasFlags ? '<p><strong style="color:orange;">⚠ This order has been flagged for review.</strong></p>' : ''}
        <h3>Items:</h3>
        <ul>${itemList || '<li>No items listed</li>'}</ul>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        <p>Please review this request in the ENTIC Operations Center.</p>
      `;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipientEmail,
          subject: `Supply Request Submitted — ${location}`,
          body: emailBody
        });
        results.push({ id: order.id, location, status: 'migrated', email: 'sent' });
      } catch (emailError) {
        console.error(`Failed to send email for order ${order.id}:`, emailError);
        results.push({ id: order.id, location, status: 'migrated', email: 'failed' });
      }
    }

    return Response.json({
      success: true,
      migrated: results.length,
      deployment_cutoff: DEPLOYMENT_DATE.toISOString(),
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});