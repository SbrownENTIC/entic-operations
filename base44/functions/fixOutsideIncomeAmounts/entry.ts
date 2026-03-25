import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        const programLocations = await base44.asServiceRole.entities.ProgramLocation.list();
        
        let updated = 0;
        let skipped = 0;
        let errors = [];
        
        for (const income of incomes) {
            try {
                let needsUpdate = false;
                const updates = {};
                
                // Find program location if not set
                if (!income.program_location_id && income.facility_name) {
                    const matchingLocation = programLocations.find(pl => 
                        pl.program_location?.toLowerCase() === income.facility_name?.toLowerCase()
                    );
                    if (matchingLocation) {
                        updates.program_location_id = matchingLocation.id;
                        needsUpdate = true;
                    }
                }
                
                const programLocation = programLocations.find(pl => pl.id === (updates.program_location_id || income.program_location_id));
                
                // Recalculate total_amount if it's 0 or missing
                if (!income.total_amount || income.total_amount === 0) {
                    if (programLocation) {
                        const isHartford = programLocation.program_group?.toLowerCase().includes('hartford hospital');
                        const isDirectorship = programLocation.program_type === 'Directorship';
                        
                        if (isHartford && !isDirectorship) {
                            // Hartford Hospital RVU-based - skip if no RVUs or already has amount
                            if (income.total_rvus && income.total_rvus > 0) {
                                // Can't auto-calculate RVU amounts, skip
                                skipped++;
                                continue;
                            }
                        } else if (isDirectorship) {
                            // Directorship - use the monthly rate
                            if (programLocation.daily_rate && programLocation.daily_rate > 0) {
                                updates.total_amount = programLocation.daily_rate;
                                updates.rate = programLocation.daily_rate;
                                needsUpdate = true;
                            }
                        } else {
                            // Regular program - multiply days by rate
                            const daysWorked = income.days_worked || (income.work_dates?.length || 0);
                            const rate = income.rate || programLocation.daily_rate || 0;
                            
                            if (daysWorked > 0 && rate > 0) {
                                updates.total_amount = daysWorked * rate;
                                if (!income.rate) {
                                    updates.rate = rate;
                                }
                                if (!income.days_worked) {
                                    updates.days_worked = daysWorked;
                                }
                                needsUpdate = true;
                            }
                        }
                    }
                }
                
                if (needsUpdate && Object.keys(updates).length > 0) {
                    await base44.asServiceRole.entities.OutsideIncome.update(income.id, updates);
                    updated++;
                } else {
                    skipped++;
                }
                
            } catch (error) {
                errors.push(`Error updating income ${income.id}: ${error.message}`);
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `Updated ${updated} income records, skipped ${skipped} (Hartford Hospital RVU-based records require manual entry)`,
            updated,
            skipped,
            totalIncomes: incomes.length,
            errors: errors.length > 0 ? errors.slice(0, 5) : undefined
        });
        
    } catch (error) {
        console.error('Fix amounts error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});