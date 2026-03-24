import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO, isSameDay } from 'npm:date-fns';

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
            // Only process St. Francis records that don't already have temp_oncall_start_date
            const isStFrancis = stFrancisLocationIds.includes(income.program_location_id) || 
                               income.facility_name?.toLowerCase().includes('st. francis') ||
                               income.facility_name?.toLowerCase().includes('st francis');
            
            if (!isStFrancis || income.temp_oncall_start_date) {
                skippedCount++;
                continue;
            }
            
            // Try to find matching on-call schedule
            if (!income.work_dates || income.work_dates.length === 0) {
                skippedCount++;
                continue;
            }
            
            // Find schedule that matches provider and contains the first work date
            const firstWorkDate = parseISO(income.work_dates[0]);
            
            const matchingSchedule = schedules.find(schedule => {
                if (schedule.provider_id !== income.provider_id) return false;
                
                const isStFrancisSchedule = schedule.location?.toLowerCase().includes('st. francis') ||
                                           schedule.location?.toLowerCase().includes('st francis');
                if (!isStFrancisSchedule) return false;
                
                const scheduleStart = parseISO(schedule.start_date);
                const scheduleEnd = parseISO(schedule.end_date);
                
                // Check if first work date falls within schedule range
                return firstWorkDate >= scheduleStart && firstWorkDate <= scheduleEnd;
            });
            
            if (matchingSchedule) {
                await base44.asServiceRole.entities.OutsideIncome.update(income.id, {
                    temp_oncall_start_date: matchingSchedule.start_date
                });
                updatedCount++;
            } else {
                skippedCount++;
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Linked ${updatedCount} outside income records to on-call schedules. Skipped ${skippedCount} records.`,
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