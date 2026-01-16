import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
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

    // 1. Get existing Airtable staff records (Fetch ALL fields to ensure we catch the name)
    let allStaffRecords = [];
    let staffOffset = null;
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${STAFF_TABLE_ID}`);
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

    const staffNameToId = {};
    const staffEmailToId = {};
    const availableStaffNames = []; // For debugging

    if (allStaffRecords.length > 0) {
      allStaffRecords.forEach(record => {
        // Strictly use 'Provider Name' as requested, with fallback only if empty
        const name = record.fields['Provider Name'] || record.fields['Name'];

        if (name) {
          // Normalize name: lowercase, trim, and collapse multiple spaces to single space
          const cleanName = name.toLowerCase().trim().replace(/\s+/g, ' ');
          staffNameToId[cleanName] = record.id;

          // Also handle "Last, First" format by adding "First Last" version just in case
          if (name.includes(',')) {
             const parts = name.split(',').map(p => p.trim());
             if (parts.length === 2) {
                 const firstLast = `${parts[1]} ${parts[0]}`.toLowerCase().replace(/\s+/g, ' ');
                 staffNameToId[firstLast] = record.id;
             }
          }

          if (availableStaffNames.length < 5) availableStaffNames.push(name);
        }

        // Strictly use 'Work Email' as requested
        const email = record.fields['Work Email'];
        if (email) {
          staffEmailToId[email.toLowerCase().trim()] = record.id;
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

    // Debug: Check if 'Staff Member' field exists in fetched records
    const debug_field_check = {
        hasStaffMemberField: allAirtableLicenses.some(r => r.fields['Staff Member']),
        sampleFields: allAirtableLicenses.length > 0 ? Object.keys(allAirtableLicenses[0].fields) : []
    };
    const debug_logs = [];

    // Sync each license to Airtable (UPSERT)
    let synced = 0;
    let errors = [];

    for (const license of licenses) {
      const provider = providerMap[license.provider_id];
      if (!provider) continue;

      // Find matching staff record in Airtable (Try Name first, then Email)
      // Normalize provider name from app as well
      const appProviderName = (provider.name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      let staffRecordId = staffNameToId[appProviderName];
      
      if (!staffRecordId && provider.email) {
        staffRecordId = staffEmailToId[provider.email.toLowerCase().trim()];
      }
      
      // Map to Airtable License Types FIRST so we can match correctly
      let cleanLicenseType = (license.license_type || '').trim().replace(/^"|"$/g, '');
      const licenseTypeMap = {
        'Audiologist License': 'AUD',
        'DEA License': 'DEA',
        'Medical License': 'MED',
        'APRN License': 'APRN',
        'Controlled Substance Practitioner License': 'CSP',
        'Physician Assistant- Certified': 'PA',
        'Physician Assistant-Certified': 'PA',
        'ASHA Certification': 'ASHA',
        'ASHA': 'ASHA'
      };

      if (licenseTypeMap[cleanLicenseType]) {
        cleanLicenseType = licenseTypeMap[cleanLicenseType];
      }

      // Determine existing record ID:
      // 1. Try matching by Internal License ID
      // 2. Fallback to matching by Staff + License Type (using the MAPPED type)
      const internalId = license.internal_license_number;
      let existingRecordId = internalId ? licenseIdToRecordId[internalId] : null;

      if (!existingRecordId && staffRecordId && cleanLicenseType) {
        // CRITICAL FIX: Use cleanLicenseType (mapped) instead of raw license.license_type
        // because Airtable keys were built using the mapped values (e.g. 'MED')
        const compositeKey = `${staffRecordId}_${cleanLicenseType}`;
        existingRecordId = compositeKeyToRecordId[compositeKey];
      }

      const fields = {
        'License Type': cleanLicenseType,
        'Expiration Date': license.expiration_date || null,
        'Status': (license.status === 'expired') ? 'Inactive' : 'Active',
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
         errors.push({ 
             license: license.id, 
             error: `Provider "${provider.name}" (normalized: "${appProviderName}", email: "${provider.email}") not found in Airtable. Available names sample: ${availableStaffNames.join(', ')}` 
         });
         continue; 
      }

      // DEBUG: Capture Ashley Radcliffe details
      if (provider.name.toLowerCase().includes('ashley radcliffe')) {
          debug_logs.push({
              providerName: provider.name,
              staffRecordId,
              fieldsSent: fields,
              isUpdate: !!existingRecordId
          });
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
      errors: errors.length > 0 ? errors : undefined,
      debug_field_check,
      debug_logs
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});