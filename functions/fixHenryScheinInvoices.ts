import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch recent invoices (limit 50)
        // We'll filter client-side for "Henry Schein"
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 50);
        
        const henryInvoices = invoices.filter(inv => {
            const name = (inv.vendor_name || '').toLowerCase();
            return name.includes('henry') || name.includes('schein');
        });

        console.log(`Found ${henryInvoices.length} Henry Schein invoices to re-process.`);
        
        const results = [];
        
        for (const invoice of henryInvoices) {
            console.log(`Reprocessing invoice ${invoice.invoice_number} (${invoice.id})...`);
            try {
                // Call redactInvoice for each
                const res = await base44.asServiceRole.functions.invoke('redactInvoice', { invoice_id: invoice.id });
                results.push({ 
                    id: invoice.id, 
                    number: invoice.invoice_number, 
                    status: 'processed',
                    result: res.data 
                });
            } catch (err) {
                console.error(`Failed to reprocess ${invoice.id}:`, err);
                results.push({ 
                    id: invoice.id, 
                    number: invoice.invoice_number, 
                    status: 'error',
                    error: err.message 
                });
            }
        }

        return Response.json({ 
            success: true, 
            total_found: henryInvoices.length,
            processed: results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});