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

    // Fetch holiday reminders from Base44
    const reminders = await base44.asServiceRole.entities.Reminder.filter({ reminder_type: 'Holiday' });

    let synced = 0;
    let errors = [];

    for (const reminder of reminders) {
      // Build fields object - only include non-null values
      const fields = {};
      
      if (reminder.holiday_name || reminder.reminder_name) {
        fields['Holiday Name'] = reminder.holiday_name || reminder.reminder_name;
      }
      
      if (reminder.closure_date) {
        fields['Date Closed'] = reminder.closure_date;
      }
      
      if (reminder.reopen_date) {
        fields['Date Re-Open'] = reminder.reopen_date;
      }
      
      fields['Enabled'] = reminder.status === 'active';
      
      // Add on-call info if available
      if (reminder.oncall_provider_list) {
        fields['On-Call Provider'] = reminder.oncall_provider_list;
      }
      
      if (reminder.oncall_phone_list) {
        fields['On-Call Phone'] = reminder.oncall_phone_list;
      }

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
        } else {
          const errorData = await response.json();
          errors.push({ reminder: reminder.id, error: errorData });
        }
      } catch (err) {
        errors.push({ reminder: reminder.id, error: err.message });
      }
    }

    // Build detailed message including any errors
    let message = `Synced ${synced} of ${reminders.length} office closures to Airtable`;
    if (errors.length > 0) {
      message += `. ${errors.length} errors: ${JSON.stringify(errors[0]?.error)}`;
    }

    return Response.json({
      success: true,
      message,
      total: reminders.length,
      synced,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});