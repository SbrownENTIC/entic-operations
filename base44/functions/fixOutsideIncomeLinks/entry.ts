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
        let skipped = 0;
        
        console.log(`Starting fix: ${invoices.length} invoices, ${incomes.length} incomes`);
        
        // Build a map of program_location_id -> program_group
        const locationToProgramGroup = {};
        programLocations.forEach(pl => {
            locationToProgramGroup[pl.id] = pl.program_group;
        });
        
        // First, clear all invoice links from incomes that are NOT in their invoice's outside_income_ids
        for (const income of incomes) {
            if (income.invoice_id) {
                const invoice = invoices.find(inv => inv.id === income.invoice_id);
                if (invoice) {
                    const isInInvoiceArray = invoice.outside_income_ids?.includes(income.id);
                    if (!isInInvoiceArray) {
                        // This income claims to be linked but the invoice doesn't have it - clear the link
                        await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                            invoice_id: null,
                            status: 'pending'
                        });
                        console.log(`Cleared orphaned link from income ${income.id}`);
                        incomeUpdates++;
                    }
                }
            }
        }
        
        // Refresh incomes after clearing orphaned links
        const refreshedIncomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        // SMART MATCHING: Match incomes to invoices based on provider, program group, and month
        for (const invoice of invoices) {
            const matchingIncomes = refreshedIncomes.filter(income => {
                // Skip if already correctly linked
                if (income.invoice_id === invoice.id && invoice.outside_income_ids?.includes(income.id)) {
                    skipped++;
                    return false;
                }
                
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
                
                // Get existing income IDs and merge with new matches
                const existingIds = invoice.outside_income_ids || [];
                const newIncomeIds = matchingIncomes.map(inc => inc.id);
                const mergedIds = [...new Set([...existingIds, ...newIncomeIds])];
                
                // Update the invoice's outside_income_ids array
                await base44.asServiceRole.entities.Invoice.update(invoice.id, {
                    outside_income_ids: mergedIds
                });
                invoiceUpdates++;
                
                // Update each income's invoice_id
                for (const income of matchingIncomes) {
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
        
        return Response.json({ 
            success: true, 
            message: `Matched and linked ${matchesMade} income records to ${invoiceUpdates} invoices. Cleared orphaned links and synced bidirectional relationships.`,
            incomeUpdates,
            invoiceUpdates,
            matchesMade,
            skipped,
            totalInvoices: invoices.length,
            totalIncomes: refreshedIncomes.length
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