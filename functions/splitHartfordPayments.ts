import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all invoices and payments
    const allInvoices = await base44.asServiceRole.entities.Invoice.list();
    const allPayments = await base44.asServiceRole.entities.Payment.list();

    let updated = 0;
    let adjusted = 0;

    // Find all Hartford Hospital RVU invoices (non-Directorship)
    const hhRvuInvoices = allInvoices.filter(inv => 
      inv.program_group === 'Hartford Hospital' && 
      !inv.invoice_number?.includes('Directorship')
    );

    for (const rvuInvoice of hhRvuInvoices) {
      // Find corresponding directorship invoice
      const directorshipInvoice = allInvoices.find(inv => 
        inv.invoice_number === `${rvuInvoice.invoice_number} (Directorship)`
      );

      if (!directorshipInvoice) continue;

      // Reduce RVU invoice amounts by $3,250
      const newTotal = (rvuInvoice.total || 0) - 3250;
      const newExpected = (rvuInvoice.amount_expected || 0) - 3250;
      const newSubtotal = (rvuInvoice.subtotal || 0) - 3250;

      await base44.asServiceRole.entities.Invoice.update(rvuInvoice.id, {
        total: Math.max(0, newTotal),
        amount_expected: Math.max(0, newExpected),
        subtotal: Math.max(0, newSubtotal)
      });

      updated++;

      // Find payments allocated to this RVU invoice
      for (const payment of allPayments) {
        if (!payment.allocations || payment.allocations.length === 0) continue;

        let modified = false;
        const updatedAllocations = payment.allocations.map(alloc => {
          if (alloc.invoice_id === rvuInvoice.id && alloc.amount >= 3250) {
            // Split $3,250 to directorship
            modified = true;
            return {
              ...alloc,
              amount: alloc.amount - 3250
            };
          }
          return alloc;
        });

        if (modified) {
          // Add allocation to directorship invoice
          updatedAllocations.push({
            invoice_id: directorshipInvoice.id,
            provider_id: directorshipInvoice.staff_member_id,
            amount: 3250,
            notes: 'Auto-split from combined Hartford Hospital payment'
          });

          await base44.asServiceRole.entities.Payment.update(payment.id, {
            allocations: updatedAllocations
          });

          adjusted++;
        }
      }

      // Update directorship invoice amount_received
      const directorshipAllocations = allPayments.flatMap(p => 
        (p.allocations || []).filter(a => a.invoice_id === directorshipInvoice.id)
      );
      const totalDirectorshipReceived = directorshipAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);

      await base44.asServiceRole.entities.Invoice.update(directorshipInvoice.id, {
        amount_received: totalDirectorshipReceived
      });
    }

    // Recalculate amount_received for all RVU invoices
    for (const rvuInvoice of hhRvuInvoices) {
      const rvuAllocations = allPayments.flatMap(p => 
        (p.allocations || []).filter(a => a.invoice_id === rvuInvoice.id)
      );
      const totalRvuReceived = rvuAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);

      await base44.asServiceRole.entities.Invoice.update(rvuInvoice.id, {
        amount_received: totalRvuReceived
      });
    }

    return Response.json({
      success: true,
      message: `Split Hartford Hospital payments: ${updated} invoices updated, ${adjusted} payments adjusted`,
      details: {
        updated,
        adjusted
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});