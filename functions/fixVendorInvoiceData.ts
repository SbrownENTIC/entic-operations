import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all invoices (limit 1000 for now, should cover it)
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list(null, 1000);
        let updatedCount = 0;
        const updatesLog = [];

        // Helper to Title Case
        const toTitleCase = (str) => {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => {
                // Handle special cases like LLC, Inc, PO, etc if needed, or simple cap
                if (word === 'llc') return 'LLC';
                if (word === 'inc') return 'Inc';
                return word.charAt(0).toUpperCase() + word.slice(1);
            }).join(' ');
        };

        for (const inv of invoices) {
            let needsUpdate = false;
            let updates = {};

            // 1. Fix Vendor Name
            if (inv.vendor_name) {
                const current = inv.vendor_name;
                const fixed = toTitleCase(current);
                // Basic check to see if it changed (ignoring strict "LLC" logic for now to keep it simple, mostly fixing ALL CAPS)
                if (current !== fixed && current === current.toUpperCase()) {
                    updates.vendor_name = fixed;
                    needsUpdate = true;
                } else if (current !== fixed) {
                    // Apply title case generally
                     updates.vendor_name = fixed;
                     needsUpdate = true;
                }
            }

            // 2. Link Location (if missing)
            if (!inv.location) {
                // Look in extracted_data
                const dataStr = JSON.stringify(inv.extracted_data || {}).toLowerCase();
                // Also look in the vendor name itself if it contains location info? Unlikely.
                
                let foundLoc = null;
                if (dataStr.includes('glastonbury')) foundLoc = 'Glastonbury';
                else if (dataStr.includes('manchester')) foundLoc = 'Manchester';
                else if (dataStr.includes('bloomfield')) foundLoc = 'Bloomfield';
                else if (dataStr.includes('farmington')) foundLoc = 'Farmington';

                if (foundLoc) {
                    updates.location = foundLoc;
                    needsUpdate = true;
                } else {
                    // Try linked supply orders?
                    if (inv.linked_supply_order_ids && inv.linked_supply_order_ids.length > 0) {
                        // We'd have to fetch the order, which is N+1 query. 
                        // For bulk update, maybe skip or do it if we really need to.
                        // Let's keep it simple for now: regex search in extracted data.
                    }
                }
            }

            if (needsUpdate) {
                await base44.asServiceRole.entities.VendorInvoice.update(inv.id, updates);
                updatedCount++;
                updatesLog.push({ id: inv.id, old_name: inv.vendor_name, new_name: updates.vendor_name, location: updates.location });
            }
        }

        return Response.json({ 
            success: true, 
            message: `Updated ${updatedCount} invoices`, 
            details: updatesLog 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});