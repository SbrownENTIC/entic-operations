import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

const tabColors = {
  monthly: 'FF4472C4',
  weekly: 'FFED7D31',
  individual: 'FF70AD47',
  frontend: 'FFA5A5A5',
  directory: 'FFFFC000',
  rawData: 'FF5B9BD5'
};

function addTitleRow(sheet, title) {
  const row = sheet.addRow([title]);
  row.font = { bold: true, size: 14 };
  row.alignment = { horizontal: 'left', vertical: 'center' };
  sheet.mergeCells(`A${sheet.lastRow.number}:K${sheet.lastRow.number}`);
  return sheet.lastRow.number + 1;
}

function addSubtitleRow(sheet, subtitle) {
  const row = sheet.addRow([subtitle]);
  row.font = { size: 11 };
  sheet.mergeCells(`A${sheet.lastRow.number}:K${sheet.lastRow.number}`);
  return sheet.lastRow.number + 1;
}

function formatAsPercent(sheet, rowNum, colLetter, value) {
  const cell = sheet.getCell(`${colLetter}${rowNum}`);
  cell.value = value;
  cell.numFmt = '0.00%';
}

function applyHeaderFormatting(sheet, headerRowNum, columnCount) {
  const headerRow = sheet.getRow(headerRowNum);
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
  for (let i = 1; i <= columnCount; i++) {
    headerRow.getCell(i).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }
}

function applyTotalsFormatting(sheet, rowNum, columnCount) {
  const totalsRow = sheet.getRow(rowNum);
  totalsRow.font = { bold: true };
  totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
  for (let i = 1; i <= columnCount; i++) {
    totalsRow.getCell(i).border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' }
    };
  }
}

