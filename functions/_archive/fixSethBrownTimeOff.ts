import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Find the provider (more robust search)
        const providers = await base44.entities.Provider.list();
        // Try exact match first, then includes
        let provider = providers.find(p => p.full_name === 'Seth Brown' || p.full_name === 'Dr. Seth Brown');
        
        if (!provider) {
            provider = providers.find(p => p.full_name.toLowerCase().includes('seth') && p.full_name.toLowerCase().includes('brown'));
        }
        
        if (!provider) {
             // Fallback: check for just "Seth" if unique
             const seths = providers.filter(p => p.full_name.toLowerCase().includes('seth'));
             if (seths.length === 1) provider = seths[0];
        }

        if (!provider) {
            return Response.json({ 
                message: 'Provider not found. Available providers: ' + providers.map(p => p.full_name).join(', ') 
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
                // Only update if year is not 2026 (e.g. 2024 or 2025)
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