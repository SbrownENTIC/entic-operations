import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user first
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use service role to ensure we can update all records
        // Using undefined for sort to use default, fetching up to 1000 records
        const allInvoices = await base44.asServiceRole.entities.VendorInvoice.list(undefined, 1000);
        
        const updates = [];
        let updatedCount = 0;
        
        for (const invoice of allInvoices) {
            // Check if it's an Oaktree invoice (case insensitive)
            if (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes("oaktree")) {
                if (invoice.billed_to !== "The Hearing Institute") {
                     updates.push(base44.asServiceRole.entities.VendorInvoice.update(invoice.id, {
                        billed_to: "The Hearing Institute"
                    }));
                    updatedCount++;
                }
            }
        }
        
        if (updates.length > 0) {
            await Promise.all(updates);
        }
        
        return Response.json({ 
            success: true, 
            message: `Scanned ${allInvoices.length} invoices. Updated ${updatedCount} Oaktree invoices to 'The Hearing Institute'.` 
        });

    } catch (error) {
        console.error("Update Error:", error);
        return Response.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
    }
});