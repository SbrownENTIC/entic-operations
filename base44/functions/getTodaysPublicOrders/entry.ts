import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Only "open" orders are editable drafts visible on the public form.
// All other statuses (pending_review and beyond) are read-only past/submitted orders.
const OPEN_STATUS = 'open';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent orders via service role (admin access)
        const allOrders = await base44.asServiceRole.entities.SupplyOrder.list('-created_date', 200);

        const visibleOrders = allOrders.filter(order => {
            if (order.category !== 'office') return false;
            return order.status === OPEN_STATUS;
        });

        return Response.json(visibleOrders);
    } catch (error) {
        console.error('Error fetching public orders:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});