import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U';
const OFFICE_CLOSURES_TABLE_ID = 'Office Closures (New)';
const REMINDERS_TABLE_ID = 'tblwtERPFOEwQZmg0';
const ON_CALL_PERIOD_TABLE_ID = 'tbl3o3gNR7ca4rcTW';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    
    if (!isAuthenticated) {
      return Response.json({ error: 'Base44 Session Invalid. Please refresh the page.' }, { status: 401 });
    }

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Fetch ALL reminders from Base44
    const allReminders = await base44.asServiceRole.entities.Reminder.list();
    
    // Helper to identify closures (by type OR by name)
    const isClosure = (r) => {
      const type = r.reminder_type;
      const name = (r.reminder_name || '').toLowerCase();
      return type === 'Holiday' || type === 'Office Closure' || name.includes('office closure');
    };

    // Split into Holiday/Office Closure and general reminders
    const holidayReminders = allReminders.filter(isClosure);
    const otherReminders = allReminders.filter(r => !isClosure(r));
    
    // Fetch On-Call Periods from Airtable to find matching records for linking
    // Fetching all fields to avoid 422 errors if "Start Date" doesn't exist
    const onCallPeriodsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!onCallPeriodsResponse.ok) {
      const error = await onCallPeriodsResponse.text();
      return Response.json({ error: `Airtable Error (On-Call): ${onCallPeriodsResponse.status} ${error}` }, { status: 500 });
    }

    const onCallPeriodsData = await onCallPeriodsResponse.json();
    const onCallPeriods = onCallPeriodsData.records || [];

    // Helper for normalizing keys
    const normalize = (str) => (str || '').toLowerCase().trim();

    // Fetch existing Office Closures from Airtable to prevent duplicates
    const existingClosuresResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OFFICE_CLOSURES_TABLE_ID}?fields%5B%5D=Closure%20Name&fields%5B%5D=Date%20Closed`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!existingClosuresResponse.ok) {
      const error = await existingClosuresResponse.text();
      return Response.json({ error: `Airtable Error (Closures): ${existingClosuresResponse.status} ${error}` }, { status: 500 });
    }

    const existingClosuresData = await existingClosuresResponse.json();
    const existingClosureMap = new Map();
    if (existingClosuresData.records) {
      existingClosuresData.records.forEach(record => {
        const name = record.fields['Closure Name'] || '';
        const date = record.fields['Date Closed'] || '';
        existingClosureMap.set(`${normalize(name)}|${date}`, record.id);
      });
    }

    // Fetch existing Reminders from Airtable to prevent duplicates
    const existingRemindersResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${REMINDERS_TABLE_ID}?fields%5B%5D=Reminder%20Name&fields%5B%5D=Send%20Date`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!existingRemindersResponse.ok) {
      const error = await existingRemindersResponse.text();
      return Response.json({ error: `Airtable Error (Reminders): ${existingRemindersResponse.status} ${error}` }, { status: 500 });
    }

    const existingRemindersData = await existingRemindersResponse.json();
    const existingReminderMap = new Map();
    if (existingRemindersData.records) {
      existingRemindersData.records.forEach(record => {
        const name = record.fields['Reminder Name'] || '';
        const date = record.fields['Send Date'] || '';
        existingReminderMap.set(`${normalize(name)}|${date}`, record.id);
      });
    }

    let closuresSynced = 0;
    let closuresUpdated = 0;
    let remindersSynced = 0;
    let remindersUpdated = 0;
    let errors = [];

    // Sync Holiday reminders to Office Closures table
    for (const reminder of holidayReminders) {
      const closureName = reminder.closure_name || reminder.reminder_name || '';
      const closureDate = reminder.closure_date || '';
      
      const key = `${normalize(closureName)}|${closureDate}`;
      const existingClosureId = existingClosureMap.get(key);
      
      const fields = {};
      if (closureName) fields['Closure Name'] = closureName;
      if (closureDate) fields['Date Closed'] = closureDate;
      
      // Validate Re-Open Date
      if (reminder.reopen_date) {
        // We allow syncing even if re-open date seems invalid (e.g. same or before closure date) 
        // to ensure Airtable receives the data exactly as it is in the app.
        fields['Date Re-Open'] = reminder.reopen_date;
      }

      // 'Email Subject (Smart)' is a computed field in Airtable, so we cannot sync to it.
      // We rely on Airtable's formula to generate the subject from Closure Name, Date Closed, etc.
      // NOTE: If Airtable's formula isn't producing the expected subject, ensure 'Closure Name', 'Date Closed', 'Date Re-Open', and 'Closure Type' are correct.
      
      if (reminder.email_body) fields['Email Body'] = reminder.email_body;
      fields['Enabled'] = reminder.status === 'active';
      
      // Map closure name/type to valid Closure Type options: Holiday, Floating Holiday, Office Closure, Reminder
      if (reminder.reminder_type === 'Office Closure' || (reminder.reminder_name || '').toLowerCase().includes('office closure')) {
        fields['Closure Type'] = 'Office Closure';
      } else if (closureName.toLowerCase().includes('floating')) {
        fields['Closure Type'] = 'Floating Holiday';
      } else {
        fields['Closure Type'] = 'Holiday';
      }

      // Find matching On-Call Period records where closure date falls within the on-call date range
      if (closureDate) {
        const closureDateObj = new Date(closureDate + 'T00:00:00');
        const matchingOnCallIds = onCallPeriods
          .filter(period => {
            // Try common field names for dates
            const startField = period.fields['Start Date'] || period.fields['Start'] || period.fields['Date'] || period.fields['From'];
            const endField = period.fields['End Date'] || period.fields['End'] || period.fields['To'];

            // Exclude if period ends on the closure date (morning handoff at 8am)
            if (endField === closureDate) return false;

            const startDate = startField ? new Date(startField + 'T00:00:00') : null;
            const endDate = endField ? new Date(endField + 'T00:00:00') : null;
            
            if (!startDate || !endDate) return false;
            
            // Check if closure date falls within the period
            return closureDateObj >= startDate && closureDateObj <= endDate;
          })
          .map(period => period.id);
        
        if (matchingOnCallIds.length > 0) {
          fields['On-Call Link'] = matchingOnCallIds;
        }
      }

      try {
        const method = existingClosureId ? 'PATCH' : 'POST';
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OFFICE_CLOSURES_TABLE_ID}${existingClosureId ? '/' + existingClosureId : ''}`;
        
        const response = await fetch(
          url,
          {
            method,
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
          }
        );

        if (response.ok) {
          if (existingClosureId) closuresUpdated++; else closuresSynced++;
        } else {
          const errorData = await response.json();
          errors.push({ table: 'Office Closures', name: closureName, error: errorData });
        }
      } catch (err) {
        errors.push({ table: 'Office Closures', name: closureName, error: err.message });
      }
    }

    // Sync non-Holiday reminders to Reminders table
    for (const reminder of otherReminders) {
      const reminderName = reminder.reminder_name || '';
      const sendDate = reminder.send_date || '';
      
      const key = `${normalize(reminderName)}|${sendDate}`;
      const existingReminderId = existingReminderMap.get(key);
      
      const fields = {};
      if (reminderName) fields['Reminder Name'] = reminderName;
      if (sendDate) fields['Send Date'] = sendDate;
      
      if (reminder.email_subject) fields['Email Subject'] = reminder.email_subject;
      if (reminder.email_body) fields['Message'] = reminder.email_body;
      if (reminder.recipients && reminder.recipients.length > 0) {
        fields['Recipient Email'] = reminder.recipients.join(', ');
      }
      
      // Map frequency to valid Airtable multi-select options: Annually, 90 Days, 60 Days, 30 Days, Monthly
      if (reminder.frequency) {
        const frequencyMap = {
          'yearly': 'Annually',
          'quarterly': '90 Days',
          'monthly': 'Monthly',
          'once': null // Don't set for one-time reminders
        };
        const mappedFrequency = frequencyMap[reminder.frequency];
        if (mappedFrequency) {
          fields['Frequency'] = [mappedFrequency]; // Multi-select requires array
        }
      }
      
      fields['Enabled'] = reminder.status === 'active';

      try {
        const method = existingReminderId ? 'PATCH' : 'POST';
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${REMINDERS_TABLE_ID}${existingReminderId ? '/' + existingReminderId : ''}`;

        const response = await fetch(
          url,
          {
            method,
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
          }
        );

        if (response.ok) {
          if (existingReminderId) remindersUpdated++; else remindersSynced++;
        } else {
          const errorData = await response.json();
          errors.push({ table: 'Reminders', name: reminderName, error: errorData });
        }
      } catch (err) {
        errors.push({ table: 'Reminders', name: reminderName, error: err.message });
      }
    }

    // Build detailed message
    let message = `Office Closures: ${closuresSynced} created, ${closuresUpdated} updated. Reminders: ${remindersSynced} created, ${remindersUpdated} updated`;
    if (errors.length > 0) {
      message += `. ${errors.length} errors: ${errors[0]?.name} - ${JSON.stringify(errors[0]?.error?.error?.message || errors[0]?.error)}`;
    }

    return Response.json({
      success: true,
      message,
      closures: { total: holidayReminders.length, created: closuresSynced, updated: closuresUpdated },
      reminders: { total: otherReminders.length, created: remindersSynced, updated: remindersUpdated },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});