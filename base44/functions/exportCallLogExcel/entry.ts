import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

const tabColors = {
  monthly: 'FF4472C4',
  weekly: 'FFED7D31',
  frontend: 'FFA5A5A5',
  individual: 'FF70AD47',
  directory: 'FFFFC000',
  rawInbound: 'FF5B9BD5',
  rawOutbound: 'FF00B4F0'
};

function formatPercent(value) {
  return typeof value === 'number' ? value : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyData, weeklyData, frontendData, individualData, userDirectory, rawInbound, rawOutbound } = body;

    const workbook = new ExcelJS.Workbook();

    // SHEET 1: Monthly KPI Summary
    const monthlySheet = workbook.addWorksheet('Monthly KPI Summary');
    monthlySheet.tabColor = tabColors.monthly;
    monthlySheet.columns = [
      { header: 'Month', key: 'month', width: 15 },
      { header: 'Total Inbound', key: 'total_inbound', width: 15 },
      { header: 'Total Answered', key: 'total_answered', width: 15 },
      { header: 'Total Missed', key: 'total_missed', width: 15 },
      { header: 'Answer Rate', key: 'answer_rate', width: 15 },
      { header: 'Benchmark Inbound', key: 'benchmark_inbound', width: 18 },
      { header: 'Benchmark Answered', key: 'benchmark_answered', width: 18 },
      { header: 'Benchmark Answer Rate', key: 'benchmark_answer_rate', width: 20 }
    ];
    monthlySheet.getRow(1).font = { bold: true, size: 12 };
    monthlySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    monthlySheet.freezePane = 'A2';
    monthlySheet.autoFilter.from = 'A1';
    monthlySheet.autoFilter.to = 'H1';

    if (monthlyData && Array.isArray(monthlyData)) {
      monthlyData.forEach((row, idx) => {
        const rowNum = idx + 2;
        monthlySheet.addRow(row);
        // Format answer rate columns as percentage formulas
        monthlySheet.getCell(`E${rowNum}`).numFmt = '0.00%';
        monthlySheet.getCell(`H${rowNum}`).numFmt = '0.00%';
      });
    }

    // SHEET 2: Weekly Summary
    const weeklySheet = workbook.addWorksheet('Weekly Summary');
    weeklySheet.tabColor = tabColors.weekly;
    weeklySheet.columns = [
      { header: 'Week Starting', key: 'week_start', width: 15 },
      { header: 'Total Inbound', key: 'total_inbound', width: 15 },
      { header: 'Total Answered', key: 'total_answered', width: 15 },
      { header: 'Total Missed', key: 'total_missed', width: 15 },
      { header: 'Answer Rate', key: 'answer_rate', width: 15 },
      { header: 'Benchmark Inbound', key: 'benchmark_inbound', width: 18 },
      { header: 'Benchmark Answered', key: 'benchmark_answered', width: 18 },
      { header: 'Benchmark Answer Rate', key: 'benchmark_answer_rate', width: 20 }
    ];
    weeklySheet.getRow(1).font = { bold: true, size: 12 };
    weeklySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    weeklySheet.freezePane = 'A2';
    weeklySheet.autoFilter.from = 'A1';
    weeklySheet.autoFilter.to = 'H1';

    if (weeklyData && Array.isArray(weeklyData)) {
      weeklyData.forEach((row, idx) => {
        const rowNum = idx + 2;
        weeklySheet.addRow(row);
        weeklySheet.getCell(`E${rowNum}`).numFmt = '0.00%';
        weeklySheet.getCell(`H${rowNum}`).numFmt = '0.00%';
      });
    }

    // SHEET 3: Front-End Performance (Front Desk only)
    const frontendSheet = workbook.addWorksheet('Front-End Performance');
    frontendSheet.tabColor = tabColors.frontend;
    frontendSheet.columns = [
      { header: 'User', key: 'user_name', width: 25 },
      { header: 'Total Inbound', key: 'total_inbound', width: 15 },
      { header: 'Total Answered', key: 'total_answered', width: 15 },
      { header: 'Answer Rate', key: 'answer_rate', width: 15 },
      { header: 'Expected Rate', key: 'expected_answer_rate', width: 15 },
      { header: 'vs Expected', key: 'vs_expected', width: 15 }
    ];
    frontendSheet.getRow(1).font = { bold: true, size: 12 };
    frontendSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    frontendSheet.freezePane = 'A2';
    frontendSheet.autoFilter.from = 'A1';
    frontendSheet.autoFilter.to = 'F1';

    if (frontendData && Array.isArray(frontendData)) {
      frontendData.forEach((row, idx) => {
        const rowNum = idx + 2;
        frontendSheet.addRow(row);
        frontendSheet.getCell(`D${rowNum}`).numFmt = '0.00%';
        frontendSheet.getCell(`E${rowNum}`).numFmt = '0.00%';
        frontendSheet.getCell(`F${rowNum}`).numFmt = '0.00%';
      });
    }

    // SHEET 4: Individual Performance
    const individualSheet = workbook.addWorksheet('Individual Performance');
    individualSheet.tabColor = tabColors.individual;
    individualSheet.columns = [
      { header: 'User', key: 'user_name', width: 25 },
      { header: 'Group', key: 'benchmark_group', width: 15 },
      { header: 'Benchmark', key: 'include_in_benchmark', width: 12 },
      { header: 'Total Inbound', key: 'total_inbound', width: 15 },
      { header: 'Answered', key: 'total_answered', width: 12 },
      { header: 'Missed', key: 'total_missed', width: 12 },
      { header: 'Answer Rate', key: 'answer_rate', width: 15 },
      { header: 'Total Outbound', key: 'total_outbound', width: 15 },
      { header: 'Avg Duration (sec)', key: 'avg_duration_seconds', width: 18 }
    ];
    individualSheet.getRow(1).font = { bold: true, size: 12 };
    individualSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEEF4' } };
    individualSheet.freezePane = 'A2';
    individualSheet.autoFilter.from = 'A1';
    individualSheet.autoFilter.to = 'I1';

    if (individualData && Array.isArray(individualData)) {
      individualData.forEach((row, idx) => {
        const rowNum = idx + 2;
        individualSheet.addRow(row);
        individualSheet.getCell(`G${rowNum}`).numFmt = '0.00%';
      });
    }

    // SHEET 5: User Directory
    const dirSheet = workbook.addWorksheet('User Directory');
    dirSheet.tabColor = tabColors.directory;
    dirSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Benchmark Group', key: 'benchmark_group', width: 18 },
      { header: 'Include in Benchmark', key: 'include_in_benchmark', width: 20 },
      { header: 'Expected Answer Rate', key: 'expected_answer_rate', width: 20 },
      { header: 'Active', key: 'active', width: 10 }
    ];
    dirSheet.getRow(1).font = { bold: true, size: 12 };
    dirSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
    dirSheet.freezePane = 'A2';
    dirSheet.autoFilter.from = 'A1';
    dirSheet.autoFilter.to = 'F1';

    if (userDirectory && Array.isArray(userDirectory)) {
      userDirectory.forEach((row, idx) => {
        const rowNum = idx + 2;
        dirSheet.addRow(row);
        if (row.expected_answer_rate) {
          dirSheet.getCell(`E${rowNum}`).numFmt = '0.00%';
        }
      });
    }

    // SHEET 6: Raw Inbound Data
    const inboundSheet = workbook.addWorksheet('Raw Inbound Calls');
    inboundSheet.tabColor = tabColors.rawInbound;
    inboundSheet.columns = [
      { header: 'Date', key: 'call_date', width: 12 },
      { header: 'Time', key: 'call_time', width: 10 },
      { header: 'Extension', key: 'extension', width: 12 },
      { header: 'Caller Number', key: 'caller_number', width: 15 },
      { header: 'Duration (sec)', key: 'duration_seconds', width: 15 },
      { header: 'Disposition', key: 'disposition', width: 15 },
      { header: 'Answered', key: 'answered', width: 10 },
      { header: 'Missed', key: 'missed', width: 10 }
    ];
    inboundSheet.getRow(1).font = { bold: true, size: 12 };
    inboundSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
    inboundSheet.freezePane = 'A2';
    inboundSheet.autoFilter.from = 'A1';
    inboundSheet.autoFilter.to = 'H1';

    if (rawInbound && Array.isArray(rawInbound)) {
      rawInbound.forEach(row => {
        inboundSheet.addRow(row);
      });
    }

    // SHEET 7: Raw Outbound Data
    const outboundSheet = workbook.addWorksheet('Raw Outbound Calls');
    outboundSheet.tabColor = tabColors.rawOutbound;
    outboundSheet.columns = [
      { header: 'Date', key: 'call_date', width: 12 },
      { header: 'Time', key: 'call_time', width: 10 },
      { header: 'Extension', key: 'extension', width: 12 },
      { header: 'Dialed Number', key: 'dialed_number', width: 15 },
      { header: 'Duration (sec)', key: 'duration_seconds', width: 15 }
    ];
    outboundSheet.getRow(1).font = { bold: true, size: 12 };
    outboundSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
    outboundSheet.freezePane = 'A2';
    outboundSheet.autoFilter.from = 'A1';
    outboundSheet.autoFilter.to = 'E1';

    if (rawOutbound && Array.isArray(rawOutbound)) {
      rawOutbound.forEach(row => {
        outboundSheet.addRow(row);
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CallLog_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});