function applyConditionalFormatting(sheet, dataRange) {
  sheet.conditionalFormattings.add({
    ref: dataRange,
    rules: [
      {
        type: 'expression',
        formulae: ['$G2>=0.7'],
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } },
        font: { color: { argb: 'FF006100' } }
      },
      {
        type: 'expression',
        formulae: ['AND($G2>=0.5,$G2<0.7)'],
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } },
        font: { color: { argb: 'FF9C6500' } }
      },
      {
        type: 'expression',
        formulae: ['$G2<0.5'],
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } },
        font: { color: { argb: 'FF9C0006' } }
      }
    ]
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyData, weeklyData, monthlyOutboundData, weeklyOutboundData, frontendData, individualData, userDirectory, rawInbound, rawOutbound } = body;

    const workbook = new ExcelJS.Workbook();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // SHEET 1: Monthly KPI Summary
    const monthlySheet = workbook.addWorksheet('Monthly KPI Summary');
    monthlySheet.tabColor = tabColors.monthly;
    monthlySheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    let rowNum = addTitleRow(monthlySheet, 'Call Log Performance Report – May 2026');
    addSubtitleRow(monthlySheet, `Generated on: ${today}`);
    monthlySheet.addRow([]); // Spacer

    // KPI Summary Section
    addTitleRow(monthlySheet, 'Monthly KPI Summary');
    
    const kpiLabels = ['Total Calls', 'Inbound', 'Outbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Contact Rate', 'Overall Contact Rate'];
    const kpiCells = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    kpiLabels.forEach((label, idx) => {
      const r = monthlySheet.addRow([label, '']);
      r.getCell(1).font = { bold: true };
      monthlySheet.getCell(`${kpiCells[idx]}${r.number}`).alignment = { horizontal: 'right' };
    });

    // Populate KPI values from monthlyData
    if (monthlyData && monthlyData.length > 0) {
      const latestMonth = monthlyData[monthlyData.length - 1];
      const kpiRow = monthlySheet.getRow(monthlySheet.lastRow.number - 7);
      kpiRow.getCell(2).value = latestMonth.total_inbound + latestMonth.total_outbound;
      monthlySheet.getRow(monthlySheet.lastRow.number - 6).getCell(2).value = latestMonth.total_inbound;
      monthlySheet.getRow(monthlySheet.lastRow.number - 5).getCell(2).value = latestMonth.total_outbound;
      monthlySheet.getRow(monthlySheet.lastRow.number - 4).getCell(2).value = latestMonth.total_answered;
      monthlySheet.getRow(monthlySheet.lastRow.number - 3).getCell(2).value = latestMonth.total_missed;
      formatAsPercent(monthlySheet, monthlySheet.lastRow.number - 2, 'B', latestMonth.answer_rate);
      
      const connectedOutbound = monthlyOutboundData?.find(o => o.month === latestMonth.month)?.connected_outbound || 0;
      const outboundRate = (latestMonth.total_outbound === 0 ? 0 : Math.min(connectedOutbound / latestMonth.total_outbound, 1.0));
      formatAsPercent(monthlySheet, monthlySheet.lastRow.number - 1, 'B', outboundRate);
      
      const totalAnswered = latestMonth.total_answered + connectedOutbound;
      const totalCalls = latestMonth.total_inbound + latestMonth.total_outbound;
      const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
      formatAsPercent(monthlySheet, monthlySheet.lastRow.number, 'B', overallRate);
    }

    monthlySheet.addRow([]); // Spacer
    monthlySheet.addRow([]); // Spacer

    // Weekly Roll-Up Table
    rowNum = monthlySheet.lastRow.number + 1;
    addTitleRow(monthlySheet, 'Weekly Roll-Up');

    const headerRowNum = monthlySheet.lastRow.number + 1;
    monthlySheet.columns = [
      { key: 'week', width: 15 },
      { key: 'inbound', width: 12 },
      { key: 'answered', width: 12 },
      { key: 'missed', width: 12 },
      { key: 'outbound', width: 12 },
      { key: 'outbound_connected', width: 18 },
      { key: 'inbound_rate', width: 15 },
      { key: 'outbound_rate', width: 15 },
      { key: 'overall_rate', width: 15 }
    ];

    const headerRow = monthlySheet.addRow([
      'Week',
      'Inbound',
      'Answered',
      'Missed',
      'Outbound',
      'Outbound Connected (≥30s)',
      'Inbound Answer Rate',
      'Outbound Contact Rate',
      'Overall Contact Rate'
    ]);

    applyHeaderFormatting(monthlySheet, headerRow.number, 9);
    monthlySheet.freezePane = `A${headerRow.number + 1}`;

    if (weeklyData && Array.isArray(weeklyData)) {
      weeklyData.forEach((row, idx) => {
        const r = monthlySheet.addRow([
          row.week_start || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.total_outbound || 0,
          row.connected_outbound || 0
        ]);
        
        const rowIdx = r.number;
        formatAsPercent(monthlySheet, rowIdx, 'G', row.answer_rate || 0);
        
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = (row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0));
        formatAsPercent(monthlySheet, rowIdx, 'H', outboundRate);
        
        const totalAnswered = row.total_answered + outboundConnected;
        const totalCalls = row.total_inbound + row.total_outbound;
        const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
        formatAsPercent(monthlySheet, rowIdx, 'I', overallRate);
      });
    }

    // SHEET 2: Weekly Summary (simple table)
    const weeklySheet = workbook.addWorksheet('Weekly Summary');
    weeklySheet.tabColor = tabColors.weekly;
    weeklySheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    addTitleRow(weeklySheet, 'Weekly Summary – May 2026');
    addSubtitleRow(weeklySheet, `Generated on: ${today}`);
    weeklySheet.addRow([]);

    const weeklyHeaderRow = weeklySheet.addRow([
      'Week',
      'Inbound',
      'Answered',
      'Missed',
      'Inbound Answer Rate',
      'Outbound',
      'Outbound Connected (≥30s)',
      'Outbound Contact Rate',
      'Overall Contact Rate'
    ]);

    applyHeaderFormatting(weeklySheet, weeklyHeaderRow.number, 9);
    weeklySheet.freezePane = `A${weeklyHeaderRow.number + 1}`;

    if (weeklyData && Array.isArray(weeklyData)) {
      weeklyData.forEach((row) => {
        const r = weeklySheet.addRow([
          row.week_start || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          row.connected_outbound || 0,
          0,
          0
        ]);

        const rowIdx = r.number;
        formatAsPercent(weeklySheet, rowIdx, 'E', row.answer_rate);
        
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = (row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0));
        formatAsPercent(weeklySheet, rowIdx, 'H', outboundRate);
        
        const totalAnswered = row.total_answered + outboundConnected;
        const totalCalls = row.total_inbound + row.total_outbound;
        const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
        formatAsPercent(weeklySheet, rowIdx, 'I', overallRate);
      });
    }

    // SHEET 3: Individual Performance
    const individualSheet = workbook.addWorksheet('Individual Performance');
    individualSheet.tabColor = tabColors.individual;
    individualSheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    addTitleRow(individualSheet, 'Individual Performance – May 2026');
    addSubtitleRow(individualSheet, `Generated on: ${today}`);
    individualSheet.addRow([]);

    const indivHeaderRow = individualSheet.addRow([
      'User',
      'Inbound',
      'Answered',
      'Missed',
      'Inbound Answer Rate',
      'Outbound Attempts',
      'Outbound Connected (≥30s)',
      'Outbound Contact Rate',
      'Overall Contact Rate',
      'Avg Duration (Minutes)'
    ]);

    applyHeaderFormatting(individualSheet, indivHeaderRow.number, 10);
    individualSheet.freezePane = `A${indivHeaderRow.number + 1}`;
    individualSheet.autoFilter.from = `A${indivHeaderRow.number}`;
    individualSheet.autoFilter.to = `J${indivHeaderRow.number}`;

    if (individualData && Array.isArray(individualData)) {
      individualData.forEach((row) => {
        const r = individualSheet.addRow([
          row.user_name || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          row.outbound_connected || 0,
          row.outbound_contact_rate || 0,
          row.overall_contact_rate || 0,
          ((row.avg_duration_seconds || 0) / 60).toFixed(2)
        ]);

        const rowIdx = r.number;
        formatAsPercent(individualSheet, rowIdx, 'E', row.answer_rate);
        formatAsPercent(individualSheet, rowIdx, 'H', row.outbound_contact_rate);
        formatAsPercent(individualSheet, rowIdx, 'I', row.overall_contact_rate);
        individualSheet.getCell(`J${rowIdx}`).numFmt = '0.00';
      });

      // Totals row
      const totalsRowNum = individualSheet.lastRow.number + 1;
      const totalsInbound = individualData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);
      const totalsAnswered = individualData.reduce((sum, r) => sum + (r.total_answered || 0), 0);
      const totalsMissed = individualData.reduce((sum, r) => sum + (r.total_missed || 0), 0);
      const totalsOutbound = individualData.reduce((sum, r) => sum + (r.total_outbound || 0), 0);
      const totalsOutboundConnected = individualData.reduce((sum, r) => sum + (r.outbound_connected || 0), 0);
      const totalDurationSeconds = individualData.reduce((sum, r) => sum + ((r.avg_duration_seconds || 0) * (r.total_inbound || 0)), 0);
      const totalInboundForDuration = individualData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);

      const inboundAnswerRate = totalsInbound > 0 ? totalsAnswered / totalsInbound : 0;
      const outboundRate = totalsOutbound > 0 ? totalsOutboundConnected / totalsOutbound : 0;
      const totalAnswered = totalsAnswered + totalsOutboundConnected;
      const totalCalls = totalsInbound + totalsOutbound;
      const overallRate = totalCalls > 0 ? totalAnswered / totalCalls : 0;
      const avgDuration = totalInboundForDuration > 0 ? totalDurationSeconds / totalInboundForDuration / 60 : 0;

      const totalsRow = individualSheet.addRow([
        'TOTAL',
        totalsInbound,
        totalsAnswered,
        totalsMissed,
        inboundAnswerRate,
        totalsOutbound,
        totalsOutboundConnected,
        outboundRate,
        overallRate,
        avgDuration.toFixed(2)
      ]);

      applyTotalsFormatting(individualSheet, totalsRowNum, 10);
      formatAsPercent(individualSheet, totalsRowNum, 'E', inboundAnswerRate);
      formatAsPercent(individualSheet, totalsRowNum, 'H', outboundRate);
      formatAsPercent(individualSheet, totalsRowNum, 'I', overallRate);
      individualSheet.getCell(`J${totalsRowNum}`).numFmt = '0.00';
    }

    // SHEET 4: Front-End Performance
    const frontendSheet = workbook.addWorksheet('Front-End Performance');
    frontendSheet.tabColor = tabColors.frontend;
    frontendSheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    addTitleRow(frontendSheet, 'Front-End Performance (Front Desk Benchmark) – May 2026');
    addSubtitleRow(frontendSheet, `Generated on: ${today}`);
    frontendSheet.addRow([]);

    const frontHeaderRow = frontendSheet.addRow([
      'User',
      'Inbound',
      'Answered',
      'Missed',
      'Inbound Answer Rate',
      'Outbound Attempts',
      'Outbound Connected (≥30s)',
      'Outbound Contact Rate',
      'Overall Contact Rate',
      'Avg Duration (Minutes)'
    ]);

    applyHeaderFormatting(frontendSheet, frontHeaderRow.number, 10);
    frontendSheet.freezePane = `A${frontHeaderRow.number + 1}`;
    frontendSheet.autoFilter.from = `A${frontHeaderRow.number}`;
    frontendSheet.autoFilter.to = `J${frontHeaderRow.number}`;

    if (frontendData && Array.isArray(frontendData)) {
      frontendData.forEach((row) => {
        const r = frontendSheet.addRow([
          row.user_name || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          row.outbound_connected || 0,
          row.outbound_contact_rate || 0,
          row.overall_contact_rate || 0,
          ((row.avg_duration_seconds || 0) / 60).toFixed(2)
        ]);

        const rowIdx = r.number;
        formatAsPercent(frontendSheet, rowIdx, 'E', row.answer_rate);
        formatAsPercent(frontendSheet, rowIdx, 'H', row.outbound_contact_rate);
        formatAsPercent(frontendSheet, rowIdx, 'I', row.overall_contact_rate);
        frontendSheet.getCell(`J${rowIdx}`).numFmt = '0.00';
      });

      // Totals row
      const totalsRowNum = frontendSheet.lastRow.number + 1;
      const totalsInbound = frontendData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);
      const totalsAnswered = frontendData.reduce((sum, r) => sum + (r.total_answered || 0), 0);
      const totalsMissed = frontendData.reduce((sum, r) => sum + (r.total_missed || 0), 0);
      const totalsOutbound = frontendData.reduce((sum, r) => sum + (r.total_outbound || 0), 0);
      const totalsOutboundConnected = frontendData.reduce((sum, r) => sum + (r.outbound_connected || 0), 0);
      const totalDurationSeconds = frontendData.reduce((sum, r) => sum + ((r.avg_duration_seconds || 0) * (r.total_inbound || 0)), 0);
      const totalInboundForDuration = frontendData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);

      const inboundAnswerRate = totalsInbound > 0 ? totalsAnswered / totalsInbound : 0;
      const outboundRate = totalsOutbound > 0 ? totalsOutboundConnected / totalsOutbound : 0;
      const totalAnswered = totalsAnswered + totalsOutboundConnected;
      const totalCalls = totalsInbound + totalsOutbound;
      const overallRate = totalCalls > 0 ? totalAnswered / totalCalls : 0;
      const avgDuration = totalInboundForDuration > 0 ? totalDurationSeconds / totalInboundForDuration / 60 : 0;

      const totalsRow = frontendSheet.addRow([
        'TOTAL',
        totalsInbound,
        totalsAnswered,
        totalsMissed,
        inboundAnswerRate,
        totalsOutbound,
        totalsOutboundConnected,
        outboundRate,
        overallRate,
        avgDuration.toFixed(2)
      ]);

      applyTotalsFormatting(frontendSheet, totalsRowNum, 10);
      formatAsPercent(frontendSheet, totalsRowNum, 'E', inboundAnswerRate);
      formatAsPercent(frontendSheet, totalsRowNum, 'H', outboundRate);
      formatAsPercent(frontendSheet, totalsRowNum, 'I', overallRate);
      frontendSheet.getCell(`J${totalsRowNum}`).numFmt = '0.00';
    }

    // SHEET 5: User Directory
    const dirSheet = workbook.addWorksheet('User Directory');
    dirSheet.tabColor = tabColors.directory;
    dirSheet.columns = [
      { key: 'name', width: 25 },
      { key: 'extensions', width: 12 },
      { key: 'location', width: 15 },
      { key: 'benchmark_group', width: 18 },
      { key: 'include_in_benchmark', width: 18 },
      { key: 'active', width: 10 }
    ];

    const dirHeaderRow = dirSheet.addRow([
      'User Name',
      'Extension(s)',
      'Location',
      'Benchmark Group',
      'Include In Benchmark',
      'Active'
    ]);

    applyHeaderFormatting(dirSheet, dirHeaderRow.number, 6);
    dirSheet.freezePane = `A${dirHeaderRow.number + 1}`;
    dirSheet.autoFilter.from = `A${dirHeaderRow.number}`;
    dirSheet.autoFilter.to = `F${dirHeaderRow.number}`;

    if (userDirectory && Array.isArray(userDirectory)) {
      userDirectory.forEach((row) => {
        dirSheet.addRow([
          row.name || '',
          (row.extensions || []).join(', ') || '',
          row.location || '',
          row.benchmark_group || '',
          row.include_in_benchmark ? 'Yes' : 'No',
          row.active ? 'Yes' : 'No'
        ]);
      });
    }

    // SHEET 6: Raw Imported Data
    const rawSheet = workbook.addWorksheet('Raw Imported Data');
    rawSheet.tabColor = tabColors.rawData;
    rawSheet.columns = [
      { key: 'call_date', width: 12 },
      { key: 'call_time', width: 10 },
      { key: 'extension', width: 12 },
      { key: 'caller_or_dialed', width: 15 },
      { key: 'duration_seconds', width: 15 },
      { key: 'result_disposition', width: 15 },
      { key: 'direction', width: 10 },
      { key: 'answered', width: 10 },
      { key: 'location', width: 15 }
    ];

    const rawHeaderRow = rawSheet.addRow([
      'Call Date',
      'Call Time',
      'Extension',
      'Caller/Dialed',
      'Duration (sec)',
      'Result/Disposition',
      'Direction',
      'Answered/Flag',
      'Location'
    ]);

    applyHeaderFormatting(rawSheet, rawHeaderRow.number, 9);
    rawSheet.freezePane = `A${rawHeaderRow.number + 1}`;
    rawSheet.autoFilter.from = `A${rawHeaderRow.number}`;
    rawSheet.autoFilter.to = `I${rawHeaderRow.number}`;

    if (rawInbound && Array.isArray(rawInbound)) {
      rawInbound.forEach((row) => {
        rawSheet.addRow([
          row.call_date || '',
          row.call_time || '',
          row.extension || '',
          row.caller_number || '',
          row.duration_seconds || 0,
          row.disposition || '',
          'Inbound',
          row.answered ? 'Yes' : 'No',
          ''
        ]);
      });
    }

    if (rawOutbound && Array.isArray(rawOutbound)) {
      rawOutbound.forEach((row) => {
        rawSheet.addRow([
          row.call_date || '',
          row.call_time || '',
          row.extension || '',
          row.dialed_number || '',
          row.duration_seconds || 0,
          row.result || '',
          'Outbound',
          row.result === 'answered' ? 'Yes' : 'No',
          row.location || ''
        ]);
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