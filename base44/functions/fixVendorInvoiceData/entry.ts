import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all invoices and supply orders
        const [invoices, supplyOrders] = await Promise.all([
            base44.asServiceRole.entities.VendorInvoice.list(null, 1000),
            base44.asServiceRole.entities.SupplyOrder.list(null, 1000)
        ]);

        // Create a map of SupplyOrder ID -> Location
        const orderLocationMap = new Map();
        supplyOrders.forEach(order => {
            if (order.id && order.location) {
                orderLocationMap.set(order.id, order.location);
            }
        });

        let updatedCount = 0;
        const updatesLog = [];

        // Helper to Title Case
        const toTitleCase = (str) => {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => {
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
                if (current !== fixed) {
                    updates.vendor_name = fixed;
                    needsUpdate = true;
                }
            }

            // 2. Link Location (if missing)
            if (!inv.location) {
                let foundLoc = null;

                // Priority 1: Check Linked Supply Orders (Most reliable)
                if (inv.linked_supply_order_ids && inv.linked_supply_order_ids.length > 0) {
                    for (const orderId of inv.linked_supply_order_ids) {
                        const loc = orderLocationMap.get(orderId);
                        if (loc) {
                            foundLoc = loc;
                            break;
                        }
                    }
                }

                // Priority 2: Scan Extracted Data
                if (!foundLoc) {
                    const dataStr = JSON.stringify(inv.extracted_data || {}).toLowerCase();
                    if (dataStr.includes('glastonbury')) foundLoc = 'Glastonbury';
                    else if (dataStr.includes('manchester')) foundLoc = 'Manchester';
                    else if (dataStr.includes('bloomfield')) foundLoc = 'Bloomfield';
                    else if (dataStr.includes('farmington')) foundLoc = 'Farmington';
                }

                if (foundLoc) {
                    updates.location = foundLoc;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await base44.asServiceRole.entities.VendorInvoice.update(inv.id, updates);
                updatedCount++;
                updatesLog.push({ 
                    id: inv.id, 
                    vendor: updates.vendor_name || inv.vendor_name, 
                    location: updates.location || 'still_missing' 
                });
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