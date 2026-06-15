import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Derive invoice status from payment allocations, aligned with Payments.jsx updateInvoiceStatuses.
 * Priority: manual_status_override (blocks except paid_to_entic) → provider_paid flag → allocation math.
 */
function deriveInvoiceStatus(invoice, amountReceived) {
  const amountExpected = invoice.amount_expected || invoice.total || 0;
  const balance = amountExpected - amountReceived;

  let potentialStatus = invoice.status;

  if (invoice.provider_paid) {
    potentialStatus = 'provider_paid';
  } else if (balance <= 0.01 && amountReceived > 0) {
    potentialStatus = 'paid_to_entic';
  } else if (amountReceived > 0 && balance > 0.01) {
    potentialStatus = 'partial';
  } else if (amountReceived === 0) {
    if (['paid_to_entic', 'provider_paid', 'partial'].includes(invoice.status)) {
      if (invoice.invoice_sent_to_vendor) {
        potentialStatus = 'sent_to_vendor';
      } else if (invoice.invoice_sent_for_approval) {
        potentialStatus = 'sent_for_approval';
      } else {
        potentialStatus = 'draft';
      }
    }
  }

  if (potentialStatus === 'pending') {
    if (invoice.invoice_sent_to_vendor) {
      potentialStatus = 'sent_to_vendor';
    } else if (invoice.invoice_sent_for_approval) {
      potentialStatus = 'sent_for_approval';
    } else {
      potentialStatus = 'pending_providers_approval';
    }
  }

  if (amountReceived === 0 && !invoice.provider_paid) {
    if (invoice.invoice_sent_to_vendor && potentialStatus !== 'sent_to_vendor') {
      potentialStatus = 'sent_to_vendor';
    } else if (
      invoice.invoice_sent_for_approval &&
      potentialStatus !== 'sent_for_approval' &&
      !invoice.invoice_sent_to_vendor
    ) {
      potentialStatus = 'sent_for_approval';
    }
  }

  let newStatus = invoice.status;
  if (!invoice.manual_status_override || potentialStatus === 'paid_to_entic') {
    newStatus = potentialStatus;
  }

  return newStatus;
}

/**
 * Paginate through all entity records via list(), avoiding Base44 default page limits.
 * Uses skip += batch.length so partial API page sizes still advance correctly.
 */
async function fetchAllEntityRecords(
  entity: { list: (sort?: string, limit?: number, skip?: number) => Promise<unknown[]> },
  sort?: string
) {
  const allRows: unknown[] = [];
  const batchSize = 5000;
  let skip = 0;

  while (true) {
    const batch = await entity.list(sort, batchSize, skip);
    if (!batch || batch.length === 0) break;

    allRows.push(...batch);
    skip += batch.length;
  }

  return allRows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all payments and invoices
    const payments = await fetchAllEntityRecords(base44.asServiceRole.entities.Payment);
    const invoices = await fetchAllEntityRecords(base44.asServiceRole.entities.Invoice);
    
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
      const newStatus = deriveInvoiceStatus(invoice, amountReceived);
      
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
