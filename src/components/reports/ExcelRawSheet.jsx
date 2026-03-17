// ExcelRawSheet.js
// Builds the "Raw Data" worksheet with columns A–AA (27 columns),
// where columns L–AA (12–27) are calculated performance metrics
// matching the March 2026 worksheet logic exactly.

import { autoFitColumns } from "./ExcelExportHelpers";

// Extensions classified as Call Center role
const CALL_CENTER_EXTENSIONS = new Set([101, 123, 128, 105, 116, 106, 113, 127, 126, 120, 403, 114, 124, 115]);

function getPhoneRole(extension) {
  const ext = parseInt(extension, 10);
  if (!isNaN(ext) && CALL_CENTER_EXTENSIONS.has(ext)) return "Call Center";
  return "Client Facing";
}

function durationToMinutes(val) {
  // Accepts: number (already minutes), "HH:MM:SS", "MM:SS", or null/undefined
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  const parts = s.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function buildRawSheet(wb, { periodLabel, generatedOn, enrichedSummaries, exportUserConfigMap, mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY, SECTION_BG, HEADER_BG }) {

  const ws = wb.addWorksheet("Raw Data", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 1, xSplit: 0 }]
  });

  // ── Column definitions (A–AA = 27 columns) ──────────────────────────────
  ws.columns = [
    // A–K: source data
    { header: "User",                       key: "user",                        width: 30 },
    { header: "Extension",                  key: "extension",                   width: 12 },
    { header: "Total Calls",                key: "total_calls",                 width: 14 },
    { header: "Inbound Calls",              key: "inbound_calls",               width: 14 },
    { header: "Outbound Calls",             key: "outbound_calls",              width: 14 },
    { header: "Answered Calls",             key: "answered_calls",              width: 16 },
    { header: "Missed Calls",               key: "missed_calls",                width: 13 },
    { header: "Total Call Duration (min)",  key: "total_duration_min",          width: 24 },
    { header: "Inbound Duration (min)",     key: "inbound_duration_min",        width: 22 },
    { header: "Outbound Duration (min)",    key: "outbound_duration_min",       width: 22 },
    { header: "Location",                   key: "location",                    width: 16 },

    // L–AA: calculated columns
    { header: "Phone Role",                 key: "phone_role",                  width: 14 },  // L
    { header: "Inbound Answered",           key: "inbound_answered",            width: 18 },  // M
    { header: "Inbound Answer Rate",        key: "inbound_answer_rate",         width: 20 },  // N
    { header: "Expected Answer Rate",       key: "expected_answer_rate",        width: 22 },  // O
    { header: "Answer Rate Status",         key: "answer_rate_status",          width: 22 },  // P
    { header: "Outbound Answered",          key: "outbound_answered",           width: 18 },  // Q
    { header: "Outbound Rate",              key: "outbound_rate",               width: 16 },  // R
    { header: "Expected Outbound %",        key: "expected_outbound",           width: 20 },  // S
    { header: "Outbound Activity",          key: "outbound_activity",           width: 18 },  // T
    { header: "Calls per Hour",             key: "calls_per_hour",              width: 16 },  // U
    { header: "Expected Calls per Hour",    key: "expected_calls_per_hour",     width: 22 },  // V
    { header: "Call Volume Status",         key: "call_volume_status",          width: 20 },  // W
  ];

  // ── Style header row ─────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font      = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill      = mkFill(colNum <= 11 ? DARK_NAVY : SECTION_BG);
    cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle", wrapText: true };
    cell.border    = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
  });

  // ── Build data rows ───────────────────────────────────────────────────────
  if (!enrichedSummaries || enrichedSummaries.length === 0) {
    const emptyRow = ws.addRow({ user: "No benchmark user data found for this period." });
    emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    emptyRow.height = 18;
    return;
  }

  const tableRows = [];

  enrichedSummaries
    .slice()
    .sort((a, b) => (a.user || "").localeCompare(b.user || ""))
    .forEach((u, idx) => {
      const userName = u.user || "";
      const cfg      = exportUserConfigMap ? exportUserConfigMap[userName] : null;
      const extension = cfg?.extension || "";
      const location  = cfg?.location  || "";

      // ── Source fields ──────────────────────────────────────────────────
      const totalCalls    = Number(u.total_calls  || 0);
      const inboundCalls  = Number(u.inbound      || 0);
      const outboundCalls = Number(u.outbound     || 0);
      const answeredCalls = Number(u.answered     || 0);  // connected (all)
      const missedCalls   = Number(u.missed       || 0);

      // Duration: stored as seconds in summary, convert to minutes
      const totalDurMin    = durationToMinutes(u.total_duration_minutes != null
        ? u.total_duration_minutes
        : (u.total_duration_seconds != null ? u.total_duration_seconds / 60 : 0));
      const inboundDurMin  = durationToMinutes(u.inbound_duration_minutes != null
        ? u.inbound_duration_minutes
        : (u.inbound_duration_seconds != null ? u.inbound_duration_seconds / 60 : 0));
      const outboundDurMin = durationToMinutes(u.outbound_duration_minutes != null
        ? u.outbound_duration_minutes
        : (u.outbound_duration_seconds != null ? u.outbound_duration_seconds / 60 : 0));

      // ── Calculated columns (L–W) ───────────────────────────────────────
      // 1. Phone Role (L)
      const phoneRole = getPhoneRole(extension);

      // 2. Inbound Answered (M): max(inbound_calls - missed_calls, 0)
      const inboundAnswered = Math.max(inboundCalls - missedCalls, 0);

      // 3. Inbound Answer Rate (N): decimal
      const inboundAnswerRate = inboundCalls === 0 ? 0 : inboundAnswered / inboundCalls;

      // 4. Expected Answer Rate (O)
      const expectedAnswerRate = phoneRole === "Call Center" ? 0.85 : 0.65;

      // 5. Answer Rate Status (P)
      const answerRateStatus = inboundAnswerRate >= expectedAnswerRate ? "Meets Benchmark" : "Below Benchmark";

      // 6. Outbound Answered (Q): max(answered_calls - inbound_answered, 0)
      const outboundAnswered = Math.max(answeredCalls - inboundAnswered, 0);

      // 7. Outbound Rate (R): decimal
      const outboundRate = totalCalls === 0 ? 0 : outboundCalls / totalCalls;

      // 8. Expected Outbound % (S)
      const expectedOutbound = phoneRole === "Call Center" ? 0.15 : 0.25;

      // 9. Outbound Activity (T)
      const outboundActivity = outboundRate >= expectedOutbound ? "Healthy" : "Low";

      // 10. Calls per Hour (U): total_calls / 7.5
      const callsPerHour = totalCalls / 7.5;

      // 11. Expected Calls per Hour (V)
      const expectedCallsPerHour = phoneRole === "Call Center" ? 10 : 7;

      // 12. Call Volume Status (W)
      const callVolumeStatus = callsPerHour >= expectedCallsPerHour ? "Healthy" : "Low Volume";

      // ── Row colors ─────────────────────────────────────────────────────
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;

      // Status badge colors
      const arStatusColor  = answerRateStatus  === "Meets Benchmark" ? { bg: "FFC6EFCE", fg: "FF276221" } : { bg: "FFFFC7CE", fg: "FF9C0006" };
      const outActColor    = outboundActivity  === "Healthy"         ? { bg: "FFC6EFCE", fg: "FF276221" } : { bg: "FFFFC7CE", fg: "FF9C0006" };
      const volStatusColor = callVolumeStatus  === "Healthy"         ? { bg: "FFC6EFCE", fg: "FF276221" } : { bg: "FFFFC7CE", fg: "FF9C0006" };

      const rowData = {
        user:                  userName,
        extension:             extension || "",
        total_calls:           totalCalls,
        inbound_calls:         inboundCalls,
        outbound_calls:        outboundCalls,
        answered_calls:        answeredCalls,
        missed_calls:          missedCalls,
        total_duration_min:    Math.round(totalDurMin * 100) / 100,
        inbound_duration_min:  Math.round(inboundDurMin * 100) / 100,
        outbound_duration_min: Math.round(outboundDurMin * 100) / 100,
        location:              location,
        phone_role:            phoneRole,
        inbound_answered:      inboundAnswered,
        inbound_answer_rate:   inboundAnswerRate,
        expected_answer_rate:  expectedAnswerRate,
        answer_rate_status:    answerRateStatus,
        outbound_answered:     outboundAnswered,
        outbound_rate:         outboundRate,
        expected_outbound:     expectedOutbound,
        outbound_activity:     outboundActivity,
        calls_per_hour:        Math.round(callsPerHour * 100) / 100,
        expected_calls_per_hour: expectedCallsPerHour,
        call_volume_status:    callVolumeStatus,
      };

      const row = ws.addRow(rowData);
      row.height = 18;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(bgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: thinBorder, right: thinBorder };

        // Source columns: integer formatting
        if ([3, 4, 5, 6, 7, 13].includes(colNum)) cell.numFmt = "#,##0";
        // Duration columns: 2 decimal places (minutes)
        if ([8, 9, 10].includes(colNum)) cell.numFmt = "#,##0.00";
        // Percent columns
        if ([14, 15, 18, 19].includes(colNum)) cell.numFmt = "0.00%";
        // Calls per hour: 2 decimal
        if (colNum === 21) cell.numFmt = "#,##0.00";
        // Expected calls per hour: integer
        if (colNum === 22) cell.numFmt = "#,##0";

        // Conditional colors for status columns
        if (colNum === 16) { // Answer Rate Status (P)
          cell.fill = mkFill(arStatusColor.bg);
          cell.font = mkFont({ color: { argb: arStatusColor.fg }, bold: true });
        }
        if (colNum === 20) { // Outbound Activity (T)
          cell.fill = mkFill(outActColor.bg);
          cell.font = mkFont({ color: { argb: outActColor.fg }, bold: true });
        }
        if (colNum === 23) { // Call Volume Status (W)
          cell.fill = mkFill(volStatusColor.bg);
          cell.font = mkFont({ color: { argb: volStatusColor.fg }, bold: true });
        }
      });

      tableRows.push(row.values.slice(1));
    });

  // ── Register as Excel Table ───────────────────────────────────────────────
  if (tableRows.length > 0) {
    ws.addTable({
      name: "RawPerformanceData",
      ref:  `A1:W${1 + tableRows.length}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: ws.columns.map(c => ({ name: c.header, filterButton: true })),
      rows: tableRows,
    });
  }

  autoFitColumns(ws);
}