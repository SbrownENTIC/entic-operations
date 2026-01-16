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
    console.log(`Starting sync for ${providerIds?.length} providers (v2 - no nulls)`);

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
        // Airtable only accepts "Active" or "Inactive". Map "pending" to "Inactive".
        'Status': provider.status === 'active' ? 'Active' : 'Inactive',
      };

      // 1. Correct Field Name: "Work Email" instead of "Email"
      if (provider.email) fields['Work Email'] = provider.email;

      // 2. Validate Phone against exact allowed options
      const validPhones = [
        '(860) 543-4846',
        '(571) 232-9212',
        '(513) 497-7890',
        '(860) 463-0099',
        '(860) 977-3163',
        '(860) 810-4018',
        '(860) 805-5529',
        '(925) 322-9228',
        '(860) 716-8602'
      ];
      if (provider.phone && validPhones.includes(provider.phone)) {
        fields['Phone'] = provider.phone;
      }

      // 3. Validate Role against exact allowed options
      const validRoles = [
        'ENT MD', 
        'ENT PA', 
        'ENT NP', 
        'Audiologist', 
        'Sleep MD', 
        'Sleep NP', 
        'Sleep PA'
      ];
      if (provider.role && validRoles.includes(provider.role)) {
        fields['Role'] = provider.role;
      }
      
      // 4. Removed Program/Location mapping
      // This is a Linked Record field. Sending text strings causes errors. 
      // We need to look up IDs from the Programs table first, but we don't have that table ID yet.
      // Skipping as requested.
      
      // Ensure date is strictly YYYY-MM-DD
      if (provider.flu_vaccine_date) {
        // Handle both ISO strings and YYYY-MM-DD
        fields['Flu Vaccine Date'] = provider.flu_vaccine_date.substring(0, 10);
      }
      
      // 5. Removed 'Current Year Flu Vaccine' as it is a read-only formula field

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

    let message = `Synced ${syncedCount} providers to Airtable.`;
    let debugInfo = null;

    if (errors.length > 0) {
      // detailed error message for the first error
      const firstError = errors[0];
      let errorDetail = firstError.error;
      if (typeof errorDetail === 'object') {
        errorDetail = errorDetail.message || JSON.stringify(errorDetail);
      }
      message += ` Failed to sync ${errors.length} batches. First error: ${errorDetail}`;

      // Debug: Fetch one record to inspect schema if we have validation errors
      try {
        const debugResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}?maxRecords=1`, {
          headers: { 'Authorization': `Bearer ${airtableApiKey}` }
        });
        const debugData = await debugResponse.json();
        if (debugData.records && debugData.records.length > 0) {
          const sampleFields = debugData.records[0].fields;
          debugInfo = {
            sampleRecordFields: Object.keys(sampleFields),
            sampleValues: sampleFields,
            failedPayload: firstError.batchIds ? recordsToUpdate.find(r => r.id === firstError.batchIds[0]) || recordsToCreate[0] : null
          };
          message += ` | DEBUG: Sending: ${JSON.stringify(debugInfo.failedPayload?.fields)}. Airtable Expects fields like: ${Object.keys(sampleFields).join(', ')}`;
        }
      } catch (e) {
        console.error("Failed to fetch debug info", e);
      }
    }

    return Response.json({
      success: errors.length === 0,
      message: message,
      stats: { updated: recordsToUpdate.length, created: recordsToCreate.length },
      errors: errors.length > 0 ? errors : undefined,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Error syncing providers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});