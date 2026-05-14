import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fileContent } = body;

    if (!fileContent) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Parse Excel file
    const buffer = Buffer.from(fileContent, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return Response.json({ error: 'Excel file has no sheets' }, { status: 400 });
    }

    // Get header row
    const headerRow = worksheet.getRow(1);
    const headers = {};
    const requiredColumns = ['Name', 'Role', 'Benchmark Group', 'Include In Benchmark', 'Expected Answer Rate', 'Active'];

    headerRow.eachCell((cell, colNumber) => {
      headers[cell.value] = colNumber;
    });

    // Validate required columns
    const missingColumns = requiredColumns.filter(col => !headers[col]);
    if (missingColumns.length > 0) {
      return Response.json({
        error: `Missing required columns: ${missingColumns.join(', ')}`
      }, { status: 400 });
    }

    // Fetch existing users
    const existingUsers = await base44.asServiceRole.entities.UserDirectory.list('', 1000);
    const userMap = {};
    existingUsers.forEach(u => {
      userMap[u.name.toLowerCase()] = u;
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process each row
    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const nameCell = row.getCell(headers['Name']);
      const name = nameCell.value ? String(nameCell.value).trim() : '';

      // Skip blank rows
      if (!name) {
        skipped++;
        continue;
      }

      try {
        const roleCell = row.getCell(headers['Role']);
        const benchmarkGroupCell = row.getCell(headers['Benchmark Group']);
        const includeInBenchmarkCell = row.getCell(headers['Include In Benchmark']);
        const answerRateCell = row.getCell(headers['Expected Answer Rate']);
        const activeCell = row.getCell(headers['Active']);

        // Parse values
        const role = roleCell.value ? String(roleCell.value).trim() : '';
        const benchmarkGroup = benchmarkGroupCell.value ? String(benchmarkGroupCell.value).trim() : 'Other';
        
        // Parse boolean for Include In Benchmark
        let includeInBenchmark = false;
        const benchmarkValue = String(includeInBenchmarkCell.value || '').toLowerCase().trim();
        if (['yes', 'true', '1'].includes(benchmarkValue)) {
          includeInBenchmark = true;
        }

        // Parse Expected Answer Rate
        let answerRate = 0.8;
        const rateValue = answerRateCell.value;
        if (rateValue !== null && rateValue !== undefined) {
          const parsedRate = parseFloat(rateValue);
          if (!isNaN(parsedRate)) {
            answerRate = Math.max(0, Math.min(1, parsedRate));
          }
        }

        // Parse boolean for Active
        let active = true;
        const activeValue = String(activeCell.value || '').toLowerCase().trim();
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

        // Check if user exists (case-insensitive)
        const existingUser = userMap[name.toLowerCase()];
        if (existingUser) {
          // Update existing user
          await base44.asServiceRole.entities.UserDirectory.update(existingUser.id, userData);
          updated++;
        } else {
          // Create new user
          await base44.asServiceRole.entities.UserDirectory.create(userData);
          created++;
          userMap[name.toLowerCase()] = userData;
        }
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      created,
      updated,
      skipped,
      total: created + updated + skipped,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (error) {
    return Response.json({
      error: error.message || 'Import failed'
    }, { status: 500 });
  }
});