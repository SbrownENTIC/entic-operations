import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all call log period records
    const allRecords = await base44.entities.CallLogPeriod.list(undefined, 1000);

    if (!allRecords || allRecords.length === 0) {
      return Response.json({ 
        message: 'No records to migrate',
        totalRecords: 0,
        validatedRecords: 0,
        fixedRecords: 0
      });
    }

    const results = {
      totalRecords: allRecords.length,
      validatedRecords: 0,
      fixedRecords: 0,
      errors: [],
      details: []
    };

    // Validate and normalize each record
    for (const record of allRecords) {
      const startDate = record.reporting_period_start;
      const endDate = record.reporting_period_end;

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const startValid = dateRegex.test(startDate);
      const endValid = dateRegex.test(endDate);

      if (startValid && endValid) {
        // Validate that dates are valid calendar dates
        const startTime = new Date(startDate + 'T00:00:00');
        const endTime = new Date(endDate + 'T00:00:00');

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          results.errors.push({
            recordId: record.id,
            issue: 'Invalid calendar dates',
            startDate,
            endDate
          });
          continue;
        }

        // Check date order
        if (startTime > endTime) {
          results.errors.push({
            recordId: record.id,
            issue: 'Start date is after end date',
            startDate,
            endDate
          });
          continue;
        }

        results.validatedRecords++;
        results.details.push({
          recordId: record.id,
          user: record.user,
          startDate,
          endDate,
          status: 'valid'
        });
      } else {
        // Try to fix malformed dates
        let fixedStart = startDate;
        let fixedEnd = endDate;

        // Remove quotes if present
        if (typeof fixedStart === 'string') {
          fixedStart = fixedStart.replace(/^"|"$/g, '').trim();
        }
        if (typeof fixedEnd === 'string') {
          fixedEnd = fixedEnd.replace(/^"|"$/g, '').trim();
        }

        // Check again after cleaning
        if (dateRegex.test(fixedStart) && dateRegex.test(fixedEnd)) {
          const startTime = new Date(fixedStart + 'T00:00:00');
          const endTime = new Date(fixedEnd + 'T00:00:00');

          if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime()) && startTime <= endTime) {
            // Update the record
            await base44.entities.CallLogPeriod.update(record.id, {
              reporting_period_start: fixedStart,
              reporting_period_end: fixedEnd
            });

            results.fixedRecords++;
            results.details.push({
              recordId: record.id,
              user: record.user,
              original: { startDate, endDate },
              fixed: { startDate: fixedStart, endDate: fixedEnd },
              status: 'fixed'
            });
            continue;
          }
        }

        // Could not fix
        results.errors.push({
          recordId: record.id,
          issue: 'Could not parse or fix date format',
          startDate,
          endDate
        });
      }
    }

    return Response.json({
      message: 'Migration validation complete',
      ...results
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});