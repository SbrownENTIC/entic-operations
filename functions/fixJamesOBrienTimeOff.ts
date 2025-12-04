import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find the provider
        const providers = await base44.entities.Provider.list();
        let provider = providers.find(p => p.full_name === "Dr. James O'Brien" || p.full_name === "James O'Brien");
        
        if (!provider) {
             // Fallback: check for "James" and "Brien"
             provider = providers.find(p => p.full_name.toLowerCase().includes('james') && p.full_name.toLowerCase().includes('brien'));
        }

        if (!provider) {
            return Response.json({ 
                message: 'Provider "James O\'Brien" not found. Available providers: ' + providers.map(p => p.full_name).join(', ') 
            });
        }

        // 2. Get his time off records
        const timeOffRecords = await base44.entities.ProviderTimeOff.filter({ provider_id: provider.id });
        
        let updatedCount = 0;
        
        // 3. Update each record
        for (const record of timeOffRecords) {
            let needsUpdate = false;
            const updates = {};
            
            if (record.start_date) {
                const startDate = new Date(record.start_date);
                if (startDate.getFullYear() !== 2026) {
                    startDate.setFullYear(2026);
                    updates.start_date = startDate.toISOString().split('T')[0];
                    needsUpdate = true;
                }
            }
            
            if (record.end_date) {
                const endDate = new Date(record.end_date);
                if (endDate.getFullYear() !== 2026) {
                    endDate.setFullYear(2026);
                    updates.end_date = endDate.toISOString().split('T')[0];
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await base44.entities.ProviderTimeOff.update(record.id, updates);
                updatedCount++;
            }
        }

        return Response.json({ 
            message: `Updated ${updatedCount} time off records for ${provider.full_name} to year 2026`,
            total_records: timeOffRecords.length,
            provider_found: provider.full_name
        });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});