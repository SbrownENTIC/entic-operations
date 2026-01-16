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

    // 1. Get existing Airtable staff records to check for updates
    // We only need Name and Email to identify matches
    let allStaffRecords = [];
    let staffOffset = null;
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}`);
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

    // Build lookup maps
    const staffNameToId = {};
    const staffEmailToId = {};
    allStaffRecords.forEach(record => {
      const name = record.fields['Provider Name'];
      if (name) {
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

      const cleanName = (provider.full_name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      let airtableRecordId = staffNameToId[cleanName];

      if (!airtableRecordId && provider.email) {
        airtableRecordId = staffEmailToId[provider.email.toLowerCase().trim()];
      }

      // Map fields according to requirements
      const fields = {
        'Provider Name': provider.full_name,
        'Work Email': provider.email,
        'Status': provider.status === 'active' ? 'Active' : provider.status === 'inactive' ? 'Inactive' : 'Pending',
        'Phone': provider.phone || '',
        'Role': provider.role || '',
        'Program/Location': (provider.program_locations && provider.program_locations.length > 0) ? provider.program_locations.join(', ') : '',
        'Flu Vaccine Date': provider.flu_vaccine_date || null,
        'Current Year Flu Vaccine': provider.flu_vaccine_year || '',
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

    // Function to batch process requests (Airtable allows max 10 per request)
    const processBatch = async (records, method) => {
      const batchSize = 10;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const body = method === 'POST' ? { records: batch } : { records: batch };
        
        try {
          const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}`, {
            method: method,
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
          
          const responseData = await response.json();
          if (response.ok) {
            syncedCount += responseData.records.length;
          } else {
            console.error(`Error in ${method} batch:`, responseData);
            errors.push({ method, error: responseData.error });
          }
        } catch (err) {
          console.error(`Exception in ${method} batch:`, err);
          errors.push({ method, error: err.message });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    };

    // Execute updates and creates
    if (recordsToUpdate.length > 0) await processBatch(recordsToUpdate, 'PATCH');
    if (recordsToCreate.length > 0) await processBatch(recordsToCreate, 'POST');

    return Response.json({
      success: errors.length === 0,
      message: `Successfully processed ${syncedCount} providers (${recordsToUpdate.length} updated, ${recordsToCreate.length} created).`, 
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing providers to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});