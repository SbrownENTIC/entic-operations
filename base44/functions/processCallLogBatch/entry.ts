import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Parse duration string (HH:MM:SS, MM:SS, or blank) to seconds
 */
function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    return 0;
  }

  const trimmed = durationStr.trim();
  if (trimmed === '') {
    return 0;
  }

  const parts = trimmed.split(':');
  
  // HH:MM:SS format
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  
  // MM:SS format
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    if (isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (minutes * 60) + seconds;
  }
  
  return 0;
}

/**
 * Parse date/time from format like "5/8/26 23:55"
 */
function parseDateTime(dateTimeStr) {
  try {
    const [datePart, timePart] = dateTimeStr.split(' ');
    const [m, d, y] = datePart.split('/');
    const year = 2000 + parseInt(y, 10);
    const month = String(parseInt(m, 10)).padStart(2, '0');
    const day = String(parseInt(d, 10)).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: timePart || '00:00'
    };
  } catch {
    return { date: '2026-05-01', time: '00:00' };
  }
}

/**
 * Extract extension from phone number or field
 */
function extractExtension(toField, fromField, destinationDeviceField) {
  if (destinationDeviceField && /^\d{3,4}$/.test(String(destinationDeviceField).trim())) {
    return String(destinationDeviceField).trim();
  }
  const toStr = String(toField || '').trim();
  if (/^\d{3,4}$/.test(toStr)) return toStr;
  return toStr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { importJobId } = body;

    if (!importJobId) {
      return Response.json({ error: 'Missing importJobId' }, { status: 400 });
    }

    // Fetch the import job
    const job = await base44.asServiceRole.entities.ImportJob.get(importJobId);
    if (!job) {
      return Response.json({ error: 'ImportJob not found' }, { status: 404 });
    }

    // If already complete or error, skip
    if (job.status === 'complete' || job.status === 'error') {
      return Response.json({ success: true, status: job.status, processedRows: job.processed_rows });
    }

    try {
      // Parse stored CSV data
      const rows = JSON.parse(job.csv_data);
      const batchSize = job.batch_size || 1000;
      const startIdx = job.processed_rows;
      const endIdx = Math.min(startIdx + batchSize, rows.length);

      if (startIdx >= rows.length) {
        // Already completed
        await base44.asServiceRole.entities.ImportJob.update(importJobId, {
          status: 'complete',
          completed_at: new Date().toISOString(),
          processed_rows: rows.length
        });
        return Response.json({ success: true, status: 'complete', processedRows: rows.length });
      }

      // Fetch extensions for mapping
      const extensions = await base44.asServiceRole.entities.UserExtensions.list('-updated_date', 1000);
      const extMap = {};
      extensions.forEach(ext => {
        extMap[ext.extension] = ext.user_id;
      });

      // Process batch
      const batchRows = rows.slice(startIdx, endIdx);
      const recordsToInsert = [];

      if (job.type === 'inbound') {
        batchRows.forEach(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const disposition = row['Result'] || '';
          const answered = disposition.toLowerCase().includes('answered');
          const missed = disposition.toLowerCase().includes('missed');

          recordsToInsert.push({
            call_date: date,
            call_time: time,
            extension: ext,
            caller_number: row['From'] || '',
            duration_seconds: duration,
            disposition: disposition,
            answered: answered,
            missed: missed
          });
        });

        if (recordsToInsert.length > 0) {
          await base44.asServiceRole.entities.InboundCallRaw.bulkCreate(recordsToInsert);
        }
      } else if (job.type === 'outbound') {
        batchRows.forEach(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const result = (row['Result'] || '').toLowerCase();

          recordsToInsert.push({
            call_date: date,
            call_time: time,
            extension: ext,
            dialed_number: row['To'] || '',
            duration_seconds: duration,
            result: result,
            location: row['Location'] || ''
          });
        });

        if (recordsToInsert.length > 0) {
          await base44.asServiceRole.entities.OutboundCallRaw.bulkCreate(recordsToInsert);
        }
      }

      // Update job progress
      const newProcessedRows = endIdx;
      const isComplete = endIdx >= rows.length;

      await base44.asServiceRole.entities.ImportJob.update(importJobId, {
        processed_rows: newProcessedRows,
        status: isComplete ? 'complete' : 'processing',
        completed_at: isComplete ? new Date().toISOString() : null
      });

      // If more rows remain, trigger next batch
      if (!isComplete) {
        // Invoke self for next batch
        setTimeout(() => {
          base44.functions.invoke('processCallLogBatch', { importJobId }).catch(err => {
            console.error('Error triggering next batch:', err);
          });
        }, 100);
      }

      return Response.json({
        success: true,
        processedRows: newProcessedRows,
        totalRows: rows.length,
        isComplete,
        batchSize: batchSize
      });
    } catch (error) {
      // Mark job as error
      await base44.asServiceRole.entities.ImportJob.update(importJobId, {
        status: 'error',
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});