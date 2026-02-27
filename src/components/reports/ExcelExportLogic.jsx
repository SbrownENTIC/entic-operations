import ExcelJS from "exceljs";
import { minutesToHHMMSS, secondsToHHMMSS, formatDate, parseWeekDate } from "./ExcelExportHelpers";

// This module contains complex Excel export logic extracted to reduce CallLogReporting.jsx size

export function setupExcelColors() {
  return {
    DARK_NAVY: "FF1F3864",
    SECTION_BG: "FF2E5096",
    LIGHT_GRAY: "FFF5F5F5",
    ALT_ROW: "FFEEF2FA",
    WHITE: "FFFFFFFF",
    TOTALS_BG: "FFD9E1F2",
    HEADER_BG: "FF344D7E",
  };
}

export function createFontAndBorderHelpers(colors) {
  const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
  const thinBorder = { style: "thin", color: { argb: "FFDDDDDD" } };
  const medBorder  = { style: "medium", color: { argb: colors.DARK_NAVY } };
  return { mkFill, mkFont, thinBorder, medBorder };
}

export function addSectionHeader(ws, text, numCols, mkFill, mkFont, colors, startCol = "A") {
  const row = ws.addRow([text, ...Array(numCols - 1).fill("")]);
  const endCol = String.fromCharCode(startCol.charCodeAt(0) + numCols - 1);
  ws.mergeCells(`${startCol}${ws.rowCount}:${endCol}${ws.rowCount}`);
  const cell = ws.getCell(`${startCol}${ws.rowCount}`);
  cell.font      = mkFont({ bold: true, size: 13, color: { argb: colors.WHITE } });
  cell.fill      = mkFill(colors.SECTION_BG);
  cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  row.height = 24;
  return row;
}

export function styleTableHeader(row, numCols, mkFont, mkFill, colors, leftAlignUpTo = 1) {
  row.height = 30;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font      = mkFont({ bold: true, color: { argb: colors.WHITE } });
    cell.fill      = mkFill(colors.HEADER_BG);
    cell.alignment = { horizontal: c <= leftAlignUpTo ? "left" : "center", vertical: "middle", wrapText: true };
    cell.border    = { bottom: { style: "medium", color: { argb: colors.WHITE } }, right: { style: "thin", color: { argb: "FFDDDDDD" } } };
  }
}

export function getAnswerRateColor(rate, colors) {
  if (rate === null || rate === undefined) return { bg: colors.WHITE, fg: "FF888888" };
  if (rate >= 0.5)  return { bg: "FFC6EFCE", fg: "FF276221" };
  if (rate >= 0.2)  return { bg: "FFFFEB9C", fg: "FF9C6500" };
  return                   { bg: "FFFFC7CE", fg: "FF9C0006" };
}

export function getPerformanceColor(pct) {
  if (pct >= 1.0) return { bg: "FFC6EFCE", fg: "FF276221" };
  if (pct >= 0.9) return { bg: "FFFFEB9c", fg: "FF9C6500" };
  return               { bg: "FFFFC7CE", fg: "FF9C0006" };
}