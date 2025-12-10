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