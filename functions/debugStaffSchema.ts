import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const STAFF_TABLE_ID = 'tblUwc7ndQvt1MXhM';

Deno.serve(async (req) => {
  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Fetch one record to inspect fields
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}?maxRecords=1`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    
    return Response.json({
        record: data.records && data.records[0],
        error: data.error
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});