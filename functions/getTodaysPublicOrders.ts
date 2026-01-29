import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Time cutoff check: 22:00 UTC
        const now = new Date();
        if (now.getUTCHours() >= 22) {
            return Response.json([]);
        }

        // Fetch recent orders via service role (admin access) to show on public page
        const allOrders = await base44.asServiceRole.entities.SupplyOrder.list('-created_date', 200);
        
        // Get current date in UTC
        const todayUTC = now.toISOString().split('T')[0];

        const todaysOrders = allOrders.filter(order => {
            // Must be public form submission
            if (order.submission_source !== 'public_form') return false;

            // Must be office category
            if (order.category !== 'office') return false;
            
            // Filter out merged orders
            if (order.status === 'merged') return false;

            // Match if order_date is today (UTC)
            if (order.order_date === todayUTC) return true;

            // OR Match if created_date (in UTC) is today
            if (order.created_date) {
                try {
                    const createdUTC = new Date(order.created_date).toISOString().split('T')[0];
                    if (createdUTC === todayUTC) return true;
                } catch (e) {
                    // ignore parsing errors
                }
            }
            
            return false;
        });

        return Response.json(todaysOrders);
    } catch (error) {
        console.error('Error fetching public orders:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});