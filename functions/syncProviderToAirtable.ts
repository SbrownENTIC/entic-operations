import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const STAFF_TABLE_ID = 'tblUwc7ndQvt1MXhM';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    const { providerIds } = await req.json();

    if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
      return Response.json({ error: 'No provider IDs provided for sync' }, { status: 400 });
    }

    // Fetch selected providers from Base44
    const providersToSync = await Promise.all(
      providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    // 1. Get existing Airtable staff records
    let allStaffRecords = [];
    let staffOffset = null;
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}`);
      // Only fetch necessary fields for matching
      url.searchParams.append('fields[]', 'Provider Name');
      url.searchParams.append('fields[]', 'Work Email');
      if (staffOffset) url.searchParams.append('offset', staffOffset);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.records) {
        allStaffRecords = [...allStaffRecords, ...data.records];
      }
      staffOffset = data.offset;
    } while (staffOffset);

    // Create lookup maps
    const staffNameToId = {};
    const staffEmailToId = {};
    allStaffRecords.forEach(record => {
      const name = record.fields['Provider Name'];
      if (name) {
        // Normalize: lowercase, trim, single spaces
        staffNameToId[name.toLowerCase().trim().replace(/\s+/g, ' ')] = record.id;
      }
      const email = record.fields['Work Email'];
      if (email) {
        staffEmailToId[email.toLowerCase().trim()] = record.id;
      }
    });

    let syncedCount = 0;
    let errors = [];
    const recordsToUpdate = [];
    const recordsToCreate = [];

    for (const provider of providersToSync) {
      if (!provider) continue;

      const cleanName = provider.full_name.toLowerCase().trim().replace(/\s+/g, ' ');
      let airtableRecordId = staffNameToId[cleanName];

      // Fallback to email matching
      if (!airtableRecordId && provider.email) {
        airtableRecordId = staffEmailToId[provider.email.toLowerCase().trim()];
      }

      const fields = {
        'Provider Name': provider.full_name,
        'Work Email': provider.email,
        'Status': provider.status === 'active' ? 'Active' : provider.status === 'inactive' ? 'Inactive' : 'Pending',
        'Phone': provider.phone || '',
        'Role': provider.role || '',
        'Program/Location': (provider.program_locations && provider.program_locations.length > 0) ? provider.program_locations.join(', ') : '',
        'Flu Vaccine Date': provider.flu_vaccine_date || null,
        'Current Year Flu Vaccine': provider.flu_vaccine_year || '',
        // 'Display Color' - skipping as we don't have a source for this
        // 'CME Records', etc. - skipping related records for now as per instructions
      };

      if (airtableRecordId) {
        recordsToUpdate.push({
          id: airtableRecordId,
          fields: fields,
          typecast: true
        });
      } else {
        recordsToCreate.push({
          fields: fields,
          typecast: true
        });
      }
    }

    // Process updates in batches of 10
    const processBatch = async (records, method) => {
      const batchSize = 10;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        try {
          const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}`,
            {
              method: method,
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ records: batch })
            }
          );
          const responseData = await response.json();
          if (response.ok) {
            syncedCount += responseData.records.length;
          } else {
            errors.push({ type: method === 'PATCH' ? 'update' : 'create', error: responseData.error, batchIds: batch.map(r => r.id || r.fields['Provider Name']) });
          }
        } catch (e) {
          errors.push({ type: method === 'PATCH' ? 'update' : 'create', error: e.message });
        }
        await new Promise(resolve => setTimeout(resolve, 250)); // Rate limit
      }
    };

    if (recordsToUpdate.length > 0) await processBatch(recordsToUpdate, 'PATCH');
    if (recordsToCreate.length > 0) await processBatch(recordsToCreate, 'POST');

    return Response.json({
      success: errors.length === 0,
      message: `Synced ${syncedCount} providers to Airtable.`,
      stats: { updated: recordsToUpdate.length, created: recordsToCreate.length },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing providers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});