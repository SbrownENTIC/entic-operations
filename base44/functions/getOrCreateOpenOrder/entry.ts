import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Open statuses - orders that are still "in progress" from the public interface's perspective
const OPEN_STATUSES = ['pending_review', 'pending_fulfillment', 'approved'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { location } = await req.json();

    if (!location) {
      return Response.json({ error: 'Location is required' }, { status: 400 });
    }

    // Look for an existing open order for this location
    const allOrders = await base44.asServiceRole.entities.SupplyOrder.filter({
      location,
      submission_source: 'public_form'
    });

    const openOrder = allOrders.find(o => OPEN_STATUSES.includes(o.status));

    if (openOrder) {
      return Response.json({ order: openOrder, created: false });
    }

    // No open order — create a fresh draft
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const newOrder = await base44.asServiceRole.entities.SupplyOrder.create({
      location,
      order_date: today,
      status: 'pending_fulfillment',
      vendor: 'Staples Business',
      items: [],
      subtotal: 0,
      total_amount: 0,
      notes: '',
      review_flags: [],
      submission_source: 'public_form'
    });

    return Response.json({ order: newOrder, created: true });
  } catch (error) {
    console.error('getOrCreateOpenOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});