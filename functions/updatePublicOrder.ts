import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { id, data } = await req.json();
        
        if (!id || !data) {
            return Response.json({ error: "Missing id or data" }, { status: 400 });
        }

        // Fetch the order to check date/status
        const order = await base44.asServiceRole.entities.SupplyOrder.get(id);
        
        if (!order) {
            return Response.json({ error: "Order not found" }, { status: 404 });
        }

        // Check time cutoff: 22:00 UTC
        const now = new Date();
        const hourUTC = now.getUTCHours();
        const todayUTC = now.toISOString().split('T')[0];
        
        // Check if order is from today (using order_date match with UTC date as per existing logic)
        // If order_date matches today's date in YYYY-MM-DD format (UTC)
        if (order.order_date !== todayUTC) {
             return Response.json({ error: "Cannot edit past orders" }, { status: 403 });
        }
        
        if (hourUTC >= 22) {
            return Response.json({ error: "Edit cutoff time (5:00 PM EST) has passed" }, { status: 403 });
        }
        
        // Also check if status allows editing
        if (['order_placed', 'partially_received', 'received'].includes(order.status)) {
            return Response.json({ error: "Order has already been placed/received" }, { status: 403 });
        }

        // Perform update via service role
        const updated = await base44.asServiceRole.entities.SupplyOrder.update(id, data);
        
        return Response.json(updated);
    } catch (error) {
        console.error('Error updating public order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});