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

    const needsReview = flags.length > 0 || (notes && notes.trim().length > 0);

    // Create directly as pending_review — public submissions never stay as "open"
    const orderData = {
      location,
      order_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      status: 'pending_review',
      vendor: analyzedItems[0]?.vendor || 'Staples Business',
      items: analyzedItems,
      subtotal,
      total_amount: total,
      notes,
      review_flags: flags,
      submission_source: 'public_form'
    };

    const order = await base44.asServiceRole.entities.SupplyOrder.create(orderData);

    // Send notification email immediately on submission
    const recipientEmail = Deno.env.get('APPROVAL_EMAIL') || 'hollyjo@enticmd.com';
    const itemList = analyzedItems.map(item =>
      `<li>${item.supply_name}${item.item_number ? ` (Item# ${item.item_number})` : ''} — Qty: ${item.quantity}</li>`
    ).join('');
    const emailBody = `
      <h2>New Supply Request Submitted — ${location}</h2>
      ${needsReview ? '<p><strong style="color:orange;">⚠ This order has been flagged for review.</strong></p>' : ''}
      <h3>Items:</h3>
      <ul>${itemList}</ul>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>Please review this request in the ENTIC Operations Center.</p>
    `;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: recipientEmail,
        subject: `Supply Request Submitted — ${location}`,
        body: emailBody
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    return Response.json({
      success: true,
      message: 'Your request has been submitted successfully!',
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