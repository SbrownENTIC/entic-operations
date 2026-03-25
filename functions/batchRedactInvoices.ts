import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }
        
        // 1. Fetch all invoices that haven't been redacted yet
        // Note: 'redacted' might be null for old records, so check for not true
        const allInvoices = await base44.entities.VendorInvoice.list('-created_date', 1000); 
        
        const toProcess = allInvoices.filter(inv => !inv.redacted && inv.document_url);
        
        console.log(`Found ${toProcess.length} invoices to check for redaction.`);

        // 2. Process in chunks to avoid timeouts
        // We'll trigger the individual redaction function for each
        const results = [];
        const BATCH_SIZE = 5;
        
        for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
            const batch = toProcess.slice(i, i + BATCH_SIZE);
            const promises = batch.map(inv => 
                base44.functions.invoke('redactInvoice', { invoice_id: inv.id })
                    .then(res => ({ id: inv.id, ...res.data }))
                    .catch(err => ({ id: inv.id, error: err.message }))
            );
            
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
            
            console.log(`Processed batch ${i / BATCH_SIZE + 1}`);
        }

        return Response.json({ 
            status: "completed", 
            processed: results.length, 
            details: results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});