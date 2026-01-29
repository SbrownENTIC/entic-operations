import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent orders via service role (admin access) to show on public page
        const allOrders = await base44.asServiceRole.entities.SupplyOrder.list('-created_date', 200);
        
        // Get current date in EST as YYYY-MM-DD
        const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const todaysOrders = allOrders.filter(order => {
            // Must be office category
            if (order.category !== 'office') return false;
            
            // Filter out merged orders
            if (order.status === 'merged') return false;

            // Match if order_date is today
            if (order.order_date === todayEST) return true;

            // OR Match if created_date (in EST) is today
            if (order.created_date) {
                try {
                    const createdEST = new Date(order.created_date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
                    if (createdEST === todayEST) return true;
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