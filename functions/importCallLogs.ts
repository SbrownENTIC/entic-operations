import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

export default Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized. Only admins can upload call logs.' }, { status: 403 });
    }

    const { records, startDate, endDate, fileName, detectionType } = await req.json();

    if (!startDate || !endDate) {
        return Response.json({ error: 'Start date and end date are required.' }, { status: 400 });
    }

    // Validate dates are valid calendar dates
    const isValidDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && 
               date.getMonth() === month - 1 && 
               date.getDate() === day;
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return Response.json({ error: 'Invalid calendar date.' }, { status: 400 });
    }

    // Log auto-detect
    if (detectionType === 'auto') {
        console.log(`[AUTO-DETECT] Dates auto-detected from filename: ${startDate} to ${endDate}`);
    } else {
        console.log(`[MANUAL-ENTRY] Dates manually entered: ${startDate} to ${endDate}`);
    }

    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Invalid data format. Expected array of records.' }, { status: 400 });
    }

    // Insert new records
    // Dedup by user in the incoming batch
    const uniqueRecords = {};
    const skippedUsers = []; // Duplicates in the file
    const skippedDbDuplicates = []; // Duplicates in DB

    for (const record of records) {
        if (!record.user) continue;
        
        if (uniqueRecords[record.user]) {
            skippedUsers.push(record.user);
            continue;
        }

        uniqueRecords[record.user] = {
            reporting_period_start: startDate,
            reporting_period_end: endDate,
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
            uploaded_by: user.email,
            source_file_name: fileName || '',
            period_detection_type: detectionType || 'manual'
        };
    }

    // Check against DB for duplicates (same user, same period)
    const recordsToInsert = [];
    
    // We can't efficiently check all in one query if there are many users, but we can check by period
    // Since this is per-file upload, checking by period should be fine
    const existingInPeriod = await base44.entities.CallLogPeriod.filter({
        reporting_period_start: startDate,
        reporting_period_end: endDate
    }, {}, 1000);

    const existingUsersSet = new Set(existingInPeriod.map(r => r.user));

    for (const record of Object.values(uniqueRecords)) {
        if (existingUsersSet.has(record.user)) {
            skippedDbDuplicates.push(record.user);
        } else {
            recordsToInsert.push(record);
        }
    }
    
    if (recordsToInsert.length > 0) {
        await base44.entities.CallLogPeriod.bulkCreate(recordsToInsert);
        console.log(`[IMPORT] Successfully imported ${recordsToInsert.length} records for period ${startDate} to ${endDate}`);
    }

    return Response.json({
      imported: recordsToInsert.length,
      skipped: skippedUsers.length + skippedDbDuplicates.length,
      db_duplicates: skippedDbDuplicates.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});