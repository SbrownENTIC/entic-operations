import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Extract data from the uploaded Excel file
    const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: file_url,
      json_schema: {
        type: "object",
        properties: {
          supplies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_number: { type: "string" },
                product_name: { type: "string" },
                unit_price: { type: "number" },
                units: { type: "string" },
                image_url: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (extractResult.status === 'error') {
      return Response.json({ 
        error: 'Failed to extract data from file', 
        details: extractResult.details 
      }, { status: 400 });
    }

    const supplies = extractResult.output.supplies || extractResult.output;
    
    // Get all existing supplies
    const existingSupplies = await base44.asServiceRole.entities.Supply.list();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const supplyData of supplies) {
      if (!supplyData.item_number || !supplyData.product_name) {
        skipped++;
        continue;
      }

      // Find existing supply by item_number
      const existing = existingSupplies.find(s => s.item_number === supplyData.item_number);

      const data = {
        item_number: supplyData.item_number,
        product_name: supplyData.product_name,
        vendor: supplyData.vendor || 'Staples',
        unit_price: supplyData.unit_price || 0,
        units: supplyData.units || 'each',
        image_url: supplyData.image_url || ''
      };

      if (existing) {
        // Update existing supply
        await base44.asServiceRole.entities.Supply.update(existing.id, data);
        updated++;
      } else {
        // Create new supply
        await base44.asServiceRole.entities.Supply.create(data);
        created++;
      }
    }

    return Response.json({
      success: true,
      message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      created,
      updated,
      skipped
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});