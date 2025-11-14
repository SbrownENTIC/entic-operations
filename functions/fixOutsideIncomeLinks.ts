import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Fetch all data
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
        
        let incomeUpdates = 0;
        let invoiceUpdates = 0;
        let matchesMade = 0;
        
        console.log(`Starting fix: ${invoices.length} invoices, ${incomes.length} incomes`);
        
        // Build a map of program_location_id -> program_group
        const locationToProgramGroup = {};
        programLocations.forEach(pl => {
            locationToProgramGroup[pl.id] = pl.program_group;
        });
        
        // SMART MATCHING: Match incomes to invoices based on provider, program group, and month
        for (const invoice of invoices) {
            const matchingIncomes = incomes.filter(income => {
                // Must have same provider
                if (income.provider_id !== invoice.staff_member_id) return false;
                
                // Must have same program group
                const incomeProgramGroup = locationToProgramGroup[income.program_location_id];
                if (incomeProgramGroup !== invoice.program_group) return false;
                
                // Must have same month (if both exist)
                if (invoice.month && income.invoice_month && invoice.month !== income.invoice_month) return false;
                
                return true;
            });
            
            if (matchingIncomes.length > 0) {
                console.log(`Invoice ${invoice.invoice_number || invoice.id}: found ${matchingIncomes.length} matching incomes`);
                
                // Update the invoice's outside_income_ids array
                const newIncomeIds = matchingIncomes.map(inc => inc.id);
                await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                    outside_income_ids: newIncomeIds
                });
                invoiceUpdates++;
                
                // Update each income's invoice_id
                for (const income of matchingIncomes) {
                    if (income.invoice_id !== invoice.id) {
                        await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                            invoice_id: invoice.id,
                            invoice_month: invoice.month || income.invoice_month || '',
                            status: 'invoiced'
                        });
                        incomeUpdates++;
                        matchesMade++;
                    }
                }
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Matched and linked ${matchesMade} income records to ${invoiceUpdates} invoices based on provider, program group, and month.`,
            incomeUpdates,
            invoiceUpdates,
            matchesMade,
            totalInvoices: invoices.length,
            totalIncomes: incomes.length
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