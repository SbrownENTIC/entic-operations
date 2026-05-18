import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Parse duration string (HH:MM:SS, MM:SS, or blank) to seconds
 * Supports Vonage format: 0:02:28, 0:00:00, blank/null
 */
function parseDuration(durationStr) {
  // Handle null, undefined, or blank
  if (!durationStr || typeof durationStr !== 'string') {
    return 0;
  }

  const trimmed = durationStr.trim();
  
  // Handle empty string
  if (trimmed === '') {
    return 0;
  }

  const parts = trimmed.split(':');
  
  // HH:MM:SS format (3 parts)
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    
    // Validate all parts parsed successfully
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  
  // MM:SS format (2 parts)
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    // Validate both parts parsed successfully
    if (isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }
    
    return (minutes * 60) + seconds;
  }
  
  // Invalid format
  return 0;
}

/**
 * Parse date/time from:
 *  - "5/8/26 23:55"           (M/D/YY 24h)
 *  - "05/16/2026 10:22:50 PM" (MM/DD/YYYY 12h with AM/PM)
 */
function parseDateTime(dateTimeStr) {
  try {
    const parts = dateTimeStr.trim().split(' ');
    const datePart = parts[0];
    // Combine remaining parts as time (could be "10:22:50 PM" → two tokens)
    const timePart = parts.slice(1).join(' ');
    const [m, d, y] = datePart.split('/');
    const yInt = parseInt(y, 10);
    // If year is already 4 digits (e.g. 2026) use as-is, otherwise treat as 2-digit
    const year = yInt > 999 ? yInt : 2000 + yInt;
    const month = String(parseInt(m, 10)).padStart(2, '0');
    const day = String(parseInt(d, 10)).padStart(2, '0');
    // Strip AM/PM and keep HH:MM
    const timeClean = timePart.replace(/\s*(AM|PM)$/i, '').trim().substring(0, 5);
    return {
      date: `${year}-${month}-${day}`,
      time: timeClean || '00:00'
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
 * Handles quoted fields and comma-separated values
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { file, type } = body;

    if (!file || !type) {
      return Response.json({
        error: 'Missing file or type parameter'
      }, { status: 400 });
    }

    // Parse CSV
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

    // Create ImportJob to track progress
    const importJob = await base44.asServiceRole.entities.ImportJob.create({
      type: type,
      total_rows: records.length,
      processed_rows: 0,
      status: 'parsing',
      started_at: new Date().toISOString(),
      csv_data: JSON.stringify(records),
      batch_size: 1000
    });

    // Trigger background batch processing
    try {
      await base44.asServiceRole.functions.invoke('processCallLogBatch', {
        importJobId: importJob.id
      });
    } catch (err) {
      console.error('Error triggering batch processing:', err);
    }

    return Response.json({
      success: true,
      importJobId: importJob.id,
      totalRows: records.length,
      status: 'processing'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});