import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all active providers with termination dates
    const providers = await base44.asServiceRole.entities.Provider.list();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let terminatedCount = 0;
    
    for (const provider of providers) {
      // Check if provider is active and has a termination date
      if (provider.status === 'active' && provider.termination_date) {
        const terminationDate = new Date(provider.termination_date);
        terminationDate.setHours(0, 0, 0, 0);
        
        // If termination date has passed or is today, set to inactive
        if (terminationDate <= today) {
          await base44.asServiceRole.entities.Provider.update(provider.id, {
            status: 'inactive'
          });
          terminatedCount++;
        }
      }
    }
    
    return Response.json({
      success: true,
      message: `Processed ${providers.length} providers. ${terminatedCount} provider(s) set to inactive.`,
      terminated_count: terminatedCount
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});