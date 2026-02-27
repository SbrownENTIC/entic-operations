import { base44 } from "@/api/base44Client";
import ExcelJS from "exceljs";
import { secondsToHHMMSS, minutesToHHMMSS } from "./ExcelExportHelpers";

export async function exportPeriodExcel(selectedPeriod, enrichedSummaries, sortedWeeks, userConfigMap) {
  if (!selectedPeriod) return;
  const freshPeriod = await base44.entities.CallLogPeriod.get(selectedPeriod.id);
  if (!freshPeriod) { alert("Error: Could not load period data. Please try again."); return; }
  
  const monthKey = freshPeriod.monthly_key;
  const periodLabel = formatPeriodLabel(freshPeriod);
  const uploadedWeeks = freshPeriod.uploaded_weeks || [];
  const now = new Date();
  const generatedOn = now.toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" }) + " " + now.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });
  
  // Colors
  const DARK_NAVY  = "FF1F3864", SECTION_BG = "FF2E5096", LIGHT_GRAY = "FFF5F5F5", ALT_ROW = "FFEEF2FA", WHITE = "FFFFFFFF", TOTALS_BG = "FFD9E1F2", HEADER_BG = "FF344D7E";
  const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
  const thinBorder = { style: "thin", color: { argb: "FFDDDDDD" } };
  const medBorder  = { style: "medium", color: { argb: DARK_NAVY } };
  
  // Helpers
  const addSectionHeader = (ws, text, numCols, startCol = "A") => {
    const row = ws.addRow([text, ...Array(numCols - 1).fill("")]);
    const endCol = String.fromCharCode(startCol.charCodeAt(0) + numCols - 1);
    ws.mergeCells(`${startCol}${ws.rowCount}:${endCol}${ws.rowCount}`);
    const cell = ws.getCell(`${startCol}${ws.rowCount}`);
    cell.font = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
    cell.fill = mkFill(SECTION_BG);
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    row.height = 24;
    return row;
  };
  
  const styleTableHeader = (row, numCols, leftAlignUpTo = 1) => {
    row.height = 30;
    for (let c = 1; c <= numCols; c++) {
      const cell = row.getCell(c);
      cell.font = mkFont({ bold: true, color: { argb: WHITE } });
      cell.fill = mkFill(HEADER_BG);
      cell.alignment = { horizontal: c <= leftAlignUpTo ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
    }
  };
  
  const arColor = (rate) => {
    if (rate === null || rate === undefined) return { bg: WHITE, fg: "FF888888" };
    if (rate >= 0.5)  return { bg: "FFC6EFCE", fg: "FF276221" };
    if (rate >= 0.2)  return { bg: "FFFFEB9C", fg: "FF9C6500" };
    return { bg: "FFFFC7CE", fg: "FF9C0006" };
  };
  
  const formatDate = (str) => {
    if (!str) return "";
    const [y, m, d] = str.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  };
  
  const formatPeriodLabel = (period) => {
    const key = period.monthly_key || period.reporting_period_start?.substring(0, 7);
    if (key) {
      const d = new Date(key + "-01T12:00:00");
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return "";
  };
  
  // Create workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "ENTIC Operations Center";
  const wsName = periodLabel.substring(0, 31);
  const ws = wb.addWorksheet(wsName, { views: [{ showGridLines: false }] });
  ws.columns = [
    { width: 14 }, { width: 14 }, { width: 30 }, { width: 13 }, { width: 13 },
    { width: 13 }, { width: 13 }, { width: 11 }, { width: 22 }, { width: 16 }, { width: 24 },
  ];
  
  // Title
  ws.addRow([`${periodLabel} - Call Log`, ...Array(10).fill("")]);
  ws.mergeCells(`A1:K1`);
  const titleCell = ws.getCell("A1");
  titleCell.font = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
  titleCell.fill = mkFill(DARK_NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 40;
  
  // Reporting period
  ws.addRow([`Reporting Period: ${periodLabel}`]);
  ws.getCell("A2").font = mkFont({ bold: true });
  ws.getRow(2).height = 18;
  
  ws.addRow([`Generated On: ${generatedOn}`]);
  ws.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
  ws.getRow(3).height = 18;
  
  // Export continues with sheets...
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${periodLabel} – Call Performance Report.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}