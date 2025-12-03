import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U'; // Base ID for ENTIC
const NOTIFICATIONS_TABLE = 'Notifications';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Ensure authenticated context if called from frontend
    const user = await base44.auth.me();
    // For scheduled reminders (cron), this might be called with service role, so user check is soft
    
    const { recipient, subject, body, from_name, reminder_name, reminder_type, send_date } = await req.json();

    if (!recipient || !subject || !body) {
      return Response.json({ error: 'Missing required fields: recipient, subject, body' }, { status: 400 });
    }

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Prepare Airtable Record Fields
    const fields = {
        "Recipient": recipient,
        "Subject": subject,
        "Body": body,
        "From Name": from_name || 'ENTIC Operations Team',
        "Reminder Name": reminder_name || 'N/A',
        "Reminder Type": reminder_type || 'Custom',
        "Send Date": send_date || new Date().toISOString().split('T')[0],
        "Status": "Pending Email Send"
    };

    // Create record in Airtable
    const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(NOTIFICATIONS_TABLE)}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Airtable Error: ${JSON.stringify(errorData)}`);
    }

    return Response.json({ success: true, message: "Reminder synced to Airtable successfully" });

  } catch (error) {
    console.error('Error syncing reminder to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});