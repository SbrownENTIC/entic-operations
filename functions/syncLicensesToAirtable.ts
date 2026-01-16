import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U';
const LICENSES_TABLE_ID = 'tbl82FkdzkUH3QBlr';
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

    // Parse optional provider_id from request body for testing
    let provider_id = null;
    try {
      const body = await req.json();
      provider_id = body.provider_id;
    } catch (e) {
      // body might be empty or not json
    }

    // Fetch licenses and providers from Base44
    let licenses;
    if (provider_id) {
       licenses = await base44.asServiceRole.entities.License.filter({ provider_id });
    } else {
       licenses = await base44.asServiceRole.entities.License.list();
    }
    const providers = await base44.asServiceRole.entities.Provider.list();

    // Create a map of provider IDs to names and emails
    const providerMap = {};
    providers.forEach(p => {
      providerMap[p.id] = { name: p.full_name, email: p.email };
    });

    // 1. Get existing Airtable staff records
    const staffResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}?fields%5B%5D=Provider%20Name`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const staffData = await staffResponse.json();
    const staffNameToId = {};
    if (staffData.records) {
      staffData.records.forEach(record => {
        const name = record.fields['Provider Name'];
        if (name) {
          staffNameToId[name.toLowerCase().trim()] = record.id;
        }
      });
    }

    // 2. Get existing Airtable license records to perform UPSERT (Update/Create)
    // We fetch 'Internal License ID' to match against
    let allAirtableLicenses = [];
    let offset = null;
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LICENSES_TABLE_ID}`);
      url.searchParams.append('fields[]', 'Internal License ID');
      url.searchParams.append('fields[]', 'Staff Member');
      url.searchParams.append('fields[]', 'License Type');
      if (offset) url.searchParams.append('offset', offset);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.records) {
        allAirtableLicenses = [...allAirtableLicenses, ...data.records];
      }
      offset = data.offset;
    } while (offset);

    // Map Internal License ID -> Airtable Record ID
    // Also Map (Staff Record ID + License Type) -> Airtable Record ID for fallback matching
    const licenseIdToRecordId = {};
    const compositeKeyToRecordId = {};

    allAirtableLicenses.forEach(record => {
      // Map by Internal ID
      const internalId = record.fields['Internal License ID'];
      if (internalId) {
        licenseIdToRecordId[internalId] = record.id;
      }

      // Map by Composite Key (Staff + Type)
      const staff = record.fields['Staff Member'];
      const type = record.fields['License Type'];
      if (staff && Array.isArray(staff) && staff.length > 0 && type) {
        const key = `${staff[0]}_${type}`;
        compositeKeyToRecordId[key] = record.id;
      }
    });

    // Sync each license to Airtable (UPSERT)
    let synced = 0;
    let errors = [];

    for (const license of licenses) {
      const provider = providerMap[license.provider_id];
      if (!provider) continue;

      // Find matching staff record in Airtable
      const staffRecordId = staffNameToId[provider.name?.toLowerCase().trim()];
      
      // Determine existing record ID:
      // 1. Try matching by Internal License ID
      // 2. Fallback to matching by Staff + License Type
      const internalId = license.internal_license_number;
      let existingRecordId = internalId ? licenseIdToRecordId[internalId] : null;

      if (!existingRecordId && staffRecordId && license.license_type) {
        const compositeKey = `${staffRecordId}_${license.license_type}`;
        existingRecordId = compositeKeyToRecordId[compositeKey];
      }

      const cleanLicenseType = (license.license_type || '').trim().replace(/^"|"$/g, '');

      const fields = {
        'License Type': cleanLicenseType,
        'Expiration Date': license.expiration_date || null,
        'Status': license.status || 'active',
        // 'Internal License ID': internalId || '', // Cannot write to computed field
        'Reminder 30 Days': license.reminder_30_sent || false,
        'Reminder 14 Days': license.reminder_14_sent || false,
        'Reminder 7 Days': license.reminder_7_sent || false
      };

      const body = JSON.stringify({
        fields,
        typecast: true
      });

      // Link to staff member if found
      if (staffRecordId) {
        fields['Staff Member'] = [staffRecordId];
      } else {
         // If we can't link to a staff member, we might want to skip or log an error?
         // For now, let's log it to errors so the user knows why it didn't sync
         errors.push({ license: license.id, error: `Provider "${provider.name}" not found in Airtable` });
         continue; 
      }

      try {
        let response;
        if (existingRecordId) {
          // UPDATE (PATCH)
          response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LICENSES_TABLE_ID}/${existingRecordId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
              },
              body
            }
          );
        } else {
          // CREATE (POST)
          response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LICENSES_TABLE_ID}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
              },
              body
            }
          );
        }

        if (response.ok) {
          synced++;
        } else {
          const errorData = await response.json();
          if (errorData?.error?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
            errors.push({ license: license.id, error: `License Type "${cleanLicenseType}" is not a valid option in Airtable for License Type field. Please add it manually or correct the license type.` });
          } else {
            errors.push({ license: license.id, error: errorData });
          }
        }
      } catch (err) {
        errors.push({ license: license.id, error: err.message });
      }
      
      // Basic rate limiting to respect Airtable's 5 rps
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    let message = `Synced ${synced} licenses to Airtable`;
    if (errors.length > 0) {
      message += `. with ${errors.length} errors. First error: ${JSON.stringify(errors[0].error)}`;
    }

    return Response.json({
      success: errors.length === 0,
      message,
      total: licenses.length,
      synced,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});