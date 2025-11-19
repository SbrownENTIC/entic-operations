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

    // Fetch the CSV file
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch file', 
        details: `HTTP ${fileResponse.status}` 
      }, { status: 400 });
    }

    const csvText = await fileResponse.text();
    
    // Parse CSV manually
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return Response.json({ 
        error: 'No data found in file',
        details: 'CSV file must have at least a header row and one data row'
      }, { status: 400 });
    }

    // Parse header row - handle CSV properly
    const headerLine = lines[0];
    const headers = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        headers.push(current.trim().replace(/"/g, '').toLowerCase().replace(/\s+/g, '_'));
        current = '';
      } else {
        current += char;
      }
    }
    headers.push(current.trim().replace(/"/g, '').toLowerCase().replace(/\s+/g, '_'));
    
    // Find column indexes
    const itemNumberIndex = headers.findIndex(h => h === 'item_number');
    const productNameIndex = headers.findIndex(h => h === 'product_name');
    const vendorIndex = headers.findIndex(h => h === 'vendor');
    const unitPriceIndex = headers.findIndex(h => h === 'unit_price');
    const unitsIndex = headers.findIndex(h => h === 'units');
    const imageUrlIndex = headers.findIndex(h => h === 'image_url');

    if (itemNumberIndex === -1 || productNameIndex === -1) {
      return Response.json({ 
        error: 'Missing required columns',
        details: 'CSV must have "Item Number" and "Product Name" columns'
      }, { status: 400 });
    }

    // Get all existing supplies
    const existingSupplies = await base44.asServiceRole.entities.Supply.list();
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing (handles quoted values)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const itemNumber = values[itemNumberIndex]?.replace(/"/g, '').trim();
        const productName = values[productNameIndex]?.replace(/"/g, '').trim();

        if (!itemNumber || !productName) {
          skipped++;
          continue;
        }

        // Find existing supply by item_number
        const existing = existingSupplies.find(s => s.item_number === itemNumber);

        const data = {
          item_number: itemNumber,
          product_name: productName,
          vendor: vendorIndex !== -1 ? values[vendorIndex]?.replace(/"/g, '').trim() || 'Staples' : 'Staples',
          unit_price: unitPriceIndex !== -1 ? parseFloat(values[unitPriceIndex]?.replace(/"/g, '')) || 0 : 0,
          units: unitsIndex !== -1 ? values[unitsIndex]?.replace(/"/g, '').trim() || 'each' : 'each',
          image_url: imageUrlIndex !== -1 ? values[imageUrlIndex]?.replace(/"/g, '').trim() || '' : ''
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
        errors.push(`Error processing row ${i + 1}: ${itemError.message}`);
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