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
      const fields = {
        'Holiday Name': reminder.holiday_name || reminder.reminder_name || '',
        'Closure Type': 'Holiday',
        'Date Closed': reminder.closure_date || null,
        'Date Re-Open': reminder.reopen_date || null,
        'Enabled': reminder.status === 'active'
      };

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

    return Response.json({
      success: true,
      message: `Synced ${synced} office closures to Airtable`,
      total: reminders.length,
      synced,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});