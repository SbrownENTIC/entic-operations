import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Phone, AlertCircle, CheckCircle, Loader2, Download, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import ExcelJS from "exceljs";

// ---- Formatting helpers ----
function secondsToHHMMSS(seconds) {
  if (!seconds || seconds === 0) return "0:00:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPercent(val) {
  if (!val && val !== 0) return "0.0%";
  return (val * 100).toFixed(1) + "%";
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

// ---- Header normalization ----
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, ' ').trim();
}

const REQUIRED_NORMALIZED = [
  "user",
  "total calls",
  "inbound calls",
  "outbound calls",
  "answered calls",
  "missed calls",
  "voicemail calls",
  "total call duration (minutes)",
  "inbound call duration (minutes)",
  "outbound call duration (minutes)"
];

// ---- File parsing ----

/** Reads an xlsx/xls file with ExcelJS and returns { workbook, sheetNames } */
async function readWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheetNames = wb.worksheets.map(s => s.name);
  return { workbook: wb, sheetNames };
}

/** Converts an ExcelJS worksheet to an array-of-objects (like XLSX sheet_to_json) */
function sheetToJson(worksheet) {
  const rows = [];
  let headers = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values.slice(1); // row.values is 1-indexed with undefined at [0]
    if (rowNum === 1) {
      headers = values.map(v => (v == null ? "" : String(v)));
    } else {
      const obj = {};
      headers.forEach((h, i) => {
        let val = values[i];
        if (val == null) val = "";
        else if (typeof val === "object" && val.result != null) val = val.result; // formula cell
        else if (typeof val === "object" && val.text != null) val = val.text;    // rich text
        obj[h] = val;
      });
      rows.push(obj);
    }
  });
  return rows;
}

