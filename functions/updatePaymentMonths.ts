import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all payments and invoices
        const payments = await base44.asServiceRole.entities.Payment.list();
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        
        // Create a map of invoice IDs to months
        const invoiceMonthMap = {};
        invoices.forEach(invoice => {
            invoiceMonthMap[invoice.id] = invoice.month || '';
        });
        
        let updated = 0;
        let skipped = 0;

        // Update each payment with months from its allocations
        for (const payment of payments) {
            // Get unique months from all allocations
            const months = new Set();
            
            if (payment.allocations && payment.allocations.length > 0) {
                payment.allocations.forEach(allocation => {
                    if (allocation.invoice_id) {
                        const invoiceMonth = invoiceMonthMap[allocation.invoice_id];
                        if (invoiceMonth) {
                            months.add(invoiceMonth);
                        }
                    }
                });
            }
            
            // Create payment_month string from unique months
            const paymentMonth = Array.from(months).sort().join(', ');
            
            // Only update if payment_month has changed
            if (payment.payment_month !== paymentMonth) {
                await base44.asServiceRole.entities.Payment.update(payment.id, {
                    payment_month: paymentMonth
                });
                updated++;
            } else {
                skipped++;
            }
        }

        return Response.json({
            success: true,
            message: `Updated ${updated} payments with invoice months from allocations. Skipped ${skipped} payments that were already up to date.`,
            updated,
            skipped
        });

    } catch (error) {
        console.error('Error updating payment months:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});