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
        let invoiceUpdates = 0;
        
        // Build a map of which incomes belong to which invoice
        const invoiceIncomeMap = {};
        
        // First pass: build map from invoice.outside_income_ids arrays
        for (const invoice of invoices) {
            if (!invoiceIncomeMap[invoice.id]) {
                invoiceIncomeMap[invoice.id] = new Set();
            }
            if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
                invoice.outside_income_ids.forEach(incomeId => {
                    invoiceIncomeMap[invoice.id].add(incomeId);
                });
            }
        }
        
        // Second pass: also check income.invoice_id field and add to map
        for (const income of incomes) {
            if (income.invoice_id) {
                if (!invoiceIncomeMap[income.invoice_id]) {
                    invoiceIncomeMap[income.invoice_id] = new Set();
                }
                invoiceIncomeMap[income.invoice_id].add(income.id);
            }
        }
        
        // Now update all invoices with their correct outside_income_ids arrays
        for (const invoice of invoices) {
            const correctIncomeIds = Array.from(invoiceIncomeMap[invoice.id] || []);
            const currentIncomeIds = invoice.outside_income_ids || [];
            
            // Check if they're different
            const needsUpdate = correctIncomeIds.length !== currentIncomeIds.length ||
                               correctIncomeIds.some(id => !currentIncomeIds.includes(id));
            
            if (needsUpdate && correctIncomeIds.length > 0) {
                await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                    outside_income_ids: correctIncomeIds
                });
                invoiceUpdates++;
            }
        }
        
        // Update all outside income records with correct invoice_id
        for (const income of incomes) {
            let correctInvoiceId = null;
            
            // Find which invoice this income belongs to
            for (const [invoiceId, incomeSet] of Object.entries(invoiceIncomeMap)) {
                if (incomeSet.has(income.id)) {
                    correctInvoiceId = invoiceId;
                    break;
                }
            }
            
            // Update if different
            if (income.invoice_id !== correctInvoiceId) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    invoice_id: correctInvoiceId
                });
                incomeUpdates++;
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Fixed invoice links: Updated ${invoiceUpdates} invoices and ${incomeUpdates} outside income records.`,
            invoiceUpdates,
            incomeUpdates
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});