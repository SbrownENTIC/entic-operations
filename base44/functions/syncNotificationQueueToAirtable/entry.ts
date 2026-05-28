import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SYNC NOTIFICATION QUEUE TO AIRTABLE
 *
 * Syncs Base44 NotificationQueue records (status = "Ready to Send") to a
 * dedicated Airtable table so the existing Airtable/Outlook automation can
 * send the email from Steve.brown@enticmd.com.
 *
 * SETUP REQUIRED (one-time):
 *   In your Airtable base (appwLeODexurgpElt), create a table called
 *   "Notification Queue" with these fields:
 *
 *   Field Name                  | Type
 *   ----------------------------|------------------
 *   Base44 Notification ID      | Single line text  ← used as duplicate key
 *   Notification Type           | Single line text
 *   Closure Type                | Single line text
 *   Location                    | Single line text
 *   Closure Date                | Date
 *   To                          | Single line text
 *   CC                          | Long text
 *   BCC                         | Long text
 *   Subject                     | Single line text
 *   Body                        | Long text
 *   Status                      | Single select     (Draft / Ready to Send / Sent / Failed)
 *   Ready to Send               | Checkbox
 *   Sent Date                   | Date/Time
 *   Sent By                     | Single line text
 *   Error Message               | Long text
 *   Email Provider Message ID   | Single line text
 *   Related Record ID           | Single line text
 *
 *   After creating the table, paste its Table ID into NOTIFICATION_QUEUE_TABLE_ID below.
 *   (Find it in the Airtable URL: airtable.com/appwLeODexurgpElt/tblXXXXXX)
 *
 * AIRTABLE AUTOMATION (set up once in Airtable):
 *   Trigger:  "When record matches conditions"
 *             Status = "Ready to Send"  AND  Ready to Send = checked  AND  Sent Date is empty
 *             Run at: 8:00 AM Eastern daily (schedule the automation in Airtable)
 *   Action 1: Send email via Outlook
 *             From:    Steve.brown@enticmd.com
 *             To:      {To}
 *             CC:      {CC}
 *             BCC:     {BCC}
 *             Subject: {Subject}
 *             Body:    {Body}
 *   Action 2: Update record (same record)
 *             Status     = "Sent"
 *             Ready to Send = unchecked
 *             Sent Date  = now()
 *             Sent By    = "Steve Brown"
 *   On failure: Update record
 *             Status        = "Failed"
 *             Ready to Send = unchecked
 *             Error Message = <error output>
 */

const AIRTABLE_BASE_ID          = 'appwLeODexurgpElt';
const NOTIFICATION_QUEUE_TABLE  = 'Notification Queue'; // Human-readable name for URL encoding

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');

    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    // Optional: pass a specific notification_id to sync just one record
    const { notification_id } = body;

    // ── FETCH BASE44 RECORDS ─────────────────────────────────────────────────
    let queueRecords = [];
    if (notification_id) {
      // Sync a single specific record
      const all = await base44.asServiceRole.entities.NotificationQueue.list();
      const found = (all || []).find(n => n.id === notification_id);
      if (!found) return Response.json({ error: 'NotificationQueue record not found' }, { status: 404 });
      queueRecords = [found];
    } else {
      // Sync all Ready to Send records
      const all = await base44.asServiceRole.entities.NotificationQueue.list();
      queueRecords = (all || []).filter(n =>
        n.status === 'Ready to Send' &&
        n.ready_to_send === true &&
        (!n.sent_date || n.sent_date === null || n.sent_date === '')
      );
    }

    if (queueRecords.length === 0) {
      return Response.json({ success: true, message: 'No records ready to sync.', synced: 0 });
    }

    // ── FETCH EXISTING AIRTABLE RECORDS (for duplicate prevention) ───────────
    const tableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(NOTIFICATION_QUEUE_TABLE)}`;
    const existingResp = await fetch(
      `${tableUrl}?fields%5B%5D=Base44%20Notification%20ID&fields%5B%5D=Status`,
      { headers: { 'Authorization': `Bearer ${airtableApiKey}` } }
    );

    if (!existingResp.ok) {
      const errText = await existingResp.text();
      return Response.json({
        error: `Airtable fetch failed: ${existingResp.status} ${errText}`,
        hint: 'Make sure the "Notification Queue" table exists in your Airtable base. See setup instructions in this function.'
      }, { status: 500 });
    }

    const existingData = await existingResp.json();
    // Map: base44_id → { airtable_record_id, status }
    const existingMap = new Map();
    for (const rec of (existingData.records || [])) {
      const b44id = rec.fields['Base44 Notification ID'];
      if (b44id) {
        existingMap.set(b44id, { airtableId: rec.id, status: rec.fields['Status'] || '' });
      }
    }

    // ── SYNC EACH RECORD ─────────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const n of queueRecords) {
      const existing = existingMap.get(n.id);

      // Skip if already Ready to Send or Sent in Airtable (no duplicate)
      if (existing && (existing.status === 'Ready to Send' || existing.status === 'Sent')) {
        skipped++;
        continue;
      }

      const fields = {
        'Base44 Notification ID':   n.id,
        'Notification Type':        n.notification_type || '',
        'Closure Type':             n.closure_type || '',
        'Location':                 n.location || '',
        'Closure Date':             n.closure_date || '',
        'To':                       n.to || '',
        'CC':                       n.cc || '',
        'BCC':                      n.bcc || '',
        'Subject':                  n.subject || '',
        'Body':                     n.body || '',
        'Status':                   'Ready to Send',
        'Ready to Send':            true,
        'Related Record ID':        n.related_record_id || '',
      };

      // If a Failed record exists, update it to Ready to Send instead of creating a new one
      const method = existing ? 'PATCH' : 'POST';
      const url = existing ? `${tableUrl}/${existing.airtableId}` : tableUrl;

      const resp = await fetch(url, {
        method,
        headers: {
          'Authorization':  `Bearer ${airtableApiKey}`,
          'Content-Type':   'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (resp.ok) {
        created++;
      } else {
        const errData = await resp.json().catch(() => ({}));
        errors.push({ notification_id: n.id, error: errData?.error?.message || resp.status });
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${created} record(s) to Airtable. ${skipped} skipped (already queued/sent). ${errors.length} error(s).`,
      synced: created,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});