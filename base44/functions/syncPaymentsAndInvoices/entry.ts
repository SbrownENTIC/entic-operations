import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all payments and invoices
    const payments = await base44.asServiceRole.entities.Payment.list();
    const invoices = await base44.asServiceRole.entities.Invoice.list();
    
    // Calculate total received per invoice from payment allocations
    const invoiceTotals = {};
    for (const payment of payments) {
      if (payment.allocations) {
        for (const allocation of payment.allocations) {
          if (allocation.invoice_id) {
            invoiceTotals[allocation.invoice_id] = (invoiceTotals[allocation.invoice_id] || 0) + (allocation.amount || 0);
          }
        }
      }
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Update each invoice with calculated amount_received and status
    for (const invoice of invoices) {
      const amountReceived = invoiceTotals[invoice.id] || 0;
      const amountExpected = invoice.amount_expected || invoice.total || 0;
      const balance = amountExpected - amountReceived;
      
      // Determine status based on payment
      let newStatus = invoice.status;
      if (balance <= 0 && amountReceived > 0) {
        newStatus = 'paid_to_entic';
      } else if (amountReceived > 0 && balance > 0) {
        newStatus = 'partial';
      }
      
      // Only update if amount_received or status has changed
      // NEVER update amount_expected - that's set manually by the user
      if (invoice.amount_received !== amountReceived || invoice.status !== newStatus) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          amount_received: amountReceived,
          status: newStatus
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
    
    return Response.json({
      success: true,
      message: `Sync complete: ${updatedCount} invoices updated, ${skippedCount} skipped (no changes).`,
      updatedCount,
      skippedCount
    });
    
  } catch (error) {
    console.error('Error syncing payments and invoices:', error);
    return Response.json({ 
      error: error.message || 'An error occurred during sync'
    }, { status: 500 });
  }
});