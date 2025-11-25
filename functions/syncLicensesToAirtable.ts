import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Fetch licenses and providers from Base44
    const licenses = await base44.asServiceRole.entities.License.list();
    const providers = await base44.asServiceRole.entities.Provider.list();

    // Create a map of provider IDs to names and emails
    const providerMap = {};
    providers.forEach(p => {
      providerMap[p.id] = { name: p.full_name, email: p.email };
    });

    // First, get existing Airtable staff records to map names to record IDs
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

    // Sync each license to Airtable
    let synced = 0;
    let errors = [];

    for (const license of licenses) {
      const provider = providerMap[license.provider_id];
      if (!provider) continue;

      // Find matching staff record in Airtable
      const staffRecordId = staffNameToId[provider.name?.toLowerCase().trim()];

      const fields = {
        'License Type': license.license_type || '',
        'Expiration Date': license.expiration_date || null,
        'Status': license.status || 'active',
        'Internal License ID': license.internal_license_number || '',
        'Reminder 30 Days': license.reminder_30_sent || false,
        'Reminder 14 Days': license.reminder_14_sent || false,
        'Reminder 7 Days': license.reminder_7_sent || false
      };

      // Link to staff member if found
      if (staffRecordId) {
        fields['Staff Member'] = [staffRecordId];
      }

      try {
        // Create new record in Airtable
        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LICENSES_TABLE_ID}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
          }
        );

        if (response.ok) {
          synced++;
        } else {
          const errorData = await response.json();
          errors.push({ license: license.id, error: errorData });
        }
      } catch (err) {
        errors.push({ license: license.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${synced} licenses to Airtable`,
      total: licenses.length,
      synced,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});