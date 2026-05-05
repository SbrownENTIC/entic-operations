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

        // Only block orders that are fully closed
        if (['order_placed', 'partially_received', 'received', 'merged', 'rejected'].includes(order.status)) {
            return Response.json({ error: "Order has already been placed and cannot be edited" }, { status: 403 });
        }

        // Perform update via service role
        const updated = await base44.asServiceRole.entities.SupplyOrder.update(id, data);
        
        return Response.json(updated);
    } catch (error) {
        console.error('Error updating public order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});