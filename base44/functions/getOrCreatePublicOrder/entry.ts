import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Returns the current open order for a location (pending_review or pending_fulfillment),
// or creates a new blank draft order if none exists.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { location } = await req.json();

    if (!location) {
      return Response.json({ error: 'Location is required' }, { status: 400 });
    }

    const OPEN_STATUSES = ['pending_review', 'pending_fulfillment'];

    // Find an existing open order for this location from the public form
    const existingOrders = await base44.asServiceRole.entities.SupplyOrder.filter({
      location,
      submission_source: 'public_form',
      status: { $in: OPEN_STATUSES }
    });

    if (existingOrders.length > 0) {
      // Sort by created_date descending, return the most recent open order
      existingOrders.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return Response.json({ order: existingOrders[0], created: false });
    }

    // No open order exists — create a new blank draft
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
    console.error('Error in getOrCreatePublicOrder:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});