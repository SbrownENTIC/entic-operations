import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
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
        
        // For each invoice, update the associated outside income records
        for (const invoice of invoices) {
            if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0 && invoice.month) {
                for (const incomeId of invoice.outside_income_ids) {
                    try {
                        await base44.asServiceRole.entities.OutsideIncome.update(incomeId, {
                            invoice_month: invoice.month
                        });
                        updatedCount++;
                    } catch (error) {
                        console.error(`Failed to update income ${incomeId}:`, error.message);
                        skippedCount++;
                    }
                }
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updatedCount} outside income records with invoice months. Skipped ${skippedCount} records.`,
            updatedCount,
            skippedCount
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});