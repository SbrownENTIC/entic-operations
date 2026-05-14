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

async function processRows(rows, headerMap, base44) {
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
     if (!row || row.length === 0) {
       skipped++;
       continue;
     }

     const nameIdx = headerMap['name'];
     const name = (row[nameIdx] !== null && row[nameIdx] !== undefined) ? String(row[nameIdx]).trim() : '';

     if (!name) {
       skipped++;
       continue;
     }

     try {
       const roleIdx = headerMap['role'];
       const benchmarkGroupIdx = headerMap['benchmark_group'];
       const includeInBenchmarkIdx = headerMap['include_in_benchmark'];
       const answerRateIdx = headerMap['expected_answer_rate'];
       const activeIdx = headerMap['active'];

      const role = row[roleIdx] ? String(row[roleIdx]).trim() : '';
      const benchmarkGroup = row[benchmarkGroupIdx] ? String(row[benchmarkGroupIdx]).trim() : 'Other';
      
      let includeInBenchmark = false;
      const benchmarkValue = String(row[includeInBenchmarkIdx] || '').toLowerCase().trim();
      if (['yes', 'true', '1'].includes(benchmarkValue)) {
        includeInBenchmark = true;
      }

      let answerRate = 0.8;
      const rateValue = row[answerRateIdx];
      if (rateValue !== null && rateValue !== undefined && rateValue !== '') {
        const parsedRate = parseFloat(rateValue);
        if (!isNaN(parsedRate)) {
          answerRate = Math.max(0, Math.min(1, parsedRate));
        }
      }

      let active = true;
      const activeValue = String(row[activeIdx] || '').toLowerCase().trim();
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

    let rows = [];

    if (fileType === 'csv') {
      // Parse CSV
      try {
        const csvContent = atob(fileContent);
        rows = parseCSV(csvContent);
      } catch (err) {
        return Response.json({ error: `CSV parsing failed: ${err.message}` }, { status: 400 });
      }
    } else if (fileType === 'xlsx') {
      // Parse Excel
      try {
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
      } catch (err) {
        return Response.json({ error: `Excel parsing failed: ${err.message}` }, { status: 400 });
      }
    } else {
      return Response.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (rows.length < 2) {
      return Response.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Map header row - normalize column names
    const headerRow = rows[0];
    const columnMap = {};
    headerRow.forEach((col, index) => {
      if (col) {
        // Keep original and normalized versions
        const original = String(col).trim();
        const normalized = original.toLowerCase().replace(/[\s_-]/g, '_');
        columnMap[original] = index;
        columnMap[normalized] = index;
      }
    });

    // Map flexible column names to standard names (including common misspellings)
    // Extra columns like Extensions, Location, Daily_Goal, Notes will be ignored
    const requiredFields = {
      'name': ['name', 'Name'],
      'role': ['role', 'Role'],
      'benchmark_group': ['benchmark_group', 'Benchmark_Group', 'benchark_group', 'Benchark_Group', 'benchmark group', 'Benchmark Group', 'benchark group'],
      'include_in_benchmark': ['include_in_benchmark', 'Include_In_Benchmark', 'include in benchmark', 'Include In Benchmark', 'includeinbenchmark'],
      'expected_answer_rate': ['expected_answer_rate', 'Expected_Answer_Rate', 'expected answer rate', 'Expected Answer Rate', 'expectedanswerrate'],
      'active': ['active', 'Active']
    };

    const headers = {};
    for (const [field, aliases] of Object.entries(requiredFields)) {
      for (const alias of aliases) {
        if (columnMap[alias] !== undefined) {
          headers[field] = columnMap[alias];
          break;
        }
      }
    }

    // Validate required fields
    const missingFields = Object.keys(requiredFields).filter(field => headers[field] === undefined);
    if (missingFields.length > 0) {
      return Response.json({
        error: `Missing required columns: ${missingFields.join(', ')}. Expected: Name, Role, Benchmark_Group, Include_In_Benchmark, Expected Answer Rate, Active`
      }, { status: 400 });
    }

    const result = await processRows(rows, headers, base44);

    return Response.json({
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      total: result.created + result.updated + result.skipped,
      errors: result.errors.length > 0 ? result.errors : null,
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message || 'Import failed'
    }, { status: 500 });
  }
});