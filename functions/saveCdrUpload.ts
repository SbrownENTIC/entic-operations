import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    
    const {
      reporting_period_key,
      period_type,
      period_start,
      period_end,
      original_filename,
      total_rows,
      total_inbound_calls,
      total_inbound_answered,
      total_unanswered,
      mapped_rows,
      unmapped_rows,
      unmapped_extensions,
      userStats
    } = payload;

    // Validate required fields
    if (!reporting_period_key || !period_type || !period_start || !period_end) {
      return Response.json({ 
        error: 'Missing required period fields' 
      }, { status: 400 });
    }

    // Check if CDR upload already exists for this period
    const existing = await base44.entities.CallLogCdrUploads.filter({
      reporting_period_key: reporting_period_key,
      period_type: period_type
    });

    let cdrUploadId;

    if (existing.length > 0) {
      // Update existing
      const existingRecord = existing[0];
      cdrUploadId = existingRecord.id;

      // Delete old user stats for this upload
      await base44.asServiceRole.entities.CallLogCdrUserStats.filter({
        cdr_upload_id: cdrUploadId
      }).then(stats => {
        return Promise.all(stats.map(s => base44.asServiceRole.entities.CallLogCdrUserStats.delete(s.id)));
      }).catch(() => {
        // If no stats exist, that's fine
      });

      // Update the upload record
      await base44.entities.CallLogCdrUploads.update(cdrUploadId, {
        original_filename,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.email,
        total_rows,
        total_inbound_calls,
        total_inbound_answered,
        total_unanswered,
        mapped_rows,
        unmapped_rows,
        unmapped_extensions: unmapped_extensions || []
      });
    } else {
      // Create new
      const newRecord = await base44.entities.CallLogCdrUploads.create({
        reporting_period_key,
        period_type,
        period_start,
        period_end,
        original_filename,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.email,
        total_rows,
        total_inbound_calls,
        total_inbound_answered,
        total_unanswered,
        mapped_rows,
        unmapped_rows,
        unmapped_extensions: unmapped_extensions || []
      });
      cdrUploadId = newRecord.id;
    }

    // Create new user stats records
    if (userStats && Array.isArray(userStats)) {
      const statRecords = userStats.map(stat => ({
        cdr_upload_id: cdrUploadId,
        reporting_period_key,
        period_type,
        period_start,
        period_end,
        user_name: stat.user_name,
        extension: stat.extension,
        location: stat.location,
        inbound_calls: stat.inbound_calls,
        inbound_answered: stat.inbound_answered,
        inbound_unanswered: stat.inbound_unanswered,
        inbound_answer_rate: stat.inbound_answer_rate
      }));

      if (statRecords.length > 0) {
        await base44.entities.CallLogCdrUserStats.bulkCreate(statRecords);
      }
    }

    return Response.json({
      success: true,
      cdr_upload_id: cdrUploadId,
      message: 'CDR data saved successfully'
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});