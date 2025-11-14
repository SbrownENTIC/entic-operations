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
        
        let invoiceUpdates = 0;
        let errors = [];
        
        // Build a map: invoice_id -> [income_ids that belong to it]
        const invoiceToIncomesMap = {};
        
        // Use the invoice_id field on OutsideIncome as the source of truth
        for (const income of incomes) {
            if (income.invoice_id) {
                if (!invoiceToIncomesMap[income.invoice_id]) {
                    invoiceToIncomesMap[income.invoice_id] = [];
                }
                invoiceToIncomesMap[income.invoice_id].push(income.id);
            }
        }
        
        // Update each invoice's outside_income_ids array based on the map
        for (const invoice of invoices) {
            try {
                const correctIncomeIds = invoiceToIncomesMap[invoice.id] || [];
                const currentIncomeIds = invoice.outside_income_ids || [];
                
                // Convert to strings and sort for comparison
                const correctSorted = correctIncomeIds.map(id => String(id)).sort();
                const currentSorted = currentIncomeIds.map(id => String(id)).sort();
                
                // Check if they're different
                const needsUpdate = correctSorted.length !== currentSorted.length ||
                                   correctSorted.some((id, idx) => id !== currentSorted[idx]);
                
                if (needsUpdate) {
                    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                        outside_income_ids: correctIncomeIds
                    });
                    invoiceUpdates++;
                }
            } catch (error) {
                errors.push(`Invoice ${invoice.invoice_number || invoice.id}: ${error.message}`);
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Fixed ${invoiceUpdates} invoices. Total incomes with invoice_id: ${incomes.filter(i => i.invoice_id).length}/${incomes.length}`,
            invoiceUpdates,
            totalIncomesWithInvoiceId: incomes.filter(i => i.invoice_id).length,
            totalInvoices: invoices.length,
            totalIncomes: incomes.length,
            errors: errors.length > 0 ? errors : undefined
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