import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { location, requested_date, items, notes } = await req.json();

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

    // Determine status and notification
    const needsReview = flags.length > 0;
    const status = needsReview ? 'pending_review' : 'pending_fulfillment';

    // Create the supply order
    const orderData = {
      location,
      order_date: requested_date || new Date().toISOString().split('T')[0],
      status,
      vendor: analyzedItems[0]?.vendor || 'Staples',
      items: analyzedItems,
      subtotal,
      total_amount: total,
      notes,
      review_flags: flags
    };

    const order = await base44.asServiceRole.entities.SupplyOrder.create(orderData);

    // Send appropriate notification
    const recipientEmail = needsReview 
      ? Deno.env.get('APPROVAL_EMAIL') || 'hollyjo@example.com' // Holly Jo's email
      : Deno.env.get('FULFILLMENT_EMAIL') || 'purchasing@example.com'; // Purchasing manager

    let emailSubject, emailBody;

    if (needsReview) {
      emailSubject = `Supply Request Needs Review - ${location}`;
      emailBody = `
        <h2>Supply Request Flagged for Review</h2>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Requested by:</strong> ${user.full_name} (${user.email})</p>
        <p><strong>Request Date:</strong> ${requested_date}</p>
        <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        
        <h3>Flags:</h3>
        <ul>
          ${flags.map(flag => `<li><strong>${flag.item_name}:</strong> ${flag.reason}</li>`).join('')}
        </ul>
        
        <h3>Items:</h3>
        <ul>
          ${analyzedItems.map(item => 
            `<li>${item.supply_name} - Quantity: ${item.quantity} @ $${item.unit_price.toFixed(2)} = $${item.line_total.toFixed(2)}</li>`
          ).join('')}
        </ul>
        
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        
        <p>Please review and approve/reject this request in the system.</p>
      `;
    } else {
      emailSubject = `New Supply Order for Fulfillment - ${location}`;
      emailBody = `
        <h2>New Supply Order Ready for Fulfillment</h2>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Requested by:</strong> ${user.full_name} (${user.email})</p>
        <p><strong>Request Date:</strong> ${requested_date}</p>
        <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        
        <h3>Items:</h3>
        <ul>
          ${analyzedItems.map(item => 
            `<li>${item.supply_name} - Quantity: ${item.quantity} @ $${item.unit_price.toFixed(2)} = $${item.line_total.toFixed(2)}</li>`
          ).join('')}
        </ul>
        
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        
        <p>This order has been automatically approved and is ready for fulfillment.</p>
      `;
    }

    // Send email notification
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: recipientEmail,
        subject: emailSubject,
        body: emailBody
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the whole request if email fails
    }

    return Response.json({
      success: true,
      message: needsReview 
        ? 'Your request has been submitted and flagged for review. You will be notified once it has been reviewed.'
        : 'Your request has been submitted and is ready for fulfillment.',
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