import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all invoices (assuming < 1000 for now, or just get recent ones)
        // Using limit 100 which should cover the "4 test invoices"
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 100);
        
        const henryInvoices = invoices.filter(inv => {
            const name = (inv.vendor_name || '').toLowerCase();
            return name.includes('henry') || name.includes('schein');
        });

        console.log(`Found ${henryInvoices.length} Henry Schein invoices to re-redact.`);
        
        const results = [];
        
        for (const invoice of henryInvoices) {
            try {
                // Call redactInvoice for each
                // This uses the UPDATED logic in redactInvoice (0.75 cut-off)
                const res = await base44.asServiceRole.functions.invoke('redactInvoice', { invoice_id: invoice.id });
                results.push({ 
                    id: invoice.id, 
                    number: invoice.invoice_number, 
                    status: 'processed',
                    result: res.data 
                });
            } catch (err) {
                console.error(`Failed to redact ${invoice.id}:`, err);
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
            count: results.length,
            details: results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});