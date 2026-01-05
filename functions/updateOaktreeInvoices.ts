import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Use service role to ensure we can update all records
        const allInvoices = await base44.asServiceRole.entities.VendorInvoice.list(null, 1000);
        
        const updates = [];
        
        for (const invoice of allInvoices) {
            let billedTo = "ENTIC";
            
            // Check if it's an Oaktree invoice
            if (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes("oaktree")) {
                billedTo = "The Hearing Institute";
            }
            
            // Only update if it's different or missing
            if (invoice.billed_to !== billedTo) {
                updates.push(base44.asServiceRole.entities.VendorInvoice.update(invoice.id, {
                    billed_to: billedTo
                }));
            }
        }
        
        await Promise.all(updates);
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updates.length} invoices out of ${allInvoices.length} total.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});