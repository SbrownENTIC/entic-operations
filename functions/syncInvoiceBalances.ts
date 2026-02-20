import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { logSystemEvent } from "./utils/systemLogger.js";

Deno.serve(async (req) => {
  try {
    await logSystemEvent("syncInvoiceBalances", "START");
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all invoices
    const invoices = await base44.asServiceRole.entities.Invoice.list();
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Update each invoice
    for (const invoice of invoices) {
      // If amount_expected is not set or is 0, set it to total
      if (!invoice.amount_expected || invoice.amount_expected === 0) {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          amount_expected: invoice.total || 0
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
    
    return Response.json({
      success: true,
      message: `Sync complete: ${updatedCount} invoices updated, ${skippedCount} already had amount_expected set.`,
      updatedCount,
      skippedCount
    });
    
  } catch (error) {
    console.error('Error syncing invoice balances:', error);
    return Response.json({ 
      error: error.message || 'An error occurred during sync'
    }, { status: 500 });
  }
});