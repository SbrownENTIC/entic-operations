import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized. Only admins can upload call logs.' }, { status: 403 });
    }

    const { records } = await req.json();

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Invalid data format. Expected array of records.' }, { status: 400 });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const record of records) {
      // Validate required fields
      if (!record.user || !record.week_ending || !record.month) {
        results.errors.push(`Missing required fields for record: ${JSON.stringify(record)}`);
        continue;
      }

      // Check for duplicates (same user + week_ending)
      const existing = await base44.entities.CallLog.filter({
        user: record.user,
        week_ending: record.week_ending
      });

      if (existing.length > 0) {
        results.skipped++;
        continue;
      }

      // Create record
      await base44.entities.CallLog.create({
        month: record.month,
        week_ending: record.week_ending,
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
      });

      results.imported++;
    }

    return Response.json(results);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});