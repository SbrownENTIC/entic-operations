import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO, eachDayOfInterval, addDays, format } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Helper function to check if a time string represents midnight
        const isMidnight = (timeStr) => {
            if (!timeStr) return false;
            const normalized = timeStr.toLowerCase().trim();
            return normalized === '00:00' || 
                   normalized === '12:00 am' || 
                   normalized === '12:00am' ||
                   normalized === '0:00' ||
                   normalized === '00:00:00';
        };
        
        // Fetch all on-call schedules
        const schedules = await base44.asServiceRole.entities.OnCallSchedule.list();
        
        // Fetch all outside income records
        const existingIncomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        // Find St. Francis program location
        const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
        const stFrancisLocation = programLocations.find(pl => 
            pl.program_group?.toLowerCase().includes('st. francis') || 
            pl.program_group?.toLowerCase().includes('st francis')
        );
        
        if (!stFrancisLocation) {
            return Response.json({ 
                success: false, 
                error: 'St. Francis program location not found' 
            }, { status: 400 });
        }
        
        let createdCount = 0;
        let skippedCount = 0;
        
        // Filter for 2026 St. Francis schedules
        const stFrancis2026Schedules = schedules.filter(schedule => {
            const isStFrancis = schedule.location?.toLowerCase().includes('st. francis') || 
                               schedule.location?.toLowerCase().includes('st francis');
            const startDate = parseISO(schedule.start_date);
            const is2026 = startDate.getFullYear() === 2026;
            
            return isStFrancis && is2026;
        });
        
        for (const schedule of stFrancis2026Schedules) {
            // Calculate work dates and days
            const startDate = parseISO(schedule.start_date);
            const endDate = parseISO(schedule.end_date);
            
            // Determine last active day based on end_time
            let lastActiveDay = endDate;
            if (schedule.end_time && !isMidnight(schedule.end_time)) {
                lastActiveDay = addDays(endDate, -1);
            }
            
            const workDates = eachDayOfInterval({ start: startDate, end: lastActiveDay });
            const workDatesFormatted = workDates.map(d => format(d, 'yyyy-MM-dd'));
            
            // Check if an outside income record already exists for this schedule
            const existingIncome = existingIncomes.find(income => {
                // Check if this income record matches this schedule
                const matchesProvider = income.provider_id === schedule.provider_id;
                const matchesFacility = income.facility_name?.toLowerCase().includes('st. francis') || 
                                       income.facility_name?.toLowerCase().includes('st francis');
                const matchesDates = income.work_dates && 
                                    income.work_dates.length > 0 && 
                                    income.work_dates[0] === workDatesFormatted[0];
                
                return matchesProvider && matchesFacility && matchesDates;
            });
            
            if (existingIncome) {
                skippedCount++;
                continue;
            }
            
            const daysWorked = workDates.length;
            const rate = stFrancisLocation.daily_rate || 0;
            const totalAmount = daysWorked * rate;
            
            // Create outside income record
            await base44.asServiceRole.entities.OutsideIncome.create({
                provider_id: schedule.provider_id,
                program_location_id: stFrancisLocation.id,
                facility_name: schedule.location || 'St. Francis',
                work_dates: workDatesFormatted,
                days_worked: daysWorked,
                rate: rate,
                total_amount: totalAmount,
                status: 'pending',
                notes: `Auto-generated from 2026 on-call schedule ${schedule.start_date} to ${schedule.end_date}`
            });
            
            createdCount++;
        }
        
        return Response.json({ 
            success: true, 
            message: `Sync complete! Created ${createdCount} outside income records from 2026 St. Francis schedules. Skipped ${skippedCount} existing records.`,
            createdCount,
            skippedCount,
            totalSchedulesFound: stFrancis2026Schedules.length
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});