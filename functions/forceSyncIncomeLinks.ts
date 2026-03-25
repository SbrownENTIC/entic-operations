import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        let fixed = 0;
        let errors = [];
        
        console.log(`Starting force sync: ${invoices.length} invoices, ${incomes.length} incomes`);
        
        // Step 1: Clear ALL invoice_id references from incomes first
        for (const income of incomes) {
            if (income.invoice_id) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    invoice_id: null,
                    invoice_month: null,
                    status: 'pending'
                });
                console.log(`Cleared invoice_id from income ${income.id}`);
            }
        }
        
        // Step 2: For each invoice, set invoice_id on all incomes in its array
        for (const invoice of invoices) {
            const incomeIds = invoice.outside_income_ids || [];
            
            if (incomeIds.length === 0) continue;
            
            console.log(`Processing invoice ${invoice.invoice_number || invoice.id} with ${incomeIds.length} income IDs`);
            
            for (const incomeId of incomeIds) {
                const income = incomes.find(inc => inc.id === incomeId);
                
                if (!income) {
                    errors.push(`Income ${incomeId} not found (referenced by invoice ${invoice.invoice_number || invoice.id})`);
                    continue;
                }
                
                try {
                    await base44.asServiceRole.entities.OutsideIncome.update(incomeId, {
                        invoice_id: invoice.id,
                        invoice_month: invoice.month || '',
                        status: 'invoiced'
                    });
                    fixed++;
                    console.log(`✓ Linked income ${incomeId} to invoice ${invoice.invoice_number || invoice.id}`);
                } catch (error) {
                    errors.push(`Failed to update income ${incomeId}: ${error.message}`);
                    console.error(`Error updating income ${incomeId}:`, error);
                }
            }
            
            // Recalculate invoice totals
            const linkedIncomes = incomes.filter(inc => incomeIds.includes(inc.id));
            const calculatedTotal = linkedIncomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0);
            const calculatedDays = linkedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
            
            if (Math.abs(calculatedTotal - (invoice.total || 0)) > 0.01 || calculatedDays !== invoice.days_worked) {
                await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                    total: calculatedTotal,
                    subtotal: calculatedTotal,
                    amount_expected: calculatedTotal,
                    days_worked: calculatedDays
                });
                console.log(`Updated invoice ${invoice.invoice_number || invoice.id} totals: $${calculatedTotal}, ${calculatedDays} days`);
            }
        }
        
        return Response.json({
            success: true,
            message: `Force synced ${fixed} income records. ${errors.length > 0 ? `${errors.length} errors encountered.` : 'All links fixed!'}`,
            fixed,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Force sync error:', error);
        return Response.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});