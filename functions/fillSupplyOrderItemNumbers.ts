import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user (check only, don't block service role operations)
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all supplies
    const supplies = await base44.asServiceRole.entities.Supply.list();
    
    // Fetch all supply orders
    const orders = await base44.asServiceRole.entities.SupplyOrder.list();
    
    let updatedCount = 0;
    let itemsUpdated = 0;

    // Process each order
    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;
      
      let orderUpdated = false;
      const updatedItems = order.items.map(item => {
        // Skip if item already has item_number
        if (item.item_number) return item;
        
        // Try to find matching supply by ID or name
        let supply = item.supply_id 
          ? supplies.find(s => s.id === item.supply_id)
          : null;
        
        // If not found by ID, try exact name match
        if (!supply && item.supply_name) {
          supply = supplies.find(s => s.product_name === item.supply_name);
        }
        
        // If still not found, try case-insensitive match
        if (!supply && item.supply_name) {
          const searchName = item.supply_name.toLowerCase().trim();
          supply = supplies.find(s => s.product_name?.toLowerCase().trim() === searchName);
        }
        
        // If supply found with item_number, update the item
        if (supply && supply.item_number) {
          itemsUpdated++;
          orderUpdated = true;
          return { ...item, item_number: supply.item_number };
        }
        
        return item;
      });
      
      // Update order if any items were updated
      if (orderUpdated) {
        await base44.asServiceRole.entities.SupplyOrder.update(order.id, {
          items: updatedItems
        });
        updatedCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${itemsUpdated} items across ${updatedCount} orders`,
      ordersUpdated: updatedCount,
      itemsUpdated: itemsUpdated
    });

  } catch (error) {
    console.error('Error filling item numbers:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});