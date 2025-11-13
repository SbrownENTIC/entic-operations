import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reference_pattern } = await req.json();
    
    if (!reference_pattern) {
      return Response.json({ error: 'reference_pattern is required' }, { status: 400 });
    }

    console.log(`Looking for payments with reference containing: ${reference_pattern}`);
    
    // Fetch all payments
    const allPayments = await base44.entities.Payment.list();
    
    // Find payments that match the pattern
    const matchingPayments = allPayments.filter(payment => 
      payment.reference_number && 
      payment.reference_number.toLowerCase().includes(reference_pattern.toLowerCase())
    );
    
    console.log(`Found ${matchingPayments.length} matching payments`);
    
    if (matchingPayments.length === 0) {
      return Response.json({
        success: false,
        message: `No payments found with reference containing "${reference_pattern}"`,
        allReferences: allPayments.map(p => p.reference_number).filter(r => r).slice(0, 20)
      });
    }

    const results = [];
    
    for (const payment of matchingPayments) {
      console.log(`\nProcessing payment: ${payment.reference_number}`);
      console.log(`  Total amount: ${payment.total_amount}`);
      console.log(`  Allocations: ${payment.allocations?.length || 0}`);
      
      // Calculate total allocated
      const totalAllocated = payment.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = payment.total_amount - totalAllocated;
      
      console.log(`  Total allocated: ${totalAllocated}`);
      console.log(`  Unallocated: ${unallocated}`);
      console.log(`  Current unallocated_amount field: ${payment.unallocated_amount}`);
      
      // Determine correct status
      let status = payment.status;
      if (unallocated === 0 && totalAllocated > 0) {
        status = 'cleared';
      } else if (unallocated > 0) {
        status = 'pending';
      }
      
      // Check if update is needed
      const needsUpdate = 
        payment.unallocated_amount !== unallocated || 
        payment.status !== status;
      
      if (needsUpdate) {
        console.log(`  -> Updating payment: unallocated ${payment.unallocated_amount} -> ${unallocated}, status ${payment.status} -> ${status}`);
        
        await base44.entities.Payment.update(payment.id, {
          unallocated_amount: unallocated,
          status: status
        });
        
        results.push({
          payment_id: payment.id,
          reference: payment.reference_number,
          old_unallocated: payment.unallocated_amount,
          new_unallocated: unallocated,
          old_status: payment.status,
          new_status: status,
          updated: true
        });
      } else {
        console.log(`  -> No update needed`);
        results.push({
          payment_id: payment.id,
          reference: payment.reference_number,
          unallocated: unallocated,
          status: status,
          updated: false
        });
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${results.length} payment(s)`,
      results
    });

  } catch (error) {
    console.error('Error fixing payment:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'An error occurred while fixing payment',
      details: error.stack
    }, { status: 500 });
  }
});