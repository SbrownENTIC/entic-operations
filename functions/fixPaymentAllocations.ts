import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Fetching payments, invoices, and providers...');
    
    // Fetch all necessary data
    const payments = await base44.entities.Payment.list();
    const invoices = await base44.entities.Invoice.list();
    const providers = await base44.entities.Provider.list();
    
    console.log(`Found ${payments.length} payments, ${invoices.length} invoices, ${providers.length} providers`);

    let fixedCount = 0;
    let skippedCount = 0;
    const fixedAllocations = [];
    const updates = [];

    // Process each payment
    for (const payment of payments) {
      if (!payment.allocations || payment.allocations.length === 0) {
        continue;
      }

      let allocationFixed = false;
      const updatedAllocations = payment.allocations.map(allocation => {
        // Skip if allocation already has both invoice_id and provider_id
        if (allocation.invoice_id && allocation.provider_id) {
          skippedCount++;
          return allocation;
        }

        // Try to find invoice by matching notes field with invoice number
        let invoice = null;
        if (allocation.notes) {
          // Try exact match first
          invoice = invoices.find(inv => 
            inv.invoice_number && inv.invoice_number.toLowerCase() === allocation.notes.toLowerCase()
          );
          
          // If not found, try partial match
          if (!invoice) {
            invoice = invoices.find(inv => 
              inv.invoice_number && 
              (inv.invoice_number.includes(allocation.notes) || allocation.notes.includes(inv.invoice_number))
            );
          }
        }

        // If invoice found, update the allocation
        if (invoice) {
          allocationFixed = true;
          fixedCount++;
          
          const fixedAllocation = {
            ...allocation,
            invoice_id: invoice.id,
            provider_id: invoice.staff_member_id || allocation.provider_id
          };
          
          fixedAllocations.push({
            paymentId: payment.id,
            paymentRef: payment.reference_number,
            invoiceNumber: invoice.invoice_number,
            providerName: providers.find(p => p.id === fixedAllocation.provider_id)?.full_name || 'Unknown',
            amount: allocation.amount
          });
          
          console.log(`Fixed allocation: ${payment.reference_number} -> ${invoice.invoice_number} (${allocation.amount})`);
          
          return fixedAllocation;
        }

        console.log(`Could not fix allocation in payment ${payment.reference_number} with notes: ${allocation.notes}`);
        skippedCount++;
        return allocation;
      });

      // If any allocation was fixed, update the payment
      if (allocationFixed) {
        // Recalculate payment month
        const months = new Set();
        updatedAllocations.forEach(allocation => {
          if (allocation.invoice_id) {
            const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
            if (invoice && invoice.month) {
              months.add(invoice.month);
            }
          }
        });
        const paymentMonth = Array.from(months).sort().join(', ');

        updates.push(
          base44.entities.Payment.update(payment.id, {
            allocations: updatedAllocations,
            payment_month: paymentMonth
          })
        );
      }
    }

    // Execute all updates
    console.log(`Executing ${updates.length} payment updates...`);
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    console.log('Updates complete!');

    return Response.json({
      success: true,
      message: `Fixed ${fixedCount} allocations in ${updates.length} payments`,
      fixedCount,
      skippedCount,
      paymentsUpdated: updates.length,
      fixedAllocations
    });

  } catch (error) {
    console.error('Error fixing payment allocations:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'An error occurred while fixing payment allocations',
      details: error.stack
    }, { status: 500 });
  }
});