import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Provider names in the order specified
    const providerNamesInOrder = [
      "Dr. Kimberly Rutherford",
      "Dr. Benjamin Wycherly",
      "Dr. Ryan Drake",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Stephen Wolfe",
      "Dr. Hailun Wang",
      "Dr. Benjamin Wycherly",
      "Dr. Kimberly Rutherford",
      "Dr. Ryan Drake",
      "Dr. Stephen Wolfe",
      "Dr. Kimberly Rutherford",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Ryan Drake",
      "Dr. Stephen Wolfe",
      "Dr. Benjamin Wycherly",
      "Dr. Kimberly Rutherford",
      "Dr. Belachew Tessema",
      "Dr. Stephen Wolfe",
      "Dr. Ryan Drake",
      "Dr. Benjamin Wycherly",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Ryan Drake",
      "Dr. Kimberly Rutherford",
      "Dr. Hailun Wang",
      "Dr. Stephen Wolfe",
      "Dr. Benjamin Wycherly",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Ryan Drake",
      "Dr. Kimberly Rutherford",
      "Dr. Belachew Tessema",
      "Dr. Jerlon Chiu",
      "Dr. Stephen Wolfe",
      "Dr. Erin Alday",
      "Dr. Benjamin Wycherly",
      "Dr. Kimberly Rutherford",
      "Dr. Stephen Wolfe",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Erin Alday",
      "Dr. Benjamin Wycherly",
      "Dr. Jerlon Chiu",
      "Dr. Ryan Drake",
      "Dr. Benjamin Wycherly",
      "Dr. Erin Alday",
      "Dr. Stephen Wolfe",
      "Dr. Jerlon Chiu",
      "Dr. Ryan Drake",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Erin Alday",
      "Dr. Kimberly Rutherford",
      "Dr. Benjamin Wycherly",
      "Dr. Jerlon Chiu",
      "Dr. Ryan Drake",
      "Dr. Stephen Wolfe",
      "Dr. Benjamin Wycherly",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Kimberly Rutherford",
      "Dr. Seth Brown",
      "Dr. Jerlon Chiu",
      "Dr. Benjamin Wycherly",
      "Dr. Stephen Wolfe",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Kimberly Rutherford",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Erin Alday",
      "Dr. Jerlon Chiu",
      "Dr. Stephen Wolfe",
      "Dr. Ryan Drake",
      "Dr. Benjamin Wycherly",
      "Dr. Kimberly Rutherford",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Erin Alday",
      "Dr. Benjamin Wycherly",
      "Dr. Hailun Wang",
      "Dr. Ryan Drake",
      "Dr. Stephen Wolfe",
      "Dr. Seth Brown",
      "Dr. Kimberly Rutherford",
      "Dr. Jerlon Chiu",
      "Dr. Erin Alday",
      "Dr. Belachew Tessema",
      "Dr. Erin Alday",
      "Dr. Seth Brown",
      "Dr. Jerlon Chiu",
      "Dr. Belachew Tessema",
      "Dr. Stephen Wolfe",
      "Dr. Kimberly Rutherford",
      "Dr. Erin Alday",
      "Dr. Ryan Drake"
    ];

    // Fetch all providers
    const providers = await base44.entities.Provider.list();
    
    // Create a map of provider names to IDs
    const providerMap = {};
    providers.forEach(provider => {
      providerMap[provider.full_name] = provider.id;
    });

    // Fetch all on-call schedules sorted by start_date ascending
    const schedules = await base44.entities.OnCallSchedule.list('start_date');

    if (schedules.length === 0) {
      return Response.json({
        success: false,
        message: 'No on-call schedules found'
      });
    }

    // Update each schedule with the corresponding provider
    let updatedCount = 0;
    let notFoundProviders = [];
    const updates = [];

    for (let i = 0; i < schedules.length && i < providerNamesInOrder.length; i++) {
      const schedule = schedules[i];
      const providerName = providerNamesInOrder[i];
      const providerId = providerMap[providerName];

      if (!providerId) {
        notFoundProviders.push(providerName);
        continue;
      }

      // Only update if the provider is different
      if (schedule.provider_id !== providerId) {
        updates.push(
          base44.entities.OnCallSchedule.update(schedule.id, {
            provider_id: providerId
          })
        );
        updatedCount++;
      }
    }

    // Execute all updates
    await Promise.all(updates);

    return Response.json({
      success: true,
      message: `Successfully updated ${updatedCount} on-call schedules`,
      totalSchedules: schedules.length,
      providersInOrder: providerNamesInOrder.length,
      notFoundProviders: notFoundProviders.length > 0 ? notFoundProviders : null
    });

  } catch (error) {
    console.error('Error updating on-call providers:', error);
    return Response.json({ 
      error: error.message || 'An error occurred while updating on-call schedules'
    }, { status: 500 });
  }
});