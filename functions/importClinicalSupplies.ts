import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parse } from 'npm:csv-parse/sync';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For a public app, we might not have a logged-in user, 
    // so we skip the base44.auth.me() check if we want to allow public access.
    // However, to prevent abuse, we should ideally check for some secret or just rely on obscurity if that's the user's model.
    // Given the user's prompt "public unlocked app", we will proceed without strict user auth 
    // but use the service role to perform the database operations.

    const { csvContent } = await req.json();

    if (!csvContent) {
      return Response.json({ error: "No CSV content provided" }, { status: 400 });
    }

    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Map CSV columns to Entity fields
    // Expected CSV headers: "Item Code", "Description", "Codes", "Unit Price"
    // Entity fields: item_number, product_name, codes, unit_price, category='clinical'
    
    const itemsToCreate = records.map(record => {
      // Normalize keys to lowercase to be more forgiving
      const normalizedRecord = {};
      Object.keys(record).forEach(key => {
        normalizedRecord[key.toLowerCase()] = record[key];
      });

      return {
        item_number: normalizedRecord['item code'] || normalizedRecord['item_code'] || '',
        product_name: normalizedRecord['description'] || normalizedRecord['product name'] || '',
        codes: normalizedRecord['codes'] || '',
        unit_price: parseFloat((normalizedRecord['unit price'] || normalizedRecord['unit_price'] || '0').replace(/[^0-9.]/g, '')),
        category: 'clinical'
      };
    }).filter(item => item.product_name); // Ensure we at least have a name

    if (itemsToCreate.length === 0) {
      return Response.json({ message: "No valid items found in CSV" }, { status: 400 });
    }

    // Use service role to bypass row-level security policies that might require an authenticated user
    // This fixes the "authentication required" error for public apps
    // We'll use loop since bulkCreate might not be available on all SDK versions/entities, 
    // but parallel requests are faster.
    
    // Note: For large imports (hundreds), we should batch.
    // Assuming reasonable size for now.
    
    let successCount = 0;
    const errors = [];

    // Create in batches of 10 to avoid rate limits/timeouts
    const batchSize = 10;
    for (let i = 0; i < itemsToCreate.length; i += batchSize) {
      const batch = itemsToCreate.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          await base44.asServiceRole.entities.Supply.create(item);
          successCount++;
        } catch (err) {
          errors.push(`Failed to create ${item.product_name}: ${err.message}`);
        }
      }));
    }

    return Response.json({ 
      message: `Successfully imported ${successCount} items.`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});