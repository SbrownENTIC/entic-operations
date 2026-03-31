import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { location, limit = 20 } = body;

    const query = { submission_source: 'public_form', category: 'office' };
    if (location) query.location = location;

    const orders = await base44.asServiceRole.entities.SupplyOrder.filter(
      query,
      '-order_date',
      limit
    );

    // Get today's date string to exclude today's orders
    const todayStr = new Date().toISOString().split('T')[0];
    const pastOrders = orders.filter(o => o.order_date < todayStr);

    return Response.json({ orders: pastOrders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});