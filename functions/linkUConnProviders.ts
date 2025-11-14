import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        let skippedCount = 0;
        
        // Filter for UConn income records that have an invoice
        for (const income of incomes) {
            // Only process UConn records with an invoice
            const isUConn = uconnLocationIds.includes(income.program_location_id) || 
                           income.facility_name?.toLowerCase().includes('uconn');
            
            if (!isUConn || !income.invoice_id) {
                skippedCount++;
                continue;
            }
            
            // Find the invoice
            const invoice = invoices.find(inv => inv.id === income.invoice_id);
            
            if (invoice && invoice.staff_member_id && invoice.staff_member_id !== income.provider_id) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    provider_id: invoice.staff_member_id
                });
                updatedCount++;
            } else {
                skippedCount++;
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updatedCount} UConn income records with providers from invoices. Skipped ${skippedCount} records.`,
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