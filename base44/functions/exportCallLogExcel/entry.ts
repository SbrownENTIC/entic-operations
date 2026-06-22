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
    const { 
      monthlyData = [], 
      weeklyData = [], 
      monthlyOutboundData = [], 
      weeklyOutboundData = [], 
      frontendData = [], 
      individualData = [] 
    } = body;

    // ===== CREATE WORKBOOK =====
    const wb = new ExcelJS.Workbook();
    wb.creator = "ENTIC Operations Center";
    wb.created = new Date();

    // ===== CALCULATE METRICS =====
    let totalInbound = 0, totalOutbound = 0, totalAnswered = 0, totalMissed = 0;
    let totalOutboundConnected = 0, totalFrontEndInbound = 0, totalFrontEndAnswered = 0;

    if (monthlyData && monthlyData.length > 0) {
      const latest = monthlyData[monthlyData.length - 1];
      totalInbound = latest.total_inbound || 0;
      totalAnswered = latest.total_answered || 0;
      totalMissed = latest.total_missed || 0;
    }

    if (monthlyOutboundData && monthlyOutboundData.length > 0) {
      const latest = monthlyOutboundData[monthlyOutboundData.length - 1];
      totalOutbound = latest.total_outbound || 0;
      totalOutboundConnected = latest.connected_outbound || 0;
    }

    if (frontendData && frontendData.length > 0) {
      totalFrontEndInbound = frontendData.reduce((sum, u) => sum + (u.total_inbound || 0), 0);
      totalFrontEndAnswered = frontendData.reduce((sum, u) => sum + (u.total_answered || 0), 0);
    }

    const totalCalls = totalInbound + totalOutbound;
    const inboundRate = totalInbound > 0 ? totalAnswered / totalInbound : 0;
    const frontEndRate = totalFrontEndInbound > 0 ? totalFrontEndAnswered / totalFrontEndInbound : 0;
    const outboundContactRate = totalOutbound > 0 ? totalOutboundConnected / totalOutbound : 0;
    const totalContacted = totalAnswered + totalOutboundConnected;
    const overallContactRate = totalCalls > 0 ? totalContacted / totalCalls : 0;

    // ===== SHEET 1: EXECUTIVE SUMMARY =====
    const summary = wb.addWorksheet("Executive Summary");
    summary.columns = [
      { width: 28 },
      { width: 20 }
    ];

    // Title
    summary.mergeCells("A1:B1");
    summary.getCell("A1").value = "Call Log Executive Summary";
    summary.getCell("A1").font = { size: 16, bold: true };
    summary.getCell("A1").alignment = { horizontal: "center" };

    summary.addRow([]);

    summary.addRow(["Total Calls", totalCalls]);
    summary.addRow(["Inbound", totalInbound]);
    summary.addRow(["Outbound", totalOutbound]);
    summary.addRow(["Answered", totalAnswered]);
    summary.addRow(["Missed", totalMissed]);

    summary.addRow([]);

    summary.addRow(["Inbound Answer Rate", inboundRate]);
    summary.addRow(["Front-End Answer Rate", frontEndRate]);
    summary.addRow(["Outbound Contact Rate (30s+)", outboundContactRate]);
    summary.addRow(["Overall Contact Rate", overallContactRate]);

    // Percent formatting
    summary.getCell("B8").numFmt = "0.00%";
    summary.getCell("B9").numFmt = "0.00%";
    summary.getCell("B10").numFmt = "0.00%";
    summary.getCell("B11").numFmt = "0.00%";

    // Bold labels
    for (let i = 3; i <= 11; i++) {
      summary.getCell(`A${i}`).font = { bold: true };
    }

    // ===== SHEET 2: WEEKLY SUMMARY =====
    const weekly = wb.addWorksheet("Weekly Summary");
    weekly.columns = [
      { header: "Week Starting", key: "week", width: 15 },
      { header: "Total Inbound", key: "inbound", width: 15 },
      { header: "Answered", key: "answered", width: 15 },
      { header: "Missed", key: "missed", width: 15 },
      { header: "Answer Rate", key: "rate", width: 15 }
    ];

    weekly.getRow(1).font = { bold: true };

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((w) => {
        weekly.addRow({
          week: w.week_start || "",
          inbound: w.total_inbound || 0,
          answered: w.total_answered || 0,
          missed: w.total_missed || 0,
          rate: w.answer_rate || 0
        });
      });
    }

    // Percent formatting
    weekly.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(5).numFmt = "0.00%";
      }
    });

    // Enable filtering
    weekly.autoFilter = {
      from: "A1",
      to: `E${weekly.rowCount}`
    };

    // ===== SHEET 3: FRONT-END PERFORMANCE =====
    const frontEnd = wb.addWorksheet("Front-End Performance");
    frontEnd.columns = [
      { header: "User", key: "user", width: 30 },
      { header: "Inbound", key: "inbound", width: 15 },
      { header: "Answered", key: "answered", width: 15 },
      { header: "Missed", key: "missed", width: 15 },
      { header: "Answer Rate", key: "rate", width: 15 }
    ];

    frontEnd.getRow(1).font = { bold: true };

    if (frontendData && frontendData.length > 0) {
      frontendData.forEach((u) => {
        frontEnd.addRow({
          user: u.user_name || "",
          inbound: u.total_inbound || 0,
          answered: u.total_answered || 0,
          missed: u.total_missed || 0,
          rate: u.answer_rate || 0
        });
      });

      // Totals row
      const frontEndTotalInbound = frontendData.reduce((sum, u) => sum + (u.total_inbound || 0), 0);
      const frontEndTotalAnswered = frontendData.reduce((sum, u) => sum + (u.total_answered || 0), 0);
      const frontEndTotalMissed = frontendData.reduce((sum, u) => sum + (u.total_missed || 0), 0);
      const frontEndTotalRate = frontEndTotalInbound > 0 ? frontEndTotalAnswered / frontEndTotalInbound : 0;

      frontEnd.addRow({
        user: "TOTAL",
        inbound: frontEndTotalInbound,
        answered: frontEndTotalAnswered,
        missed: frontEndTotalMissed,
        rate: frontEndTotalRate
      });

      const lastFrontEndRow = frontEnd.lastRow.number;
      frontEnd.getRow(lastFrontEndRow).font = { bold: true };
    }

    // Percent formatting
    frontEnd.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(5).numFmt = "0.00%";
      }
    });

    frontEnd.autoFilter = {
      from: "A1",
      to: `E${frontEnd.rowCount}`
    };

    // ===== SHEET 4: INDIVIDUAL PERFORMANCE =====
    const individual = wb.addWorksheet("Individual Performance");
    individual.columns = [
      { header: "User", key: "user", width: 30 },
      { header: "Inbound", key: "inbound", width: 15 },
      { header: "Outbound", key: "outbound", width: 15 },
      { header: "Answered", key: "answered", width: 15 },
      { header: "Missed", key: "missed", width: 15 },
      { header: "Answer Rate", key: "rate", width: 15 },
      { header: "Avg Duration (Minutes)", key: "avgMin", width: 20 }
    ];

    individual.getRow(1).font = { bold: true };

    let indivTotalInbound = 0, indivTotalOutbound = 0, indivTotalAnswered = 0, indivTotalMissed = 0;
    let indivTotalDurationSeconds = 0;

    if (individualData && individualData.length > 0) {
      individualData.forEach((u) => {
        const inbound = u.total_inbound || 0;
        const outbound = u.total_outbound || 0;
        const answered = u.total_answered || 0;
        const missed = u.total_missed || 0;
        const avgDurationSec = u.avg_duration_seconds || 0;
        const rate = inbound > 0 ? answered / inbound : 0;

        individual.addRow({
          user: u.user_name || "",
          inbound: inbound,
          outbound: outbound,
          answered: answered,
          missed: missed,
          rate: rate,
          avgMin: avgDurationSec / 60
        });

        indivTotalInbound += inbound;
        indivTotalOutbound += outbound;
        indivTotalAnswered += answered;
        indivTotalMissed += missed;
        indivTotalDurationSeconds += avgDurationSec * inbound;
      });

      // Totals row
      const indivTotalRate = indivTotalInbound > 0 ? indivTotalAnswered / indivTotalInbound : 0;
      const indivAvgMinutes = indivTotalInbound > 0 ? indivTotalDurationSeconds / indivTotalInbound / 60 : 0;

      individual.addRow({
        user: "TOTAL",
        inbound: indivTotalInbound,
        outbound: indivTotalOutbound,
        answered: indivTotalAnswered,
        missed: indivTotalMissed,
        rate: indivTotalRate,
        avgMin: indivAvgMinutes
      });

      const lastIndividualRow = individual.lastRow.number;
      individual.getRow(lastIndividualRow).font = { bold: true };
    }

    // Format percent + minutes
    individual.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(6).numFmt = "0.00%";
        row.getCell(7).numFmt = "0.00";
      }
    });

    individual.autoFilter = {
      from: "A1",
      to: `G${individual.rowCount}`
    };

    // ===== FINAL EXPORT =====
    const buffer = await wb.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    const filename = `CallLog_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    return Response.json({
      success: true,
      file_base64: btoa(binary),
      filename,
    });
  } catch (error) {
    console.error('Excel export error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});