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
        
        let incomeUpdates = 0;
        let errors = [];
        
        // Use Invoice.outside_income_ids as the source of truth
        // Update OutsideIncome.invoice_id to match
        for (const invoice of invoices) {
            if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
                for (const incomeId of invoice.outside_income_ids) {
                    try {
                        const income = incomes.find(inc => inc.id === incomeId);
                        
                        if (!income) {
                            errors.push(`Income ${incomeId} not found (referenced by invoice ${invoice.invoice_number || invoice.id})`);
                            continue;
                        }
                        
                        // Only update if the invoice_id is different
                        if (income.invoice_id !== invoice.id) {
                            await base44.asServiceRole.entities.OutsideIncome.update(incomeId, {
                                invoice_id: invoice.id,
                                invoice_month: invoice.month || income.invoice_month || '',
                                status: 'invoiced'
                            });
                            incomeUpdates++;
                        }
                    } catch (error) {
                        errors.push(`Error updating income ${incomeId}: ${error.message}`);
                    }
                }
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Fixed ${incomeUpdates} outside income records based on Invoice.outside_income_ids arrays.`,
            incomeUpdates,
            totalInvoices: invoices.length,
            totalIncomes: incomes.length,
            invoicesWithIncomes: invoices.filter(inv => inv.outside_income_ids?.length > 0).length,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined
        });
        
    } catch (error) {
        console.error('Fix function error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});