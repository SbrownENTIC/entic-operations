import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all payments
        const payments = await base44.asServiceRole.entities.Payment.list();
        
        let updated = 0;
        let skipped = 0;

        // Update each payment with month from payment_date
        for (const payment of payments) {
            // Skip if payment_month already exists
            if (payment.payment_month) {
                skipped++;
                continue;
            }

            // Extract month and year from payment_date
            const paymentDate = new Date(payment.payment_date);
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const monthYear = `${monthNames[paymentDate.getMonth()]} ${paymentDate.getFullYear()}`;

            // Update payment with payment_month
            await base44.asServiceRole.entities.Payment.update(payment.id, {
                payment_month: monthYear
            });
            
            updated++;
        }

        return Response.json({
            success: true,
            message: `Updated ${updated} payments with payment month. Skipped ${skipped} payments that already had payment_month set.`,
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