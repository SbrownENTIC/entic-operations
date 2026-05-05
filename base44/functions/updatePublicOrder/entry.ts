import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { id, data } = await req.json();
        
        if (!id || !data) {
            return Response.json({ error: "Missing id or data" }, { status: 400 });
        }

        const order = await base44.asServiceRole.entities.SupplyOrder.get(id);
        
        if (!order) {
            return Response.json({ error: "Order not found" }, { status: 404 });
        }

        // Only "open" orders can be updated via the public form
        if (order.status !== 'open') {
            return Response.json({ error: "Only open draft orders can be edited" }, { status: 403 });
        }

        const updated = await base44.asServiceRole.entities.SupplyOrder.update(id, data);
        
        return Response.json(updated);
    } catch (error) {
        console.error('Error updating public order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});