/** Parses a CSV file into array-of-objects */
function readCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) { resolve([]); return; }
        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        const rows = lines.slice(1).map(line => {
          const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
          return obj;
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function formatPeriodLabel(period) {
  if (!period) return "";
  const start = period.reporting_period_start;
  const end = period.reporting_period_end;
  if (period.status === "Monthly") {
    const d = new Date(start + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  // Weekly or Custom
  const fmtShort = (str) => {
    if (!str) return "";
    const [y, m, day] = str.split("-");
    return `${parseInt(m, 10)}/${parseInt(day, 10)}/${y}`;
  };
  return `${fmtShort(start)} – ${fmtShort(end)}`;
}

const STATUS_COLORS = {
  Monthly: "bg-blue-100 text-blue-800",
  Weekly: "bg-green-100 text-green-800",
  "Custom Range": "bg-purple-100 text-purple-800"
};

export default function CallLogReporting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);        // parsed XLSX workbook (for multi-sheet)
  const [sheetNames, setSheetNames] = useState([]);      // list of sheet names from workbook
  const [selectedSheet, setSelectedSheet] = useState(""); // chosen sheet name
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(null); // holds { rows, periodStart, periodEnd } pending confirmation
  const [sortCol, setSortCol] = useState("user");
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc" | null (null = default)

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["call-log-periods"],
    queryFn: () => base44.entities.CallLogPeriod.list("-uploaded_at")
  });

  // Auto-select default period on load
  React.useEffect(() => {
    if (!periods.length || selectedPeriod) return;
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    const monthly = periods.find(p => {
      if (p.status !== "Monthly") return false;
      const d = new Date(p.reporting_period_start + "T12:00:00");
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    setSelectedPeriod(monthly || periods[0]);
  }, [periods]);

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriod?.id],
    queryFn: () => base44.entities.CallLogUserSummary.filter({ period_id: selectedPeriod.id }),
    enabled: !!selectedPeriod?.id
  });

  const activeSummaries = userSummaries
    .filter(u => (u.total_calls || 0) > 0)
    .sort((a, b) => (a.user || "").trim().toLowerCase().localeCompare((b.user || "").trim().toLowerCase()));

  // Aggregate summary totals
  const totalCalls    = activeSummaries.reduce((s, u) => s + (u.total_calls || 0), 0);
  const totalInbound  = activeSummaries.reduce((s, u) => s + (u.inbound || 0), 0);
  const totalOutbound = activeSummaries.reduce((s, u) => s + (u.outbound || 0), 0);
  const totalAnswered = activeSummaries.reduce((s, u) => s + (u.answered || 0), 0);
  const totalMissed   = activeSummaries.reduce((s, u) => s + (u.missed || 0), 0);
  const totalDurationSec = activeSummaries.reduce((s, u) => s + (u.total_duration_seconds || 0), 0);
  const overallAnswerRate   = totalCalls > 0 ? totalAnswered / totalCalls : 0;
  const overallAvgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0;

  const resetUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setUploadError("");
    setPeriodStart("");
    setPeriodEnd("");
    setReplaceConfirm(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      try {
        const { workbook: wb, sheetNames: names } = await readWorkbookFile(file);
        setWorkbook(wb);
        setSheetNames(names);
        if (names.length === 1) {
          setSelectedSheet(names[0]); // auto-select single sheet
        }
        // else: user must choose
      } catch (err) {
        console.error("Excel read error:", err);
        setUploadError("Failed to read Excel file: " + (err.message || "unknown error"));
      }
    }
    // CSV: no sheet selection needed
  };

  const validateAndGetRows = () => {
    const isXlsx = uploadFile?.name.toLowerCase().endsWith(".xlsx") || uploadFile?.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      if (!workbook) return { error: "Failed to read workbook." };
      const sheetName = selectedSheet || (workbook.worksheets[0]?.name);
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) return { error: "Worksheet not found." };
      const rows = sheetToJson(worksheet);
      if (!rows || rows.length === 0) return { error: "Selected worksheet contains no data rows." };
      const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
      if (missing.length > 0) return { error: "Invalid worksheet format. Required headers are missing." };
      return { rows };
    }
    return null; // CSV handled async in handleUpload
  };

  const submitUpload = async (rows) => {
    try {
      const response = await base44.functions.invoke("processCallLog", {
        rows,
        periodStart,
        periodEnd,
        fileName: uploadFile.name
      });

      const result = response.data;
      if (result.error) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }

      // Refresh periods and auto-select the new/replaced period
      await queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
      queryClient.invalidateQueries({ queryKey: ["call-log-summaries"] });

      // Fetch fresh periods list to find the new record
      const freshPeriods = await base44.entities.CallLogPeriod.list("-uploaded_at");
      const newPeriod = freshPeriods.find(p =>
        p.reporting_period_start === periodStart && p.reporting_period_end === periodEnd
      );
      if (newPeriod) setSelectedPeriod(newPeriod);

      toast({
        title: result.is_replacement ? "Period Replaced" : "Upload Successful",
        description: `Imported ${result.users_imported} user(s) for ${formatDate(periodStart)} – ${formatDate(periodEnd)} (${result.status}).`
      });

      resetUpload();
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    }
    setUploading(false);
  };

  const handleUpload = async () => {
    setUploadError("");
    if (!uploadFile)  { setUploadError("Please select a file."); return; }
    if (!periodStart) { setUploadError("Reporting Period Start Date is required."); return; }
    if (!periodEnd)   { setUploadError("Reporting Period End Date is required."); return; }
    if (periodEnd < periodStart) { setUploadError("End date must be on or after start date."); return; }

    const isXlsx = uploadFile.name.toLowerCase().endsWith(".xlsx");
    if (isXlsx && sheetNames.length > 1 && !selectedSheet) {
      setUploadError("Please select a worksheet to import.");
      return;
    }

    setUploading(true);
    let rows;

    if (isXlsx) {
      const result = validateAndGetRows();
      if (result?.error) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }
      rows = result.rows;
    } else {
      try {
        rows = await readCSV(uploadFile);
      } catch {
        setUploadError("Failed to parse CSV file.");
        setUploading(false);
        return;
      }
      if (!rows || rows.length === 0) {
        setUploadError("File contains no data rows.");
        setUploading(false);
        return;
      }
      const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
      if (missing.length > 0) {
        setUploadError("Invalid worksheet format. Required headers are missing.");
        setUploading(false);
        return;
      }
    }

    // Check for duplicate period client-side before submitting
    const duplicate = periods.find(
      p => p.reporting_period_start === periodStart && p.reporting_period_end === periodEnd
    );
    if (duplicate) {
      setReplaceConfirm({ rows });
      setUploading(false);
      return;
    }

    await submitUpload(rows);
  };

  const handleConfirmReplace = async () => {
    if (!replaceConfirm) return;
    setReplaceConfirm(null);
    setUploading(true);
    await submitUpload(replaceConfirm.rows);
  };

  const handleDelete = async () => {
    if (!deleteDialogPeriod) return;
    setDeleting(true);
    const summaries = await base44.entities.CallLogUserSummary.filter({ period_id: deleteDialogPeriod.id });
    for (const s of summaries) {
      await base44.entities.CallLogUserSummary.delete(s.id);
    }
    await base44.entities.CallLogPeriod.delete(deleteDialogPeriod.id);
    queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
    if (selectedPeriod?.id === deleteDialogPeriod.id) {
      setSelectedPeriod(null);
    }
    setDeleteDialogPeriod(null);
    setDeleting(false);
    toast({ title: "Deleted", description: "Reporting period deleted." });
  };

  const exportPeriodExcel = async () => {
    if (!selectedPeriod) return;

    console.log("Formatted Excel export triggered for period:", selectedPeriod.id);

    const periodLabel = formatPeriodLabel(selectedPeriod);
    const startStr = selectedPeriod.reporting_period_start;
    const endStr   = selectedPeriod.reporting_period_end;

    const fmtShort = (str) => {
      if (!str) return "";
      const [y, m, d] = str.split("-");
      return `${parseInt(m,10)}/${parseInt(d,10)}/${y}`;
    };
    const now = new Date();
    const generatedOn = now.toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" }) +
      " " + now.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });

    // ---- Colors ----
    const DARK_BLUE  = "FF1F3864";
    const MED_BLUE   = "FF2E5096";
    const LIGHT_GRAY = "FFF2F2F2";
    const WHITE      = "FFFFFFFF";
    const ALT_BLUE   = "FFEBF0F8";
    const TOTALS_BG  = "FFD9E1F2";

    const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });

    const wb = new ExcelJS.Workbook();
    wb.creator = "ENTIC Operations Center";
    const ws = wb.addWorksheet(periodLabel.substring(0, 31), {
      views: [{ showGridLines: false, state: "frozen", ySplit: 0, xSplit: 0 }]
    });

    // Column widths
    ws.columns = [
      { width: 32 }, { width: 13 }, { width: 13 }, { width: 13 },
      { width: 13 }, { width: 11 }, { width: 22 }, { width: 16 }, { width: 24 },
    ];

    // ---- ROW 1: Title merged A1:I1 ----
    ws.addRow([`${periodLabel} - Call Log`, "", "", "", "", "", "", "", ""]);
    ws.mergeCells("A1:I1");
    const titleCell = ws.getCell("A1");
    titleCell.font   = mkFont({ bold: true, size: 18, color: { argb: "FFFFFFFF" } });
    titleCell.fill   = mkFill(DARK_BLUE);
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.border = { bottom: { style: "medium", color: { argb: DARK_BLUE } } };
    ws.getRow(1).height = 36;

    // ---- ROW 2: Reporting Period ----
    ws.addRow([`Reporting Period: ${fmtShort(startStr)} – ${fmtShort(endStr)}`]);
    ws.getCell("A2").font = mkFont({ bold: true });
    ws.getRow(2).height = 18;

    // ---- ROW 3: Generated On ----
    ws.addRow([`Generated On: ${generatedOn}`]);
    ws.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
    ws.getRow(3).height = 18;

    // ---- ROW 4: Blank ----
    ws.addRow([]);

    // ---- ROW 5: Metrics header ----
    ws.addRow(["Summary Metrics", ""]);
    ws.mergeCells("A5:B5");
    const mhCell = ws.getCell("A5");
    mhCell.font  = mkFont({ bold: true, size: 12, color: { argb: "FFFFFFFF" } });
    mhCell.fill  = mkFill(MED_BLUE);
    ws.getRow(5).height = 20;

    // ---- METRICS ROWS (6–13) ----
    const metrics = [
      ["Total Calls",      totalCalls,                         "number"],
      ["Inbound",          totalInbound,                       "number"],
      ["Outbound",         totalOutbound,                      "number"],
      ["Answered",         totalAnswered,                      "number"],
      ["Missed",           totalMissed,                        "number"],
      ["Answer Rate",      (overallAnswerRate * 100).toFixed(1) + "%", "text"],
      ["Total Duration",   secondsToHHMMSS(totalDurationSec),  "text"],
      ["Average Duration", secondsToHHMMSS(overallAvgDurationSec), "text"],
    ];
    metrics.forEach(([label, val, type], idx) => {
      const row = ws.addRow([label, val]);
      const bgArgb = idx % 2 === 0 ? ALT_BLUE : WHITE;
      row.height = 18;
      const labelCell = row.getCell(1);
      const valCell   = row.getCell(2);
      labelCell.font  = mkFont({ bold: true });
      labelCell.fill  = mkFill(bgArgb);
      labelCell.alignment = { horizontal: "left", vertical: "middle" };
      valCell.font    = mkFont({ bold: true, size: 12 });
      valCell.fill    = mkFill(bgArgb);
      valCell.alignment = { horizontal: "right", vertical: "middle" };
      if (type === "number") valCell.numFmt = "#,##0";
      [labelCell, valCell].forEach(c => {
        c.border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
      });
    });

    // ---- ROW blank ----
    ws.addRow([]);

    // ---- TABLE HEADER ----
    const tableHeaderRowNum = ws.rowCount + 1;
    const headers = ["User","Total Calls","Inbound","Outbound","Answered","Missed","Duration (HH:MM:SS)","Answer Rate (%)","Avg Duration (HH:MM:SS)"];
    const hRow = ws.addRow(headers);
    hRow.height = 20;
    hRow.eachCell(cell => {
      cell.font      = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill      = mkFill(DARK_BLUE);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border    = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } } };
    });

    // Freeze pane at table header row
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: tableHeaderRowNum, xSplit: 0 }];

    // ---- USER DATA ROWS ----
    activeSummaries.forEach((u, idx) => {
      const ar = u.total_calls ? (u.answered || 0) / u.total_calls : (u.answer_rate || 0);
      const arPct = parseFloat((ar * 100).toFixed(1));
      const rowBgArgb = idx % 2 !== 0 ? LIGHT_GRAY : WHITE;

      const row = ws.addRow([
        u.user || "",
        u.total_calls || 0,
        u.inbound || 0,
        u.outbound || 0,
        u.answered || 0,
        u.missed || 0,
        secondsToHHMMSS(u.total_duration_seconds),
        arPct,
        secondsToHHMMSS(u.avg_duration_seconds),
      ]);
      row.height = 18;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(rowBgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
        if ([2,3,4,5,6].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 8) {
          cell.numFmt = '0.0"%"';
          // Color-code answer rate
          const arArgbBg = ar >= 0.85 ? "FFC6EFCE" : ar >= 0.60 ? "FFFFEB9C" : "FFFFC7CE";
          const arArgbFg = ar >= 0.85 ? "FF276221" : ar >= 0.60 ? "FF9C6500" : "FF9C0006";
          cell.fill = mkFill(arArgbBg);
          cell.font = mkFont({ color: { argb: arArgbFg } });
        }
      });
    });

    // ---- TOTALS ROW ----
    const totalsAr = totalCalls > 0 ? overallAnswerRate : 0;
    const totalsArPct = parseFloat((totalsAr * 100).toFixed(1));
    const totalsRow = ws.addRow([
      "TOTALS",
      totalCalls,
      totalInbound,
      totalOutbound,
      totalAnswered,
      totalMissed,
      secondsToHHMMSS(totalDurationSec),
      totalsArPct,
      secondsToHHMMSS(overallAvgDurationSec),
    ]);
    totalsRow.height = 20;
    totalsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill      = mkFill(TOTALS_BG);
      cell.font      = mkFont({ bold: true });
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
      cell.border    = { top: { style: "medium", color: { argb: DARK_BLUE } } };
      if ([2,3,4,5,6].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 8) cell.numFmt = '0.0"%"';
    });

    // ---- Write and download ----
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${periodLabel} - Call Log.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- DROPDOWN DASHBOARD VIEW ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Call Log Reporting
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Vonage call analytics by reporting period</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Upload className="w-4 h-4" /> Upload Call Log
        </Button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Upload Vonage Call Log Export</h3>
              <Button variant="ghost" size="sm" onClick={resetUpload}>✕</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Reporting Period Start Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Reporting Period End Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                File (.xlsx or .csv) <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
              {uploadFile && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" /> {uploadFile.name}
                </p>
              )}
            </div>

            {/* Worksheet selector – only for multi-sheet xlsx */}
            {sheetNames.length > 1 && (
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Select Worksheet to Import <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSheet}
                  onChange={e => { setSelectedSheet(e.target.value); setUploadError(""); }}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Choose a worksheet —</option>
                  {sheetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Single sheet auto-selected notice */}
            {sheetNames.length === 1 && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-600" /> Worksheet: <strong>{sheetNames[0]}</strong> (auto-selected)
              </p>
            )}

            <div className="text-xs text-slate-500 bg-white/60 border border-slate-200 rounded p-2.5">
              <strong>Required Vonage headers:</strong> User, Total Calls, Inbound Calls, Outbound Calls, Answered Calls, Missed Calls, Voicemail Calls, Total call Duration (Minutes), Inbound Call Duration (Minutes), Outbound call Duration (Minutes)<br />
              <span className="text-slate-400">Header matching is case-insensitive. Duration columns must be the numeric minutes columns.</span>
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {uploadError}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : <><Upload className="w-4 h-4" /> Process Upload</>}
              </Button>
              <Button variant="outline" onClick={resetUpload}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reporting Period Dropdown */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Reporting Period</label>
        {periodsLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : periods.length === 0 ? (
          <p className="text-sm text-slate-400">No periods uploaded yet.</p>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={selectedPeriod?.id || ""}
              onChange={e => {
                const p = periods.find(p => p.id === e.target.value);
                setSelectedPeriod(p || null);
              }}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>{formatPeriodLabel(p)}</option>
              ))}
            </select>
            {selectedPeriod && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                title="Delete this period"
                onClick={() => setDeleteDialogPeriod(selectedPeriod)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dashboard – always visible once a period is selected */}
      {selectedPeriod && (
        <div className="space-y-4">
          {/* Period info bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[selectedPeriod.status] || "bg-slate-100 text-slate-700"}`}>
              {selectedPeriod.status}
            </span>
            {selectedPeriod.source_file_name && (
              <span className="text-xs text-slate-400">{selectedPeriod.source_file_name}</span>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={exportPeriodExcel} className="gap-2">
                <Download className="w-4 h-4" /> Export Excel Report
              </Button>
            </div>
          </div>

          {summariesLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
          ) : (
            <>
              {/* Summary metric cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Calls",    value: totalCalls.toLocaleString(),            color: "text-slate-900" },
                  { label: "Inbound",        value: totalInbound.toLocaleString(),           color: "text-blue-700" },
                  { label: "Outbound",       value: totalOutbound.toLocaleString(),          color: "text-indigo-700" },
                  { label: "Answered",       value: totalAnswered.toLocaleString(),          color: "text-green-700" },
                  { label: "Missed",         value: totalMissed.toLocaleString(),            color: "text-red-600" },
                  { label: "Answer Rate",    value: (totalCalls > 0 ? (overallAnswerRate * 100).toFixed(1) : "0.0") + "%",
                    color: overallAnswerRate >= 0.8 ? "text-green-700" : overallAnswerRate >= 0.5 ? "text-yellow-700" : "text-red-600" },
                  { label: "Total Duration", value: secondsToHHMMSS(totalDurationSec),      color: "text-slate-700" },
                  { label: "Avg Duration",   value: secondsToHHMMSS(overallAvgDurationSec), color: "text-slate-700" },
                ].map(m => (
                  <Card key={m.label} className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-slate-500 mb-1">{m.label}</p>
                      <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* User breakdown table */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 py-3 px-4">
                  <CardTitle className="text-sm font-semibold text-slate-700">User Breakdown — {activeSummaries.length} users</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["User","Total Calls","Inbound","Outbound","Answered","Missed","Duration (HH:MM:SS)","Answer Rate","Avg Duration (HH:MM:SS)"].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSummaries.map((u, i) => {
                          const ar = u.answered != null && u.total_calls ? u.answered / u.total_calls : (u.answer_rate || 0);
                          return (
                            <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                              <td className="px-4 py-2.5 font-medium text-slate-800">{u.user}</td>
                              <td className="px-4 py-2.5 text-slate-700">{(u.total_calls || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-blue-700">{(u.inbound || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-indigo-700">{(u.outbound || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-green-700">{(u.answered || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-red-600">{(u.missed || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.total_duration_seconds)}</td>
                              <td className="px-4 py-2.5">
                                <span className={`font-semibold ${ar >= 0.8 ? "text-green-700" : ar >= 0.5 ? "text-yellow-700" : "text-red-600"}`}>
                                  {(ar * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.avg_duration_seconds)}</td>
                            </tr>
                          );
                        })}
                        {activeSummaries.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No user data for this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Replace existing period confirmation */}
      <AlertDialog open={!!replaceConfirm} onOpenChange={open => !open && setReplaceConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Report?</AlertDialogTitle>
            <AlertDialogDescription>
              A report for this period ({formatDate(periodStart)} – {formatDate(periodEnd)}) already exists. Replace existing data?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReplaceConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace} className="bg-blue-600 hover:bg-blue-700">
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDialogPeriod} onOpenChange={open => !open && setDeleteDialogPeriod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reporting Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this reporting period and all associated user data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}