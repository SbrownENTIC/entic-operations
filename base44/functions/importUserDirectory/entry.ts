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

  let users_created = 0;
  let users_updated = 0;
  let extensions_synced = 0;
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
       const locationIdx = headerMap['location'];
       const dailyGoalIdx = headerMap['daily_goal'];
       const benchmarkGroupIdx = headerMap['benchmark_group'];
       const answerRateIdx = headerMap['expected_answer_rate'];
       const includeInBenchmarkIdx = headerMap['include_in_benchmark'];
       const activeIdx = headerMap['active'];
       const extensionIdx = headerMap['extension'];

       const role = (roleIdx !== undefined && row[roleIdx]) ? String(row[roleIdx]).trim() : '';
       const location = (locationIdx !== undefined && row[locationIdx]) ? String(row[locationIdx]).trim() : '';
       const benchmarkGroup = row[benchmarkGroupIdx] ? String(row[benchmarkGroupIdx]).trim() : 'Other';

       let answerRate = 0;
       const rateValue = row[answerRateIdx];
       if (rateValue !== null && rateValue !== undefined && rateValue !== '') {
         const parsedRate = parseFloat(rateValue);
         if (!isNaN(parsedRate)) {
           answerRate = Math.max(0, Math.min(1, parsedRate));
         }
       }

       let dailyGoal = null;
       if (dailyGoalIdx !== undefined && row[dailyGoalIdx]) {
         const parsedGoal = parseFloat(row[dailyGoalIdx]);
         if (!isNaN(parsedGoal) && parsedGoal > 0) {
           dailyGoal = parsedGoal;
         }
       }

       let includeInBenchmark = false;
       if (includeInBenchmarkIdx !== undefined) {
         const benchValue = String(row[includeInBenchmarkIdx] || '').toLowerCase().trim();
         if (['yes', 'true', '1'].includes(benchValue)) {
           includeInBenchmark = true;
         }
       }

       let active = true;
       if (activeIdx !== undefined) {
         const activeValue = String(row[activeIdx] || '').toLowerCase().trim();
         if (['no', 'false', '0'].includes(activeValue)) {
           active = false;
         }
       }

       const userData = {
         name,
         benchmark_group: benchmarkGroup,
         include_in_benchmark: includeInBenchmark,
         active
       };

       if (role) userData.role = role;
       if (location) userData.location = location;
       if (dailyGoal !== null) userData.daily_goal = dailyGoal;
       if (answerRate > 0) userData.expected_answer_rate = answerRate;

      // Get user ID and handle extensions
      let userId;
      const existingUser = userMap[name.toLowerCase()];
      
      // Handle extensions if column exists
      let extensionsArray = [];
      if (extensionIdx !== undefined) {
        const extensionValue = extensionIdx !== undefined && row[extensionIdx] 
          ? String(row[extensionIdx]).trim() 
          : '';
        
        if (extensionValue && extensionValue.length > 0) {
          // Split by comma and trim each extension, treat as strings
          extensionsArray = extensionValue
            .split(',')
            .map(ext => String(ext).trim())
            .filter(ext => ext.length > 0);
        }
      }
      
      // Add extensions to user data
      const finalUserData = { ...userData };
      if (extensionsArray.length > 0) {
        finalUserData.extensions = extensionsArray;
      }

      if (existingUser) {
        await base44.asServiceRole.entities.UserDirectory.update(existingUser.id, finalUserData);
        users_updated++;
        userId = existingUser.id;
      } else {
        const newUser = await base44.asServiceRole.entities.UserDirectory.create(finalUserData);
        users_created++;
        userId = newUser.id;
        userMap[name.toLowerCase()] = newUser;
      }

      // Track extension syncing
      if (extensionsArray.length > 0) {
        extensions_synced++;
      }
    } catch (error) {
      errors.push(`Row ${rowNum}: ${error.message}`);
    }
  }

  return { users_created, users_updated, extensions_synced, skipped, errors };
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
      // Parse Excel using Uint8Array (Deno-compatible, no Buffer)
      try {
        // Decode base64 to binary string, then to Uint8Array
        const binaryString = atob(fileContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          return Response.json({ error: 'Excel file has no sheets' }, { status: 400 });
        }

        // Extract rows as plain arrays, converting ExcelJS Value objects to primitives
        worksheet.eachRow((excelRow) => {
          const rowArray = [];
          excelRow.eachCell((cell) => {
            rowArray.push(cell.value);
          });
          rows.push(rowArray);
        });

        if (rows.length === 0) {
          return Response.json({ error: 'Sheet is empty' }, { status: 400 });
        }
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
    
    // Validate headerRow is an array
    if (!Array.isArray(headerRow)) {
      return Response.json({ error: 'Invalid header row format' }, { status: 400 });
    }

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
    const requiredFields = {
      'name': ['name', 'Name'],
      'benchmark_group': ['benchmark_group', 'Benchmark_Group', 'benchark_group', 'Benchark_Group', 'benchmark group', 'Benchmark Group', 'benchark group'],
      'expected_answer_rate': ['expected_answer_rate', 'Expected_Answer_Rate', 'expected answer rate', 'Expected Answer Rate', 'expectedanswerrate']
    };

    // Optional fields - order matters, more specific names first
    const optionalFields = {
      'role': ['Role', 'role'],
      'location': ['Location', 'location'],
      'daily_goal': ['Daily_Goal', 'daily_goal', 'Daily Goal', 'daily goal'],
      'include_in_benchmark': ['Include_In_Benchmark', 'include_in_benchmark', 'Include In Benchmark', 'include in benchmark'],
      'active': ['Active', 'active'],
      'extension': ['Extensions', 'Extension', 'extensions', 'extension', 'Ext', 'ext', 'Phone_Extension', 'phone_extension']
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

    // Map optional fields
    for (const [field, aliases] of Object.entries(optionalFields)) {
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
        error: `Missing required columns: ${missingFields.join(', ')}. Expected: Name, Benchmark_Group, Expected Answer Rate`
      }, { status: 400 });
    }

    const result = await processRows(rows, headers, base44);

    return Response.json({
      success: true,
      users_created: result.users_created,
      users_updated: result.users_updated,
      extensions_synced: result.extensions_synced,
      skipped: result.skipped,
      total: result.users_created + result.users_updated + result.skipped,
      errors: result.errors.length > 0 ? result.errors : null,
    });
  } catch (error) {
    console.error('Import error:', error);
    return Response.json({
      error: error.message || 'Import failed'
    }, { status: 500 });
  }
});