import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized. Only admins can upload call logs.' }, { status: 403 });
    }

    const { records, month: payloadMonth } = await req.json();

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Invalid data format. Expected array of records.' }, { status: 400 });
    }

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // If a target month is provided for the whole batch, we can optionally clear old data
    // But safely, we will just upsert based on User + Month
    
    for (const record of records) {
      // Use payload month if record doesn't have it, or override if needed
      const recordMonth = payloadMonth || record.month;

      // Validate required fields
      if (!record.user || !recordMonth) {
        results.errors.push(`Missing required fields (user or month) for record: ${JSON.stringify(record)}`);
        continue;
      }

      // Build filter for existence check
      const filter = {
        user: record.user,
        month: recordMonth
      };
      
      // If week_ending exists, include it in uniqueness check (for legacy/weekly uploads)
      if (record.week_ending) {
        filter.week_ending = record.week_ending;
      }

      // Check for existing record
      const existing = await base44.entities.CallLog.filter(filter);

      const dataToSave = {
        month: recordMonth,
        week_ending: record.week_ending || null, // Optional now
        user: record.user,
        extension: record.extension || '',
        total_calls: Number(record.total_calls) || 0,
        inbound_calls: Number(record.inbound_calls) || 0,
        outbound_calls: Number(record.outbound_calls) || 0,
        answered_calls: Number(record.answered_calls) || 0,
        missed_calls: Number(record.missed_calls) || 0,
        voicemail_calls: Number(record.voicemail_calls) || 0,
        total_duration_minutes: Number(record.total_duration_minutes) || 0,
        inbound_duration_minutes: Number(record.inbound_duration_minutes) || 0,
        outbound_duration_minutes: Number(record.outbound_duration_minutes) || 0
      };

      if (existing.length > 0) {
        // Update existing record (Upsert behavior)
        const idToUpdate = existing[0].id;
        await base44.entities.CallLog.update(idToUpdate, dataToSave);
        results.updated++;
      } else {
        // Create new record
        await base44.entities.CallLog.create(dataToSave);
        results.imported++;
      }
    }

    return Response.json(results);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});