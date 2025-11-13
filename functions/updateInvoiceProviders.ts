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
      "Dr. Stephen Wolfe",
      "Dr. Benjamin Wycherly",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Stephen Wolfe",
      "Dr. Belachew Tessema",
      "Dr. Kimberly Rutherford",
      "Dr. Benjamin Wycherly",
      "Dr. Stephen Wolfe",
      "Dr. Ryan Drake",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Kimberly Rutherford",
      "Dr. Stephen Wolfe",
      "Dr. Ryan Drake",
      "Dr. Benjamin Wycherly",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Benjamin Wycherly",
      "Dr. Kimberly Rutherford",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Stephen Wolfe",
      "Dr. Kimberly Rutherford",
      "Dr. Erin Alday",
      "Dr. Stephen Wolfe",
      "Dr. Jerlon Chiu",
      "Dr. Belachew Tessema",
      "Dr. Benjamin Wycherly",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Kimberly Rutherford",
      "Dr. Ryan Drake",
      "Dr. Belachew Tessema",
      "Dr. Benjamin Wycherly",
      "Dr. Hailun Wang",
      "Dr. Stephen Wolfe",
      "Dr. Benjamin Wycherly",
      "Dr. Benjamin Wycherly",
      "Dr. Ryan Drake",
      "Dr. Hailun Wang",
      "Dr. Kimberly Rutherford",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Hailun Wang",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Seth Brown",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Belachew Tessema",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Ryan Drake",
      "Dr. Seth Brown",
      "Dr. Ryan Drake",
      "Dr. Ryan Drake",
      "Dr. Ryan Drake",
      "Dr. Ryan Drake",
      "Dr. Ryan Drake",
      "Dr. Hailun Wang",
      "Dr. Seth Brown",
      "Dr. Ryan Drake"
    ];

    console.log('Fetching providers...');
    // Fetch all providers
    const providers = await base44.entities.Provider.list();
    console.log(`Found ${providers.length} providers`);
    
    // Create a map of provider names to IDs
    const providerMap = {};
    providers.forEach(provider => {
      providerMap[provider.full_name] = provider.id;
    });

    console.log('Fetching invoices...');
    // Fetch all invoices sorted by invoice_date ascending (oldest first)
    const invoices = await base44.entities.Invoice.list('invoice_date');
    console.log(`Found ${invoices.length} invoices`);

    if (invoices.length === 0) {
      return Response.json({
        success: false,
        message: 'No invoices found'
      });
    }

    // Update each invoice with the corresponding provider
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundProviders = [];
    const updates = [];

    for (let i = 0; i < invoices.length && i < providerNamesInOrder.length; i++) {
      const invoice = invoices[i];
      const providerName = providerNamesInOrder[i];
      const providerId = providerMap[providerName];

      if (!providerId) {
        console.log(`Provider not found: ${providerName}`);
        notFoundProviders.push(providerName);
        continue;
      }

      // Only update if the provider is different
      if (invoice.staff_member_id !== providerId) {
        console.log(`Updating invoice ${i + 1}: ${invoice.invoice_number} -> ${providerName}`);
        updates.push(
          base44.entities.Invoice.update(invoice.id, {
            staff_member_id: providerId
          })
        );
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`Executing ${updates.length} updates...`);
    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    console.log('Updates complete!');

    return Response.json({
      success: true,
      message: `Successfully updated ${updatedCount} invoices (${skippedCount} already correct)`,
      totalInvoices: invoices.length,
      providersInOrder: providerNamesInOrder.length,
      updatedCount,
      skippedCount,
      notFoundProviders: notFoundProviders.length > 0 ? notFoundProviders : null
    });

  } catch (error) {
    console.error('Error updating invoice providers:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'An error occurred while updating invoices',
      details: error.stack
    }, { status: 500 });
  }
});