import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized. Only admins can upload call logs.' }, { status: 403 });
    }

    const { records, month } = await req.json();

    if (!month) {
        return Response.json({ error: 'Month is required.' }, { status: 400 });
    }

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Invalid data format. Expected array of records.' }, { status: 400 });
    }

    // 1. Delete existing records for this month
    // Fetch IDs first
    // Since we might have many records, we need to be careful. But usually < 100 users.
    const existing = await base44.entities.CallLog.filter({ month }, {}, 1000);
    
    // Delete in parallel
    await Promise.all(existing.map(r => base44.entities.CallLog.delete(r.id)));

    // 2. Insert new records
    // Dedup by user in the incoming batch (last one wins or first one? User said "Reject duplicate user entries")
    const uniqueRecords = {};
    const skippedUsers = [];

    for (const record of records) {
        if (!record.user) continue;
        
        if (uniqueRecords[record.user]) {
            skippedUsers.push(record.user);
            continue;
        }

        uniqueRecords[record.user] = {
            month: month,
            user: record.user,
            extension: record.extension || '',
            total_calls: Number(record.total_calls) || 0,
            inbound_calls: Number(record.inbound_calls) || 0,
            outbound_calls: Number(record.outbound_calls) || 0,
            answered_calls: Number(record.answered_calls) || 0,
            missed_calls: Number(record.missed_calls) || 0,
            voicemail_calls: Number(record.voicemail_calls) || 0,
            total_duration_seconds: Number(record.total_duration_seconds) || 0,
            inbound_duration_seconds: Number(record.inbound_duration_seconds) || 0,
            outbound_duration_seconds: Number(record.outbound_duration_seconds) || 0,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.email
        };
    }

    const recordsToCreate = Object.values(uniqueRecords);
    
    // Batch create if possible, or parallel create
    // base44 sdk usually supports create one by one.
    // If bulkCreate exists use it, otherwise Promise.all
    // Assuming we don't have bulkCreate explicitly documented in my instructions but typically it's create_entity_records tool which is for me, not SDK.
    // The SDK instructions say: base44.entities.Todo.bulkCreate(...)
    
    if (recordsToCreate.length > 0) {
        await base44.entities.CallLog.bulkCreate(recordsToCreate);
    }

    return Response.json({
      imported: recordsToCreate.length,
      skipped: skippedUsers.length,
      deleted_old_records: existing.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});