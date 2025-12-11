import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all invoices (increase limit to ensure we catch older ones)
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 1000);
        
        const henryInvoices = invoices.filter(inv => {
            const name = (inv.vendor_name || '').toLowerCase();
            return name.includes('henry') || name.includes('schein');
        });

        console.log(`Found ${henryInvoices.length} Henry Schein invoices to re-redact.`);
        
        const results = [];
        
        // Process in batches of 5 to avoid timeouts but speed up processing
        const batchSize = 5;
        for (let i = 0; i < henryInvoices.length; i += batchSize) {
            const batch = henryInvoices.slice(i, i + batchSize);
            const batchPromises = batch.map(async (invoice) => {
                try {
                    const res = await base44.asServiceRole.functions.invoke('redactInvoice', { invoice_id: invoice.id });
                    return { 
                        id: invoice.id, 
                        number: invoice.invoice_number, 
                        status: 'processed',
                        result: res.data 
                    };
                } catch (err) {
                    console.error(`Failed to redact ${invoice.id}:`, err);
                    return { 
                        id: invoice.id, 
                        number: invoice.invoice_number, 
                        status: 'error',
                        error: err.message 
                    };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return Response.json({ 
            success: true, 
            count: results.length,
            details: results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});