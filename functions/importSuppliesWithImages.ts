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

    // Extract data from the uploaded Excel file using LLM with internet context
    let extractResult;
    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract supply catalog data from this Excel file. Return a JSON array of supply items with these fields:
- item_number (string): The item or SKU number
- product_name (string): The product name
- unit_price (number): The unit price as a number
- units (string): The unit type (e.g., "each", "box", "case")
- image_url (string): The image URL if present

Return only the array of items, nothing else.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            items: {
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
      
      extractResult = { output: llmResponse.items || llmResponse, status: 'success' };
    } catch (extractError) {
      return Response.json({ 
        error: 'Failed to extract data from file', 
        details: extractError.message 
      }, { status: 400 });
    }

    if (extractResult.status === 'error') {
      return Response.json({ 
        error: 'Failed to extract data from file', 
        details: extractResult.details 
      }, { status: 400 });
    }

    let supplies = extractResult.output;
    if (!Array.isArray(supplies)) {
      supplies = supplies.supplies || [];
    }

    if (!supplies || supplies.length === 0) {
      return Response.json({ 
        error: 'No data found in file',
        details: 'The file appears to be empty or has no valid rows'
      }, { status: 400 });
    }
    
    // Get all existing supplies
    const existingSupplies = await base44.asServiceRole.entities.Supply.list();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const supplyData of supplies) {
      try {
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
          unit_price: parseFloat(supplyData.unit_price) || 0,
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
      } catch (itemError) {
        errors.push(`Error processing ${supplyData.item_number}: ${itemError.message}`);
        skipped++;
      }
    }

    return Response.json({
      success: true,
      message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped`,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});