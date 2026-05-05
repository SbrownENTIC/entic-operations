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

        if (order.submission_source !== 'public_form') {
             return Response.json({ error: "Cannot edit system orders" }, { status: 403 });
        }

        // Check if status allows editing (open statuses only)
        const OPEN_STATUSES = ['pending_review', 'pending_fulfillment'];
        if (!OPEN_STATUSES.includes(order.status)) {
            return Response.json({ error: "Order is no longer open for editing" }, { status: 403 });
        }

        // Perform update via service role
        const updated = await base44.asServiceRole.entities.SupplyOrder.update(id, data);
        
        return Response.json(updated);
    } catch (error) {
        console.error('Error updating public order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});