import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all payments and invoices
    const payments = await base44.asServiceRole.entities.Payment.list();
    const invoices = await base44.asServiceRole.entities.Invoice.list();
    
    // Create a map of invoice totals from all payment allocations
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
    
    // Update each invoice with the correct amount_received and status
    for (const invoice of invoices) {
      const amountReceived = invoiceTotals[invoice.id] || 0;
      const balance = (invoice.amount_expected || invoice.total || 0) - amountReceived;
      
      // Determine status based on payment
      let newStatus = invoice.status;
      
      // If fully paid (balance <= 0 and we received something)
      if (balance <= 0 && amountReceived > 0) {
        newStatus = 'paid_to_entic';
      } 
      // If partially paid (received something but balance remains)
      else if (amountReceived > 0 && balance > 0) {
        newStatus = 'partial';
      }
      // If no payment received and currently marked as paid_to_entic or partial, revert to previous status
      else if (amountReceived === 0 && (invoice.status === 'paid_to_entic' || invoice.status === 'partial')) {
        // Check if it was sent to vendor
        if (invoice.invoice_sent_to_vendor) {
          newStatus = 'sent_to_vendor';
        } else if (invoice.invoice_sent_for_approval) {
          newStatus = 'sent_for_approval';
        } else {
          newStatus = 'draft';
        }
      }
      
      // Only update if values changed
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
      message: `Synchronized payments and invoices. Updated ${updatedCount} invoices, skipped ${skippedCount} (already correct).`,
      updatedCount,
      skippedCount,
      totalInvoices: invoices.length
    });
    
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});