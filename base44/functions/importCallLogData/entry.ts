import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Parse duration string (MM:SS or HH:MM:SS) to seconds
 */
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  const parts = String(durationStr).split(':').map(p => parseInt(p, 10));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
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
  // Try destination device first (may contain extension)
  if (destinationDeviceField && /^\d{3,4}$/.test(String(destinationDeviceField).trim())) {
    return String(destinationDeviceField).trim();
  }
  // Extract from To field if it's a short number
  const toStr = String(toField || '').trim();
  if (/^\d{3,4}$/.test(toStr)) return toStr;
  // Return as-is if looks like extension
  return toStr;
}

/**
 * Parse CSV content into array of objects
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim());

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record);
  }

  return records;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file, type, inboundData, outboundData } = body;

    let inboundCreated = 0;
    let outboundCreated = 0;
    let unmappedExtensions = new Set();

    // Fetch existing extensions for mapping
    const extensions = await base44.asServiceRole.entities.UserExtensions.list('-updated_date', 1000);
    const extMap = {};
    extensions.forEach(ext => {
      extMap[ext.extension] = ext.user_id;
    });

    // Handle file-based upload
    if (file && type) {
      let records;
      try {
        records = parseCSV(file);
      } catch (error) {
        return Response.json({
          error: `CSV parsing failed: ${error.message}`
        }, { status: 400 });
      }

      if (!records.length) {
        return Response.json({
          error: 'CSV file is empty or contains no valid records'
        }, { status: 400 });
      }

      if (type === 'inbound') {
        const inboundRecords = records.map(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const disposition = row['Result'] || '';
          const answered = disposition.toLowerCase().includes('answered');
          const missed = disposition.toLowerCase().includes('missed');

          if (!extMap[ext]) {
            unmappedExtensions.add(ext);
          }

          return {
            call_date: date,
            call_time: time,
            extension: ext,
            caller_number: row['From'] || '',
            duration_seconds: duration,
            disposition: disposition,
            answered: answered,
            missed: missed
          };
        });

        if (inboundRecords.length > 0) {
          await base44.asServiceRole.entities.InboundCallRaw.bulkCreate(inboundRecords);
          inboundCreated = inboundRecords.length;
        }
      } else if (type === 'outbound') {
        const outboundRecords = records.map(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const result = (row['Result'] || '').toLowerCase();

          if (!extMap[ext]) {
            unmappedExtensions.add(ext);
          }

          return {
            call_date: date,
            call_time: time,
            extension: ext,
            dialed_number: row['To'] || '',
            duration_seconds: duration,
            result: result,
            location: row['Location'] || ''
          };
        });

        if (outboundRecords.length > 0) {
          await base44.asServiceRole.entities.OutboundCallRaw.bulkCreate(outboundRecords);
          outboundCreated = outboundRecords.length;
        }
      }
    } else {
      // Legacy batch import support
      // Import inbound calls
      if (inboundData && Array.isArray(inboundData)) {
        const inboundRecords = inboundData.map(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const disposition = row['Result'] || '';
          const answered = disposition.toLowerCase().includes('answered');
          const missed = disposition.toLowerCase().includes('missed');

          if (!extMap[ext]) {
            unmappedExtensions.add(ext);
          }

          return {
            call_date: date,
            call_time: time,
            extension: ext,
            caller_number: row['From'] || '',
            duration_seconds: duration,
            disposition: disposition,
            answered: answered,
            missed: missed
          };
        });

        if (inboundRecords.length > 0) {
          await base44.asServiceRole.entities.InboundCallRaw.bulkCreate(inboundRecords);
          inboundCreated = inboundRecords.length;
        }
      }

      // Import outbound calls
      if (outboundData && Array.isArray(outboundData)) {
        const outboundRecords = outboundData.map(row => {
          const { date, time } = parseDateTime(row['Date/Time'] || '');
          const ext = extractExtension(row['To'], row['From'], row['Destination Device']);
          const duration = parseDuration(row['Duration']);
          const result = (row['Result'] || '').toLowerCase();

          if (!extMap[ext]) {
            unmappedExtensions.add(ext);
          }

          return {
            call_date: date,
            call_time: time,
            extension: ext,
            dialed_number: row['To'] || '',
            duration_seconds: duration,
            result: result,
            location: row['Location'] || ''
          };
        });

        if (outboundRecords.length > 0) {
          await base44.asServiceRole.entities.OutboundCallRaw.bulkCreate(outboundRecords);
          outboundCreated = outboundRecords.length;
        }
      }
    }

    return Response.json({
      success: true,
      created: inboundCreated + outboundCreated,
      inboundCreated,
      outboundCreated,
      unmappedExtensions: Array.from(unmappedExtensions)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});