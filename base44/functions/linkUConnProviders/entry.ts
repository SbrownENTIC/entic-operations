import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO, isSameDay, startOfDay } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Fetch all outside income records
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        // Fetch all invoices
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        
        // Fetch program locations to identify UConn
        const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
        const uconnLocations = programLocations.filter(pl => 
            pl.program_group?.toLowerCase().includes('uconn')
        );
        const uconnLocationIds = uconnLocations.map(loc => loc.id);
        
        let updatedCount = 0;
        let skippedNoWorkDates = 0;
        let skippedNoMatch = 0;
        let skippedAlreadyCorrect = 0;
        
        // Process UConn income records
        for (const income of incomes) {
            const isUConn = uconnLocationIds.includes(income.program_location_id) || 
                           income.facility_name?.toLowerCase().includes('uconn');
            
            if (!isUConn) continue;
            
            if (!income.work_dates || income.work_dates.length === 0) {
                skippedNoWorkDates++;
                continue;
            }
            
            // Convert work dates to comparable format
            const incomeWorkDates = income.work_dates.map(d => startOfDay(parseISO(d)));
            
            // Find invoice with matching work dates
            let matchingInvoice = null;
            for (const invoice of invoices) {
                if (!invoice.staff_member_id) continue;
                
                // Get income records in this invoice
                if (!invoice.outside_income_ids || invoice.outside_income_ids.length === 0) continue;
                
                const invoiceIncomes = incomes.filter(inc => 
                    invoice.outside_income_ids.includes(inc.id)
                );
                
                // Check if any income in the invoice has matching work dates
                for (const invIncome of invoiceIncomes) {
                    if (!invIncome.work_dates || invIncome.work_dates.length === 0) continue;
                    
                    const invWorkDates = invIncome.work_dates.map(d => startOfDay(parseISO(d)));
                    
                    // Check if there's any date overlap
                    const hasOverlap = incomeWorkDates.some(incDate => 
                        invWorkDates.some(invDate => isSameDay(incDate, invDate))
                    );
                    
                    if (hasOverlap) {
                        matchingInvoice = invoice;
                        break;
                    }
                }
                
                if (matchingInvoice) break;
            }
            
            if (!matchingInvoice) {
                skippedNoMatch++;
                continue;
            }
            
            if (matchingInvoice.staff_member_id === income.provider_id) {
                skippedAlreadyCorrect++;
                continue;
            }
            
            await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                provider_id: matchingInvoice.staff_member_id
            });
            updatedCount++;
        }
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updatedCount} UConn income records. Skipped: ${skippedNoWorkDates} (no work dates), ${skippedNoMatch} (no matching invoice), ${skippedAlreadyCorrect} (already correct).`,
            updatedCount,
            skippedNoWorkDates,
            skippedNoMatch,
            skippedAlreadyCorrect
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});