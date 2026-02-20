import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const LICENSES_TABLE_ID = 'tbl82FkdzkUH3QBlr';
const STAFF_TABLE_ID = 'tblUwc7ndQvt1MXhM';

Deno.serve(async (req) => {
  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Fetch 1 record from Licenses Table
    const licensesResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LICENSES_TABLE_ID}?maxRecords=1`,
      { headers: { 'Authorization': `Bearer ${airtableApiKey}` } }
    );
    const licensesData = await licensesResponse.json();

    // Fetch 1 record from Staff Table
    const staffResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}?maxRecords=1`,
      { headers: { 'Authorization': `Bearer ${airtableApiKey}` } }
    );
    const staffData = await staffResponse.json();

    return Response.json({
      licenseTableFields: licensesData.records?.[0]?.fields ? Object.keys(licensesData.records[0].fields) : 'No records found',
      staffTableFields: staffData.records?.[0]?.fields ? Object.keys(staffData.records[0].fields) : 'No records found',
      licenseRecordSample: licensesData.records?.[0],
      staffRecordSample: staffData.records?.[0]
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});