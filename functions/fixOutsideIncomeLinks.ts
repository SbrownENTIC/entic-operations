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
        let incomeErrors = [];
        let invoiceUpdates = 0;
        let invoiceErrors = [];
        
        console.log(`Processing ${invoices.length} invoices and ${incomes.length} income records`);
        
        // STEP 1: Use Invoice.outside_income_ids as the source of truth
        // Update OutsideIncome.invoice_id to match
        for (const invoice of invoices) {
            if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
                console.log(`Processing invoice ${invoice.invoice_number || invoice.id} with ${invoice.outside_income_ids.length} income IDs`);
                
                for (const incomeId of invoice.outside_income_ids) {
                    const income = incomes.find(inc => inc.id === incomeId);
                    
                    if (!income) {
                        incomeErrors.push(`Income ${incomeId} not found (invoice ${invoice.invoice_number})`);
                        continue;
                    }
                    
                    // Update if invoice_id is different OR null
                    if (income.invoice_id !== invoice.id) {
                        try {
                            await base44.asServiceRole.entities.OutsideIncome.update(incomeId, {
                                invoice_id: invoice.id,
                                invoice_month: invoice.month || income.invoice_month || '',
                                status: 'invoiced'
                            });
                            incomeUpdates++;
                            console.log(`Updated income ${incomeId} to link to invoice ${invoice.id}`);
                        } catch (error) {
                            incomeErrors.push(`Error updating income ${incomeId}: ${error.message}`);
                        }
                    }
                }
            }
        }
        
        // STEP 2: Build reverse map - which incomes belong to which invoices
        // This rebuilds Invoice.outside_income_ids arrays based on OutsideIncome.invoice_id
        const invoiceToIncomesMap = {};
        for (const income of incomes) {
            if (income.invoice_id) {
                if (!invoiceToIncomesMap[income.invoice_id]) {
                    invoiceToIncomesMap[income.invoice_id] = [];
                }
                invoiceToIncomesMap[income.invoice_id].push(income.id);
            }
        }
        
        // Update invoices if their arrays are missing income IDs
        for (const invoice of invoices) {
            const correctIncomeIds = invoiceToIncomesMap[invoice.id] || [];
            const currentIncomeIds = invoice.outside_income_ids || [];
            
            const correctSorted = correctIncomeIds.map(id => String(id)).sort();
            const currentSorted = currentIncomeIds.map(id => String(id)).sort();
            
            const needsUpdate = correctSorted.length !== currentSorted.length ||
                               correctSorted.some((id, idx) => id !== currentSorted[idx]);
            
            if (needsUpdate && correctIncomeIds.length > 0) {
                try {
                    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                        outside_income_ids: correctIncomeIds
                    });
                    invoiceUpdates++;
                    console.log(`Updated invoice ${invoice.invoice_number || invoice.id} with ${correctIncomeIds.length} income IDs`);
                } catch (error) {
                    invoiceErrors.push(`Error updating invoice ${invoice.invoice_number || invoice.id}: ${error.message}`);
                }
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Fixed ${incomeUpdates} outside income records and ${invoiceUpdates} invoices. Now ${incomes.filter(i => i.invoice_id).length} incomes are linked.`,
            incomeUpdates,
            invoiceUpdates,
            totalInvoices: invoices.length,
            totalIncomes: incomes.length,
            linkedIncomesAfter: incomes.filter(i => i.invoice_id).length,
            invoicesWithIncomes: invoices.filter(inv => inv.outside_income_ids?.length > 0).length,
            incomeErrors: incomeErrors.length > 0 ? incomeErrors.slice(0, 5) : undefined,
            invoiceErrors: invoiceErrors.length > 0 ? invoiceErrors.slice(0, 5) : undefined
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