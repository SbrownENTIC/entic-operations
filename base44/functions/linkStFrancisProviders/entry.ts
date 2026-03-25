import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO, isWithinInterval, startOfDay } from 'npm:date-fns';

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
        
        // Fetch all on-call schedules
        const schedules = await base44.asServiceRole.entities.OnCallSchedule.list();
        
        // Fetch program locations to identify St. Francis
        const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
        const stFrancisLocations = programLocations.filter(pl => 
            pl.program_group?.toLowerCase().includes('st. francis') || 
            pl.program_group?.toLowerCase().includes('st francis')
        );
        const stFrancisLocationIds = stFrancisLocations.map(loc => loc.id);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Filter for St. Francis income records
        for (const income of incomes) {
            // Only process St. Francis records
            const isStFrancis = stFrancisLocationIds.includes(income.program_location_id) || 
                               income.facility_name?.toLowerCase().includes('st. francis') ||
                               income.facility_name?.toLowerCase().includes('st francis');
            
            if (!isStFrancis || !income.work_dates || income.work_dates.length === 0) {
                skippedCount++;
                continue;
            }
            
            // Use first work date as the on-call start
            const onCallStart = startOfDay(parseISO(income.work_dates[0]));
            
            // Find schedule where the first work date falls within the schedule period
            const matchingSchedule = schedules.find(schedule => {
                const isStFrancisSchedule = schedule.location?.toLowerCase().includes('st. francis') ||
                                           schedule.location?.toLowerCase().includes('st francis');
                if (!isStFrancisSchedule) return false;
                
                const scheduleStart = startOfDay(parseISO(schedule.start_date));
                const scheduleEnd = startOfDay(parseISO(schedule.end_date));
                
                // Check if the first work date falls within the schedule range
                return isWithinInterval(onCallStart, { start: scheduleStart, end: scheduleEnd });
            });
            
            if (matchingSchedule && matchingSchedule.provider_id !== income.provider_id) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    provider_id: matchingSchedule.provider_id
                });
                updatedCount++;
            } else {
                skippedCount++;
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updatedCount} St. Francis income records with correct providers. Skipped ${skippedCount} records.`,
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