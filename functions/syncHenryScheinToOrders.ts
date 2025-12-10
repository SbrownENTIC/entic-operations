import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Fetch all Henry Schein invoices
        const allInvoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 1000);
        
        const henryScheinInvoices = allInvoices.filter(inv => 
            (inv.vendor_name || '').toLowerCase().includes('henry schein') &&
            (!inv.linked_supply_order_ids || inv.linked_supply_order_ids.length === 0)
        );

        console.log(`Found ${henryScheinInvoices.length} unlinked Henry Schein invoices.`);

        const results = [];
        
        // 2. Process each
        for (const inv of henryScheinInvoices) {
            try {
                // Extract items
                const supplyOrderItems = (inv.extracted_data?.line_items || []).map(item => ({
                    supply_name: item.description || 'Unknown Item',
                    item_number: item.item_code || '',
                    quantity: item.quantity || 0,
                    unit_price: item.unit_price || 0,
                    line_total: item.total_price || 0,
                    received: true
                }));

                if (supplyOrderItems.length === 0) continue;

                const orderNumber = inv.invoice_number || `AUTO-CLINICAL-${Date.now()}`;
                
                // Double check order doesn't exist by number
                const existingOrder = await base44.asServiceRole.entities.SupplyOrder.filter({ order_number: orderNumber });
                if (existingOrder && existingOrder.length > 0) continue;

                // Create Order
                const supplyOrderData = {
                    order_number: orderNumber,
                    vendor: inv.vendor_name,
                    location: inv.location || 'Glastonbury',
                    order_date: inv.invoice_date || new Date().toISOString().split('T')[0],
                    status: 'received',
                    category: 'clinical',
                    order_type: inv.invoice_type === 'credit_memo' ? 'return' : 'order',
                    items: supplyOrderItems,
                    total_amount: inv.total_amount || 0,
                    notes: `Auto-synced from Invoice #${inv.invoice_number}`
                };

                const createdOrder = await base44.asServiceRole.entities.SupplyOrder.create(supplyOrderData);
                
                // Link back
                if (createdOrder) {
                    await base44.asServiceRole.entities.VendorInvoice.update(inv.id, {
                        linked_supply_order_ids: [createdOrder.id]
                    });
                    results.push({ invoice: inv.invoice_number, order: createdOrder.order_number });
                }

            } catch (err) {
                console.error(`Failed to sync invoice ${inv.invoice_number}:`, err);
            }
        }

        return Response.json({ 
            success: true, 
            processed: results.length,
            details: results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});