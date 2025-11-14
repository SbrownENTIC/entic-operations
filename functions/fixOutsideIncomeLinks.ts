import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Fetch all invoices and outside income records
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        let updatedCount = 0;
        let clearedCount = 0;
        
        // First, clear all invoice_id fields
        for (const income of incomes) {
            if (income.invoice_id) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    invoice_id: null
                });
                clearedCount++;
            }
        }
        
        // Then, set invoice_id based on invoice's outside_income_ids
        for (const invoice of invoices) {
            if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
                for (const incomeId of invoice.outside_income_ids) {
                    const income = incomes.find(inc => inc.id === incomeId);
                    if (income) {
                        await base44.asServiceRole.entities.OutsideIncome.update(incomeId, {
                            invoice_id: invoice.id
                        });
                        updatedCount++;
                    }
                }
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Fixed invoice links: Cleared ${clearedCount} old links, set ${updatedCount} new links.`,
            clearedCount,
            updatedCount
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});