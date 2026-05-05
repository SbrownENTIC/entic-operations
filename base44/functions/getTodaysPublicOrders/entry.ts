import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Statuses that mean an order is still open / visible in the public form
const OPEN_STATUSES = ['pending_review', 'pending_fulfillment'];
// Statuses that mean an order is fully placed and should disappear from the public form
const CLOSED_STATUSES = ['order_placed', 'received', 'merged', 'rejected'];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent orders via service role (admin access) to show on public page
        const allOrders = await base44.asServiceRole.entities.SupplyOrder.list('-created_date', 200);

        const visibleOrders = allOrders.filter(order => {
            // Must be public form submission
            if (order.submission_source !== 'public_form') return false;

            // Must be office category
            if (order.category !== 'office') return false;

            // Exclude orders that have been placed/closed
            if (CLOSED_STATUSES.includes(order.status)) return false;

            // Include open (pending) orders regardless of date
            if (OPEN_STATUSES.includes(order.status)) return true;

            return false;
        });

        return Response.json(visibleOrders);
    } catch (error) {
        console.error('Error fetching public orders:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});