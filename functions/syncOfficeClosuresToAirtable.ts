import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U';
const OFFICE_CLOSURES_TABLE_ID = 'tblIAlRbuaLcHhZkO';
const REMINDERS_TABLE_ID = 'tblwtERPFOEwQZmg0';

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

    // Fetch ALL reminders from Base44
    const allReminders = await base44.asServiceRole.entities.Reminder.list();
    
    // Split into Holiday (office closures) and non-Holiday (general reminders)
    const holidayReminders = allReminders.filter(r => r.reminder_type === 'Holiday');
    const otherReminders = allReminders.filter(r => r.reminder_type !== 'Holiday');
    
    // Fetch existing Office Closures from Airtable to prevent duplicates
    const existingClosuresResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${OFFICE_CLOSURES_TABLE_ID}?fields%5B%5D=Holiday%20Name&fields%5B%5D=Date%20Closed`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const existingClosuresData = await existingClosuresResponse.json();
    const existingClosureKeys = new Set();
    if (existingClosuresData.records) {
      existingClosuresData.records.forEach(record => {
        const name = record.fields['Holiday Name'] || '';
        const date = record.fields['Date Closed'] || '';
        existingClosureKeys.add(`${name}|${date}`);
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
    const existingRemindersData = await existingRemindersResponse.json();
    const existingReminderKeys = new Set();
    if (existingRemindersData.records) {
      existingRemindersData.records.forEach(record => {
        const name = record.fields['Reminder Name'] || '';
        const date = record.fields['Send Date'] || '';
        existingReminderKeys.add(`${name}|${date}`);
      });
    }

    let closuresSynced = 0;
    let closuresSkipped = 0;
    let remindersSynced = 0;
    let remindersSkipped = 0;
    let errors = [];

    // Sync Holiday reminders to Office Closures table
    for (const reminder of holidayReminders) {
      const holidayName = reminder.holiday_name || reminder.reminder_name || '';
      const closureDate = reminder.closure_date || '';
      
      const key = `${holidayName}|${closureDate}`;
      if (existingClosureKeys.has(key)) {
        closuresSkipped++;
        continue;
      }
      
      const fields = {};
      if (holidayName) fields['Holiday Name'] = holidayName;
      if (closureDate) fields['Date Closed'] = closureDate;
      if (reminder.reopen_date) fields['Date Re-Open'] = reminder.reopen_date;
      fields['Enabled'] = reminder.status === 'active';
      fields['Closure Type'] = holidayName; // Set closure type

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
          closuresSynced++;
          existingClosureKeys.add(key);
        } else {
          const errorData = await response.json();
          errors.push({ table: 'Office Closures', name: holidayName, error: errorData });
        }
      } catch (err) {
        errors.push({ table: 'Office Closures', name: holidayName, error: err.message });
      }
    }

    // Sync non-Holiday reminders to Reminders table
    for (const reminder of otherReminders) {
      const reminderName = reminder.reminder_name || '';
      const sendDate = reminder.send_date || '';
      
      const key = `${reminderName}|${sendDate}`;
      if (existingReminderKeys.has(key)) {
        remindersSkipped++;
        continue;
      }
      
      const fields = {};
      if (reminderName) fields['Reminder Name'] = reminderName;
      if (sendDate) fields['Send Date'] = sendDate;
      if (reminder.email_subject) fields['Email Subject'] = reminder.email_subject;
      if (reminder.frequency) fields['Frequency'] = reminder.frequency;
      fields['Enabled'] = reminder.status === 'active';

      try {
        const response = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${REMINDERS_TABLE_ID}`,
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
          remindersSynced++;
          existingReminderKeys.add(key);
        } else {
          const errorData = await response.json();
          errors.push({ table: 'Reminders', name: reminderName, error: errorData });
        }
      } catch (err) {
        errors.push({ table: 'Reminders', name: reminderName, error: err.message });
      }
    }

    // Build detailed message
    let message = `Office Closures: ${closuresSynced} synced, ${closuresSkipped} skipped. Reminders: ${remindersSynced} synced, ${remindersSkipped} skipped`;
    if (errors.length > 0) {
      message += `. ${errors.length} errors: ${errors[0]?.name} - ${JSON.stringify(errors[0]?.error?.error?.message || errors[0]?.error)}`;
    }

    return Response.json({
      success: true,
      message,
      closures: { total: holidayReminders.length, synced: closuresSynced, skipped: closuresSkipped },
      reminders: { total: otherReminders.length, synced: remindersSynced, skipped: remindersSkipped },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});