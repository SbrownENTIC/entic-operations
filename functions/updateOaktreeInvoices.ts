import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Use service role to ensure we can update all records
        const allInvoices = await base44.asServiceRole.entities.VendorInvoice.list(null, 1000);
        
        const updates = [];
        let updatedCount = 0;
        
        for (const invoice of allInvoices) {
            // Check if it's an Oaktree invoice
            if (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes("oaktree")) {
                if (invoice.billed_to !== "The Hearing Institute") {
                     updates.push(base44.asServiceRole.entities.VendorInvoice.update(invoice.id, {
                        billed_to: "The Hearing Institute"
                    }));
                    updatedCount++;
                }
            }
        }
        
        await Promise.all(updates);
        
        return Response.json({ 
            success: true, 
            message: `Scanned ${allInvoices.length} invoices. Updated ${updatedCount} Oaktree invoices to 'The Hearing Institute'.` 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});