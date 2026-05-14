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

function applyHeaderFormatting(sheet, headerRowNum, columnCount) {
  try {
    const headerRow = sheet.getRow(headerRowNum);
    if (!headerRow) return;
    
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    
    for (let i = 1; i <= columnCount; i++) {
      const cell = headerRow.getCell(i);
      if (cell) {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
  } catch (e) {
    console.error(`Header formatting error on row ${headerRowNum}:`, e.message);
  }
}

function applyTotalsFormatting(sheet, rowNum, columnCount) {
  try {
    const totalsRow = sheet.getRow(rowNum);
    if (!totalsRow) return;
    
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
    
    for (let i = 1; i <= columnCount; i++) {
      const cell = totalsRow.getCell(i);
      if (cell) {
        cell.border = {
          top: { style: 'medium' },
          bottom: { style: 'medium' }
        };
      }
    }
  } catch (e) {
    console.error(`Totals formatting error on row ${rowNum}:`, e.message);
  }
}

function formatAsPercent(sheet, rowNum, colLetter, value) {
  try {
    const cell = sheet.getCell(`${colLetter}${rowNum}`);
    if (!cell) {
      const row = sheet.getRow(rowNum);
      if (row) {
        const colNum = colLetter.charCodeAt(0) - 64;
        const newCell = row.getCell(colNum);
        newCell.value = value;
        newCell.numFmt = '0.00%';
      }
      return;
    }
    cell.value = value;
    cell.numFmt = '0.00%';
  } catch (e) {
    console.error(`Percent format error at ${colLetter}${rowNum}:`, e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyData = [], weeklyData = [], monthlyOutboundData = [], weeklyOutboundData = [], frontendData = [], individualData = [], userDirectory = [], rawInbound = [], rawOutbound = [] } = body;

    const workbook = new ExcelJS.Workbook();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // SHEET 1: Monthly KPI Summary
    const monthlySheet = workbook.addWorksheet('Monthly KPI Summary');
    monthlySheet.tabColor = tabColors.monthly;
    monthlySheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    // Add title and subtitle
    let titleRow = monthlySheet.addRow(['Call Log Performance Report – May 2026']);
    titleRow.font = { bold: true, size: 14 };
    monthlySheet.mergeCells('A1:K1');
    
    let subtitleRow = monthlySheet.addRow([`Generated on: ${today}`]);
    subtitleRow.font = { size: 11 };
    monthlySheet.mergeCells('A2:K2');
    
    monthlySheet.addRow([]); // Spacer

    // KPI Summary Section
    let kpiTitleRow = monthlySheet.addRow(['Monthly KPI Summary']);
    kpiTitleRow.font = { bold: true, size: 12 };
    monthlySheet.mergeCells('A4:K4');

    const kpiLabels = ['Total Calls', 'Inbound', 'Outbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Contact Rate', 'Overall Contact Rate'];
    const kpiStartRow = monthlySheet.lastRow.number + 1;
    
    kpiLabels.forEach((label, idx) => {
      const r = monthlySheet.addRow([label, null]);
      const labelCell = r.getCell(1);
      labelCell.font = { bold: true };
      const valueCell = r.getCell(2);
      if (valueCell) valueCell.alignment = { horizontal: 'right' };
    });

    // Populate KPI values from monthlyData
    if (monthlyData && monthlyData.length > 0) {
      const latestMonth = monthlyData[monthlyData.length - 1];
      const latestOutbound = monthlyOutboundData?.find(o => o.month === latestMonth.month);
      
      let kpiRow = kpiStartRow;
      monthlySheet.getCell(`B${kpiRow}`).value = (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0);
      
      kpiRow++;
      monthlySheet.getCell(`B${kpiRow}`).value = latestMonth.total_inbound || 0;
      
      kpiRow++;
      monthlySheet.getCell(`B${kpiRow}`).value = latestMonth.total_outbound || 0;
      
      kpiRow++;
      monthlySheet.getCell(`B${kpiRow}`).value = latestMonth.total_answered || 0;
      
      kpiRow++;
      monthlySheet.getCell(`B${kpiRow}`).value = latestMonth.total_missed || 0;
      
      kpiRow++;
      formatAsPercent(monthlySheet, kpiRow, 'B', latestMonth.answer_rate || 0);
      
      kpiRow++;
      const connectedOutbound = latestOutbound?.connected_outbound || 0;
      const outboundRate = (latestMonth.total_outbound === 0 ? 0 : Math.min(connectedOutbound / latestMonth.total_outbound, 1.0));
      formatAsPercent(monthlySheet, kpiRow, 'B', outboundRate);
      
      kpiRow++;
      const totalAnswered = (latestMonth.total_answered || 0) + connectedOutbound;
      const totalCalls = (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0);
      const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
      formatAsPercent(monthlySheet, kpiRow, 'B', overallRate);
    }

    monthlySheet.addRow([]); // Spacer
    monthlySheet.addRow([]); // Spacer

    // Weekly Roll-Up Table
    const weeklyTableTitleRow = monthlySheet.addRow(['Weekly Roll-Up']);
    weeklyTableTitleRow.font = { bold: true, size: 12 };
    monthlySheet.mergeCells(`A${weeklyTableTitleRow.number}:I${weeklyTableTitleRow.number}`);

    const weeklyHeaderRowNum = monthlySheet.lastRow.number + 1;
    const weeklyHeaderRow = monthlySheet.addRow([
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

    applyHeaderFormatting(monthlySheet, weeklyHeaderRowNum, 9);
    monthlySheet.freezePane = `A${weeklyHeaderRowNum + 1}`;

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((row) => {
        const dataRow = monthlySheet.addRow([
          row.week_start || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.total_outbound || 0,
          row.connected_outbound || 0,
          0,
          0,
          0
        ]);

        const rowIdx = dataRow.number;
        formatAsPercent(monthlySheet, rowIdx, 'G', row.answer_rate || 0);
        
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = (row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0));
        formatAsPercent(monthlySheet, rowIdx, 'H', outboundRate);
        
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
        formatAsPercent(monthlySheet, rowIdx, 'I', overallRate);
      });
    }

    // SHEET 2: Weekly Summary
    const weeklySheet = workbook.addWorksheet('Weekly Summary');
    weeklySheet.tabColor = tabColors.weekly;
    weeklySheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    let wtitleRow = weeklySheet.addRow(['Weekly Summary – May 2026']);
    wtitleRow.font = { bold: true, size: 14 };
    weeklySheet.mergeCells('A1:I1');
    
    let wsubtitleRow = weeklySheet.addRow([`Generated on: ${today}`]);
    wsubtitleRow.font = { size: 11 };
    weeklySheet.mergeCells('A2:I2');
    weeklySheet.addRow([]);

    const weeklyDataHeaderRowNum = weeklySheet.lastRow.number + 1;
    const weeklyDataHeaderRow = weeklySheet.addRow([
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

    applyHeaderFormatting(weeklySheet, weeklyDataHeaderRowNum, 9);
    weeklySheet.freezePane = `A${weeklyDataHeaderRowNum + 1}`;

    if (weeklyData && weeklyData.length > 0) {
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
        
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = (totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0));
        formatAsPercent(weeklySheet, rowIdx, 'I', overallRate);
      });
    }

    // SHEET 3: Individual Performance
    const individualSheet = workbook.addWorksheet('Individual Performance');
    individualSheet.tabColor = tabColors.individual;
    individualSheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    let ititleRow = individualSheet.addRow(['Individual Performance – May 2026']);
    ititleRow.font = { bold: true, size: 14 };
    individualSheet.mergeCells('A1:J1');
    
    let isubtitleRow = individualSheet.addRow([`Generated on: ${today}`]);
    isubtitleRow.font = { size: 11 };
    individualSheet.mergeCells('A2:J2');
    individualSheet.addRow([]);

    const indivHeaderRowNum = individualSheet.lastRow.number + 1;
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

    applyHeaderFormatting(individualSheet, indivHeaderRowNum, 10);
    individualSheet.freezePane = `A${indivHeaderRowNum + 1}`;

    if (individualData && individualData.length > 0) {
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
        const durationCell = individualSheet.getCell(`J${rowIdx}`);
        if (durationCell) durationCell.numFmt = '0.00';
      });

      // Totals row
      if (individualData.length > 0) {
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
        const durationCell = individualSheet.getCell(`J${totalsRowNum}`);
        if (durationCell) durationCell.numFmt = '0.00';
      }
    }

    // SHEET 4: Front-End Performance
    const frontendSheet = workbook.addWorksheet('Front-End Performance');
    frontendSheet.tabColor = tabColors.frontend;
    frontendSheet.pageSetup = { paperSize: 1, orientation: 'landscape' };

    let ftitleRow = frontendSheet.addRow(['Front-End Performance (Front Desk Benchmark) – May 2026']);
    ftitleRow.font = { bold: true, size: 14 };
    frontendSheet.mergeCells('A1:J1');
    
    let fsubtitleRow = frontendSheet.addRow([`Generated on: ${today}`]);
    fsubtitleRow.font = { size: 11 };
    frontendSheet.mergeCells('A2:J2');
    frontendSheet.addRow([]);

    const frontHeaderRowNum = frontendSheet.lastRow.number + 1;
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

    applyHeaderFormatting(frontendSheet, frontHeaderRowNum, 10);
    frontendSheet.freezePane = `A${frontHeaderRowNum + 1}`;

    if (frontendData && frontendData.length > 0) {
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
        const durationCell = frontendSheet.getCell(`J${rowIdx}`);
        if (durationCell) durationCell.numFmt = '0.00';
      });

      // Totals row
      if (frontendData.length > 0) {
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
        const durationCell = frontendSheet.getCell(`J${totalsRowNum}`);
        if (durationCell) durationCell.numFmt = '0.00';
      }
    }

    // SHEET 5: User Directory
    const dirSheet = workbook.addWorksheet('User Directory');
    dirSheet.tabColor = tabColors.directory;

    const dirHeaderRowNum = dirSheet.lastRow?.number ? dirSheet.lastRow.number + 1 : 1;
    const dirHeaderRow = dirSheet.addRow([
      'User Name',
      'Extension(s)',
      'Location',
      'Benchmark Group',
      'Include In Benchmark',
      'Active'
    ]);

    applyHeaderFormatting(dirSheet, dirHeaderRowNum, 6);
    dirSheet.freezePane = `A${dirHeaderRowNum + 1}`;

    if (userDirectory && userDirectory.length > 0) {
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

    const rawHeaderRowNum = rawSheet.lastRow?.number ? rawSheet.lastRow.number + 1 : 1;
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

    applyHeaderFormatting(rawSheet, rawHeaderRowNum, 9);
    rawSheet.freezePane = `A${rawHeaderRowNum + 1}`;

    if (rawInbound && rawInbound.length > 0) {
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

    if (rawOutbound && rawOutbound.length > 0) {
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

    // Auto-fit columns for all sheets
    [monthlySheet, weeklySheet, individualSheet, frontendSheet, dirSheet, rawSheet].forEach(sheet => {
      sheet.columns.forEach(column => {
        column.width = column.width || 12;
      });
    });

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
    console.error('Excel export error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});