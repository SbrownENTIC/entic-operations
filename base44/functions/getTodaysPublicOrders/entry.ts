import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent orders via service role (admin access) to show on public page
        const allOrders = await base44.asServiceRole.entities.SupplyOrder.list('-created_date', 200);
        
        // Get current date in America/New_York
        const todayNY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const todaysOrders = allOrders.filter(order => {
            // Must be public form submission
            if (order.submission_source !== 'public_form') return false;

            // Must be office category
            if (order.category !== 'office') return false;
            
            // Filter out merged orders
            if (order.status === 'merged') return false;

            // Match if order_date is today (NY)
            if (order.order_date === todayNY) return true;
            
            return false;
        });

        return Response.json(todaysOrders);
    } catch (error) {
        console.error('Error fetching public orders:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});