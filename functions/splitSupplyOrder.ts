import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { order_id, item_indices, target_location } = await req.json();
        
        if (!order_id || !item_indices || !item_indices.length || !target_location) {
             return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get Original Order
        const [order] = await base44.entities.SupplyOrder.filter({ id: order_id });
        if (!order) throw new Error("Order not found");
        
        // 2. Separate Items
        const keptItems = [];
        const movedItems = [];
        
        (order.items || []).forEach((item, index) => {
            if (item_indices.includes(index)) {
                movedItems.push(item);
            } else {
                keptItems.push(item);
            }
        });
        
        if (movedItems.length === 0) throw new Error("No items selected to move");
        if (keptItems.length === 0) throw new Error("Cannot move all items. Use 'Edit' to change location instead.");

        // 3. Calculate Totals
        const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.line_total || 0), 0);
        const keptSubtotal = calculateTotal(keptItems);
        const movedSubtotal = calculateTotal(movedItems);
        
        // Simple tax splitting (proportional based on subtotal)
        const totalSubtotal = keptSubtotal + movedSubtotal;
        const originalTax = order.tax || 0;
        const keptTax = totalSubtotal > 0 ? originalTax * (keptSubtotal / totalSubtotal) : 0;
        const movedTax = originalTax - keptTax;
        
        // 4. Update Original Order
        await base44.entities.SupplyOrder.update(order.id, {
            items: keptItems,
            subtotal: keptSubtotal,
            tax: keptTax,
            total_amount: keptSubtotal + keptTax,
            updated_after_submission: true,
            notes: (order.notes || '') + `\n[Split] Moved ${movedItems.length} items to ${target_location} (New Order #${order.order_number}-${target_location})`
        });
        
        // 5. Create New Order
        const newOrderNumber = `${order.order_number}-${target_location}`;
        const newOrder = await base44.entities.SupplyOrder.create({
            ...order,
            id: undefined, // Ensure new ID
            created_date: undefined, // Let DB set this
            updated_date: undefined,
            created_by: undefined,
            
            order_number: newOrderNumber,
            location: target_location,
            items: movedItems,
            subtotal: movedSubtotal,
            tax: movedTax,
            total_amount: movedSubtotal + movedTax,
            updated_after_submission: true,
            notes: (order.notes || '') + `\n[Split] Moved from #${order.order_number} (${order.location})`,
        });
        
        // 6. Handle Vendor Invoice Linking
        // Try to find the VendorInvoice corresponding to this order
        const vendorInvoices = await base44.entities.VendorInvoice.filter({ invoice_number: order.order_number });
        const vendorInvoice = vendorInvoices[0];
        
        if (vendorInvoice) {
             // Create new Vendor Invoice for the split part
             await base44.entities.VendorInvoice.create({
                 ...vendorInvoice,
                 id: undefined,
                 created_date: undefined,
                 updated_date: undefined,
                 created_by: undefined,
                 
                 invoice_number: newOrderNumber,
                 location: target_location,
                 total_amount: movedSubtotal + movedTax,
                 linked_supply_order_ids: [newOrder.id],
                 notes: (vendorInvoice.notes || '') + `\n[Split] Generated for ${target_location} items.`
             });
             
             // Update original Vendor Invoice amount
             await base44.entities.VendorInvoice.update(vendorInvoice.id, {
                 total_amount: keptSubtotal + keptTax,
                 notes: (vendorInvoice.notes || '') + `\n[Split] Items moved to ${newOrderNumber}`
             });
        }
        
        return Response.json({ success: true, new_order_id: newOrder.id, new_order_number: newOrderNumber });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});