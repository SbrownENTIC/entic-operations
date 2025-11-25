import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U';
const OFFICE_CLOSURES_TABLE_ID = 'tblIAlRbuaLcHhZkO';

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

    // Fetch ALL reminders from Base44 (not just Holiday type)
    const reminders = await base44.asServiceRole.entities.Reminder.list();
    
    // Fetch existing Airtable records to prevent duplicates
    const existingResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OFFICE_CLOSURES_TABLE_ID}?fields%5B%5D=Holiday%20Name&fields%5B%5D=Date%20Closed`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const existingData = await existingResponse.json();
    const existingKeys = new Set();
    if (existingData.records) {
      existingData.records.forEach(record => {
        const name = record.fields['Holiday Name'] || '';
        const date = record.fields['Date Closed'] || '';
        existingKeys.add(`${name}|${date}`);
      });
    }

    let synced = 0;
    let errors = [];

    let skipped = 0;
    
    for (const reminder of reminders) {
      // Build fields object - only include non-null values
      const fields = {};
      
      const holidayName = reminder.holiday_name || reminder.reminder_name || '';
      const closureDate = reminder.closure_date || '';
      
      // Check for duplicates
      const key = `${holidayName}|${closureDate}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      
      if (holidayName) {
        fields['Holiday Name'] = holidayName;
      }
      
      if (closureDate) {
        fields['Date Closed'] = closureDate;
      }
      
      if (reminder.reopen_date) {
        fields['Date Re-Open'] = reminder.reopen_date;
      }
      
      fields['Enabled'] = reminder.status === 'active';
      
      // Note: On-Call Provider and On-Call Phone are computed fields in Airtable
      // They are populated via linked records, not directly

      try {
        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OFFICE_CLOSURES_TABLE_ID}`,
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
          existingKeys.add(key); // Prevent duplicate in same run
        } else {
          const errorData = await response.json();
          errors.push({ reminder: reminder.id, name: holidayName, error: errorData });
        }
      } catch (err) {
        errors.push({ reminder: reminder.id, name: holidayName, error: err.message });
      }
    }

    // Build detailed message including any errors
    let message = `Synced ${synced} new reminders to Airtable`;
    if (skipped > 0) {
      message += `, skipped ${skipped} duplicates`;
    }
    if (errors.length > 0) {
      message += `. ${errors.length} errors: ${errors[0]?.name} - ${JSON.stringify(errors[0]?.error?.error?.message || errors[0]?.error)}`;
    }

    return Response.json({
      success: true,
      message,
      total: reminders.length,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});