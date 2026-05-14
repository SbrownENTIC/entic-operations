import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

// Simple CSV parser
function parseCSV(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const rows = [];
  
  for (const line of lines) {
    const cols = [];
    let current = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        cols.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim().replace(/^"|"$/g, ''));
    rows.push(cols);
  }
  
  return rows;
}

async function processRows(rows, headerMap, requiredColumns) {
  const existingUsers = await base44.asServiceRole.entities.UserDirectory.list('', 1000);
  const userMap = {};
  existingUsers.forEach(u => {
    userMap[u.name.toLowerCase()] = u;
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Process each row starting from row 2 (skip header)
  for (let rowNum = 2; rowNum <= rows.length; rowNum++) {
    const row = rows[rowNum - 1];
    const name = row[headerMap['Name']] ? String(row[headerMap['Name']]).trim() : '';

    if (!name) {
      skipped++;
      continue;
    }

    try {
      const role = row[headerMap['Role']] ? String(row[headerMap['Role']]).trim() : '';
      const benchmarkGroup = row[headerMap['Benchmark Group']] ? String(row[headerMap['Benchmark Group']]).trim() : 'Other';
      
      let includeInBenchmark = false;
      const benchmarkValue = String(row[headerMap['Include In Benchmark']] || '').toLowerCase().trim();
      if (['yes', 'true', '1'].includes(benchmarkValue)) {
        includeInBenchmark = true;
      }

      let answerRate = 0.8;
      const rateValue = row[headerMap['Expected Answer Rate']];
      if (rateValue !== null && rateValue !== undefined && rateValue !== '') {
        const parsedRate = parseFloat(rateValue);
        if (!isNaN(parsedRate)) {
          answerRate = Math.max(0, Math.min(1, parsedRate));
        }
      }

      let active = true;
      const activeValue = String(row[headerMap['Active']] || '').toLowerCase().trim();
      if (['no', 'false', '0'].includes(activeValue)) {
        active = false;
      }

      const userData = {
        name,
        role,
        benchmark_group: benchmarkGroup,
        include_in_benchmark: includeInBenchmark,
        expected_answer_rate: answerRate,
        active,
      };

      const existingUser = userMap[name.toLowerCase()];
      if (existingUser) {
        await base44.asServiceRole.entities.UserDirectory.update(existingUser.id, userData);
        updated++;
      } else {
        await base44.asServiceRole.entities.UserDirectory.create(userData);
        created++;
        userMap[name.toLowerCase()] = userData;
      }
    } catch (error) {
      errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }

  return { created, updated, skipped, errors };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fileContent, fileType } = body;

    if (!fileContent) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const requiredColumns = ['Name', 'Role', 'Benchmark Group', 'Include In Benchmark', 'Expected Answer Rate', 'Active'];
    let rows = [];
    let headers = {};

    if (fileType === 'csv') {
      // Parse CSV
      const csvContent = atob(fileContent);
      rows = parseCSV(csvContent);
    } else if (fileType === 'xlsx') {
      // Parse Excel
      const buffer = Buffer.from(fileContent, 'base64');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        return Response.json({ error: 'Excel file has no sheets' }, { status: 400 });
      }

      // Extract rows from worksheet
      worksheet.eachRow({ header: 1 }, (row) => {
        rows.push(row || []);
      });
    } else {
      return Response.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (rows.length < 2) {
      return Response.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Map header row
    const headerRow = rows[0];
    headerRow.forEach((col, index) => {
      if (col) {
        headers[String(col).trim()] = index;
      }
    });

    // Validate required columns
    const missingColumns = requiredColumns.filter(col => headers[col] === undefined);
    if (missingColumns.length > 0) {
      return Response.json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      }, { status: 400 });
    }

    const result = await processRows(rows, headers, requiredColumns);

    return Response.json({
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      total: result.created + result.updated + result.skipped,
      errors: result.errors.length > 0 ? result.errors : null,
    });
  } catch (error) {
    return Response.json({
      error: error.message || 'Import failed'
    }, { status: 500 });
  }
});