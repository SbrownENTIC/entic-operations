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

    // Debug: Log first payment to see structure
    if (payments.length > 0 && payments[0].allocations && payments[0].allocations.length > 0) {
      console.log('Sample allocation structure:', JSON.stringify(payments[0].allocations[0], null, 2));
    }

    // Debug: Log some invoice numbers to see format
    console.log('Sample invoice numbers:', invoices.slice(0, 5).map(inv => inv.invoice_number));

    let fixedCount = 0;
    let skippedCount = 0;
    let needsFixCount = 0;
    const fixedAllocations = [];
    const unfixedAllocations = [];
    const updates = [];

    // Process each payment
    for (const payment of payments) {
      if (!payment.allocations || payment.allocations.length === 0) {
        console.log(`Payment ${payment.id} has no allocations, skipping`);
        continue;
      }

      console.log(`\nProcessing payment ${payment.id} (${payment.reference_number}) with ${payment.allocations.length} allocations`);

      let allocationFixed = false;
      const updatedAllocations = payment.allocations.map((allocation, idx) => {
        console.log(`  Allocation ${idx}: invoice_id=${allocation.invoice_id}, provider_id=${allocation.provider_id}, notes=${allocation.notes}`);
        
        // Skip if allocation already has both invoice_id and provider_id
        if (allocation.invoice_id && allocation.provider_id) {
          console.log(`    -> Already has both IDs, skipping`);
          skippedCount++;
          return allocation;
        }

        needsFixCount++;
        console.log(`    -> Needs fixing, looking for match...`);

        // Try to find invoice by matching notes field with invoice number
        let invoice = null;
        if (allocation.notes) {
          const notesLower = allocation.notes.toLowerCase().trim();
          console.log(`    -> Searching for invoice with number: "${notesLower}"`);
          
          // Try exact match first
          invoice = invoices.find(inv => 
            inv.invoice_number && inv.invoice_number.toLowerCase().trim() === notesLower
          );
          
          // If not found, try partial match
          if (!invoice) {
            console.log(`    -> Exact match not found, trying partial match...`);
            invoice = invoices.find(inv => 
              inv.invoice_number && 
              (inv.invoice_number.toLowerCase().includes(notesLower) || 
               notesLower.includes(inv.invoice_number.toLowerCase()))
            );
          }
        } else {
          console.log(`    -> No notes field, cannot match`);
        }

        // If invoice found, update the allocation
        if (invoice) {
          console.log(`    -> MATCH FOUND! Invoice: ${invoice.invoice_number} (${invoice.id})`);
          allocationFixed = true;
          fixedCount++;
          
          const providerName = providers.find(p => p.id === invoice.staff_member_id)?.full_name || 'Unknown';
          
          const fixedAllocation = {
            ...allocation,
            invoice_id: invoice.id,
            provider_id: invoice.staff_member_id || allocation.provider_id
          };
          
          fixedAllocations.push({
            paymentId: payment.id,
            paymentRef: payment.reference_number,
            invoiceNumber: invoice.invoice_number,
            providerName: providerName,
            amount: allocation.amount
          });
          
          return fixedAllocation;
        }

        console.log(`    -> NO MATCH found for notes: "${allocation.notes}"`);
        unfixedAllocations.push({
          paymentRef: payment.reference_number,
          notes: allocation.notes,
          amount: allocation.amount
        });
        
        return allocation;
      });

      // If any allocation was fixed, update the payment
      if (allocationFixed) {
        console.log(`  -> Payment has fixes, will update`);
        
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
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total allocations needing fix: ${needsFixCount}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Already correct (skipped): ${skippedCount}`);
    console.log(`Could not fix: ${unfixedAllocations.length}`);
    console.log(`Payments to update: ${updates.length}`);
    
    if (updates.length > 0) {
      console.log('Executing updates...');
      await Promise.all(updates);
      console.log('Updates complete!');
    }

    return Response.json({
      success: true,
      message: `Fixed ${fixedCount} allocations in ${updates.length} payments`,
      fixedCount,
      skippedCount,
      needsFixCount,
      paymentsUpdated: updates.length,
      fixedAllocations,
      unfixedAllocations: unfixedAllocations.length > 0 ? unfixedAllocations : null
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