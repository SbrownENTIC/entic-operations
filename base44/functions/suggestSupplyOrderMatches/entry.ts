import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Auth Check (Service Role optional if user is logged in, but let's stick to user auth for search)
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { vendor_name, total_amount, invoice_date } = await req.json();

        // 2. Fetch recent Clinical Supply Orders
        // We can't do complex OR/Fuzzy queries easily with simple filter, so we fetch a broader set and filter in memory
        // optimizing: fetch orders with status not 'cancelled' (or all), maybe limit to last 6 months if possible, 
        // but for now let's just fetch a good chunk of recent ones.
        const orders = await base44.entities.SupplyOrder.list('-order_date', 100); 

        // 3. Score/Filter Matches
        const suggestions = orders.filter(order => {
            // Only consider clinical orders (user asked for clinical supply orders matching)
            if (order.category !== 'clinical') return false;

            let score = 0;
            const orderVendor = (order.vendor || '').toLowerCase();
            const invVendor = (vendor_name || '').toLowerCase();

            // Exact vendor match
            if (orderVendor && invVendor && (orderVendor.includes(invVendor) || invVendor.includes(orderVendor))) {
                score += 5;
            }

            // Amount match (allow small difference)
            const orderTotal = order.total_amount || 0;
            const invTotal = total_amount || 0;
            if (Math.abs(orderTotal - invTotal) < 0.1) {
                score += 10;
            }

            // Date proximity (if within 7 days)
            if (invoice_date && order.order_date) {
                const d1 = new Date(invoice_date);
                const d2 = new Date(order.order_date);
                const diffTime = Math.abs(d2 - d1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays <= 7) score += 2;
            }

            // Return if score is high enough (at least vendor match or exact amount match)
            return score >= 5;
        }).map(order => ({
            ...order,
            match_reason: Math.abs((order.total_amount || 0) - (total_amount || 0)) < 0.1 ? 'Exact Amount Match' : 'Vendor Match'
        }));

        return Response.json({ suggestions });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});