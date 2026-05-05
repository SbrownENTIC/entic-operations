import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Try to get authenticated user, but allow public requests
    let user = null;
    let requesterName = '';
    let requesterEmail = '';
    
    try {
      user = await base44.auth.me();
      requesterName = user.full_name;
      requesterEmail = user.email;
    } catch (e) {
      // Public request - user not authenticated
    }

    const { location, requested_date, items, notes, requester_name, requester_email } = await req.json();
    
    // For public requests, use provided name/email
    if (!user) {
      if (!requester_name || !requester_email) {
        return Response.json({ error: 'Requester name and email are required' }, { status: 400 });
      }
      requesterName = requester_name;
      requesterEmail = requester_email;
    }

    if (!location || !items || items.length === 0) {
      return Response.json({ error: 'Location and items are required' }, { status: 400 });
    }

    // Get historical orders for this location (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const historicalOrders = await base44.asServiceRole.entities.SupplyOrder.filter({
      location: location,
      status: ['order_placed', 'partially_received', 'received']
    });

    // Analyze each item in the request
    const flags = [];
    const analyzedItems = [];

    for (const item of items) {
      const itemAnalysis = {
        ...item,
        line_total: (item.quantity || 0) * (item.unit_price || 0)
      };

      // Check if item was ever ordered before at this location
      const previousOrders = historicalOrders.filter(order => 
        order.items?.some(orderItem => orderItem.supply_id === item.supply_id)
      );

      if (previousOrders.length === 0) {
        // Never ordered before
        flags.push({
          item_name: item.supply_name,
          flag_type: 'never_ordered',
          reason: `This item has never been ordered for ${location} before`
        });
      } else {
        // Calculate average quantity ordered
        const quantities = [];
        previousOrders.forEach(order => {
          order.items?.forEach(orderItem => {
            if (orderItem.supply_id === item.supply_id) {
              quantities.push(orderItem.quantity || 0);
            }
          });
        });

        const averageQuantity = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
        const threshold = averageQuantity * 1.5; // 50% above average

        if (item.quantity > threshold) {
          flags.push({
            item_name: item.supply_name,
            flag_type: 'above_average',
            reason: `Requested quantity (${item.quantity}) is significantly higher than average (${averageQuantity.toFixed(1)})`
          });
        }
      }

      analyzedItems.push(itemAnalysis);
    }

    // Calculate totals
    const subtotal = analyzedItems.reduce((sum, item) => sum + item.line_total, 0);
    const total = subtotal;

    // Store flags for later review, but always create as 'open' draft.
    // Status transitions to 'pending_review' when the user clicks Submit on the public form.
    const needsReview = flags.length > 0 || (notes && notes.trim().length > 0);

    // Create the supply order as an open draft
    const orderData = {
      location,
      order_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      status: 'open',
      vendor: analyzedItems[0]?.vendor || 'Staples Business',
      items: analyzedItems,
      subtotal,
      total_amount: total,
      notes,
      review_flags: flags,
      submission_source: 'public_form'
    };

    const order = await base44.asServiceRole.entities.SupplyOrder.create(orderData);

    // No email sent here — email is sent when the user formally submits (open → pending_review) via updatePublicOrder

    return Response.json({
      success: true,
      message: 'Your draft has been saved. Review your items and click Submit to send the request.',
      order_id: order.id,
      needs_review: needsReview,
      flags
    });

  } catch (error) {
    console.error('Error processing supply request:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});