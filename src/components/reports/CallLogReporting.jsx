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

const PERIOD_COL_START = "reporting period start";
const PERIOD_COL_END   = "reporting period end";

/** Detect unique week (start, end) pairs from rows for display */
function detectWeekSummary(rows) {
  if (!rows || rows.length === 0) return [];
  const firstRow = rows[0];
  const rawKeys = Object.keys(firstRow);
  const startKey = rawKeys.find(k => normalizeHeader(k) === PERIOD_COL_START);
  const endKey   = rawKeys.find(k => normalizeHeader(k) === PERIOD_COL_END);
  if (!startKey || !endKey) return [];

  const seen = new Set();
  const pairs = [];
  for (const row of rows) {
    const start = toIsoDate(row[startKey]);
    const end   = toIsoDate(row[endKey]);
    if (!start || !end) continue;
    const key = `${start}|${end}`;
    if (!seen.has(key)) { seen.add(key); pairs.push({ start, end }); }
  }
  return pairs;
}

/** Convert Excel serial date or date string to YYYY-MM-DD */
function toIsoDate(val) {
  if (!val && val !== 0) return null;
  // Excel serial number (number type)
  if (typeof val === "number") {
    // Excel date serial: days since 1899-12-30
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // Date object (ExcelJS may return Date objects)
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // String: try to normalise to YYYY-MM-DD
  const s = String(val).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${String(mdy[1]).padStart(2,"0")}-${String(mdy[2]).padStart(2,"0")}`;
  // Try native parse as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  return null;
}

/**
 * Validate that Reporting Period Start/End columns exist in rows.
 * Multi-week is allowed — multiple unique pairs are valid.
 * Returns { ok: true } or { error: string }.
 */
function validatePeriodColumns(rows) {
  if (!rows || rows.length === 0) return { error: "No data rows." };
  const firstRow = rows[0];
  const headers = Object.keys(firstRow).map(normalizeHeader);
  const hasStart = headers.includes(PERIOD_COL_START);
  const hasEnd   = headers.includes(PERIOD_COL_END);
  if (!hasStart || !hasEnd) {
    return { error: "Reporting Period Start and End columns are required in the worksheet." };
  }
  return { ok: true };
}

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
  // Always show Month Year for monthly aggregation mode
  const key = period.monthly_key || period.reporting_period_start?.substring(0, 7);
  if (key) {
    const d = new Date(key + "-01T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const start = period.reporting_period_start;
  const fmtShort = (str) => {
    if (!str) return "";
    const [y, m, day] = str.split("-");
    return `${parseInt(m, 10)}/${parseInt(day, 10)}/${y}`;
  };
  return fmtShort(start);
}

const STATUS_COLORS = {
  "Monthly": "bg-blue-100 text-blue-800",
  "Monthly (Aggregated)": "bg-indigo-100 text-indigo-800",
  "Weekly": "bg-green-100 text-green-800",
  "Custom Range": "bg-purple-100 text-purple-800"
};

export default function CallLogReporting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [weekSummary, setWeekSummary] = useState([]); // detected week pairs [{start,end}]
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sortCol, setSortCol] = useState("user");
  const [sortDir, setSortDir] = useState("asc");
  const [userSearch, setUserSearch] = useState("");

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["call-log-periods"],
    queryFn: () => base44.entities.CallLogPeriod.list("-uploaded_at")
  });

  // Auto-select default period on load
  React.useEffect(() => {
    if (!periods.length || selectedPeriod) return;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthly = periods.find(p => p.monthly_key === currentMonthKey);
    setSelectedPeriod(monthly || periods[0]);
  }, [periods]);

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriod?.id],
    queryFn: () => base44.entities.CallLogUserSummary.filter({ period_id: selectedPeriod.id }),
    enabled: !!selectedPeriod?.id
  });

  // Helper: convert HH:MM:SS string to seconds for sort
  const hmsToSeconds = (hms) => {
    if (!hms || hms === "0:00:00") return 0;
    const parts = String(hms).split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const TABLE_COLS = [
    { key: "user",                  label: "User",                    type: "alpha" },
    { key: "total_calls",           label: "Total Calls",             type: "num"   },
    { key: "inbound",               label: "Inbound",                 type: "num"   },
    { key: "outbound",              label: "Outbound",                type: "num"   },
    { key: "answered",              label: "Answered",                type: "num"   },
    { key: "missed",                label: "Missed",                  type: "num"   },
    { key: "total_duration_seconds",label: "Duration (HH:MM:SS)",     type: "num"   },
    { key: "answer_rate",           label: "Answer Rate",             type: "num"   },
    { key: "avg_duration_seconds",  label: "Avg Duration (HH:MM:SS)", type: "num"   },
  ];

  const handleSortClick = (colKey) => {
    if (sortCol === colKey) {
      if (sortDir === "asc")  { setSortDir("desc"); }
      else if (sortDir === "desc") { setSortCol("user"); setSortDir("asc"); } // reset to default
      else                    { setSortDir("asc"); }
    } else {
      setSortCol(colKey);
      setSortDir("asc");
    }
  };

  const getSortValue = (u, key) => {
    if (key === "answer_rate") return u.total_calls ? (u.answered || 0) / u.total_calls : (u.answer_rate || 0);
    return u[key] ?? 0;
  };

  // Reset search + sort when period changes
  React.useEffect(() => {
    setUserSearch("");
    setSortCol("user");
    setSortDir("asc");
  }, [selectedPeriod?.id]);

  const activeSummaries = [...userSummaries.filter(u => (u.total_calls || 0) > 0)]
    .sort((a, b) => {
      const col = TABLE_COLS.find(c => c.key === sortCol);
      if (!col) return 0;
      const dir = sortDir === "desc" ? -1 : 1;
      if (col.type === "alpha") {
        return dir * (a.user || "").trim().toLowerCase().localeCompare((b.user || "").trim().toLowerCase());
      }
      return dir * (getSortValue(a, sortCol) - getSortValue(b, sortCol));
    });

  const searchTerm = userSearch.trim().toLowerCase();
  const filteredSummaries = searchTerm
    ? activeSummaries.filter(u => (u.user || "").trim().toLowerCase().includes(searchTerm))
    : activeSummaries;

  // Highlight helper
  const highlightUser = (name) => {
    if (!searchTerm) return name;
    const idx = (name || "").toLowerCase().indexOf(searchTerm);
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="bg-yellow-200 text-inherit rounded-sm px-0">{name.slice(idx, idx + searchTerm.length)}</mark>
        {name.slice(idx + searchTerm.length)}
      </>
    );
  };

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
    setWeekSummary([]);
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
    setPeriodStart("");
    setPeriodEnd("");

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      try {
        const { workbook: wb, sheetNames: names } = await readWorkbookFile(file);
        setWorkbook(wb);
        setSheetNames(names);
        if (names.length === 1) {
          setSelectedSheet(names[0]);
          const ws = wb.getWorksheet(names[0]);
          if (ws) {
            const rows = sheetToJson(ws);
            const { error } = validatePeriodColumns(rows);
            if (error) setUploadError(error);
            else {
              // Show detected week ranges as summary info (set periodStart/End to first/last)
              setWeekSummary(detectWeekSummary(rows));
            }
          }
        }
      } catch (err) {
        console.error("Excel read error:", err);
        setUploadError("Failed to read Excel file: " + (err.message || "unknown error"));
      }
    } else {
      try {
        const rows = await readCSV(file);
        const { error } = validatePeriodColumns(rows);
        if (error) setUploadError(error);
        else setWeekSummary(detectWeekSummary(rows));
      } catch (err) {
        setUploadError("Failed to read CSV file.");
      }
    }
  };

  const getRows = async () => {
    const isXlsx = uploadFile?.name.toLowerCase().endsWith(".xlsx") || uploadFile?.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      if (!workbook) return { error: "Failed to read workbook." };
      const sheetName = selectedSheet || workbook.worksheets[0]?.name;
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) return { error: "Worksheet not found." };
      const rows = sheetToJson(worksheet);
      if (!rows || rows.length === 0) return { error: "Selected worksheet contains no data rows." };
      const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
      if (missing.length > 0) return { error: "Invalid worksheet format. Required headers are missing." };
      const { error: colError } = validatePeriodColumns(rows);
      if (colError) return { error: colError };
      return { rows };
    } else {
      try {
        const rows = await readCSV(uploadFile);
        if (!rows || rows.length === 0) return { error: "File contains no data rows." };
        const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
        const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
        if (missing.length > 0) return { error: "Invalid worksheet format. Required headers are missing." };
        const { error: colError } = validatePeriodColumns(rows);
        if (colError) return { error: colError };
        return { rows };
      } catch {
        return { error: "Failed to parse CSV file." };
      }
    }
  };

  const handleUpload = async () => {
    setUploadError("");
    if (!uploadFile) { setUploadError("Please select a file."); return; }

    const isXlsx = uploadFile.name.toLowerCase().endsWith(".xlsx") || uploadFile.name.toLowerCase().endsWith(".xls");
    if (isXlsx && sheetNames.length > 1 && !selectedSheet) {
      setUploadError("Please select a worksheet to import.");
      return;
    }

    setUploading(true);
    const { rows, error: rowError } = await getRows();
    if (rowError) {
      setUploadError(rowError);
      setUploading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke("processCallLog", {
        rows,
        fileName: uploadFile.name
      });

      const result = response.data;

      if (result.error) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
      queryClient.invalidateQueries({ queryKey: ["call-log-summaries"] });

      const freshPeriods = await base44.entities.CallLogPeriod.list("-uploaded_at");

      // Auto-select the most-recently-uploaded period
      if (freshPeriods.length > 0) setSelectedPeriod(freshPeriods[0]);

      if (result.all_duplicate) {
        toast({
          title: "No New Data",
          description: result.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Upload Successful",
          description: result.message
        });
      }

      resetUpload();
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    }
    setUploading(false);
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
                  onChange={async e => {
                    const name = e.target.value;
                    setSelectedSheet(name);
                    setUploadError("");
                    setWeekSummary([]);
                    if (name && workbook) {
                      const ws = workbook.getWorksheet(name);
                      if (ws) {
                        const rows = sheetToJson(ws);
                        const { error } = validatePeriodColumns(rows);
                        if (error) setUploadError(error);
                        else setWeekSummary(detectWeekSummary(rows));
                      }
                    }
                  }}
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

            {/* Detected week ranges preview */}
            {weekSummary.length > 0 && (
              <div className="bg-white/70 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {weekSummary.length} week{weekSummary.length !== 1 ? "s" : ""} detected in worksheet:
                </p>
                <ul className="space-y-1">
                  {weekSummary.map((w, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
                      <span>{formatDate(w.start)} – {formatDate(w.end)}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
            {selectedPeriod.uploaded_weeks && selectedPeriod.uploaded_weeks.length > 0 && (
              <span className="text-xs text-slate-500">
                {selectedPeriod.uploaded_weeks.length} week{selectedPeriod.uploaded_weeks.length !== 1 ? "s" : ""} uploaded
                {selectedPeriod.uploaded_weeks.length > 0 && (
                  <span className="text-slate-400 ml-1">
                    ({selectedPeriod.uploaded_weeks.map(w => {
                      const s = w.week_start?.split("-"); const e = w.week_end?.split("-");
                      return s && e ? `${parseInt(s[1])}/${parseInt(s[2])}–${parseInt(e[1])}/${parseInt(e[2])}` : "";
                    }).join(", ")})
                  </span>
                )}
              </span>
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
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-sm font-semibold text-slate-700">
                      User Breakdown — {filteredSummaries.length}{searchTerm ? ` of ${activeSummaries.length}` : ""} users
                    </CardTitle>
                    <div className="relative">
                      <Input
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search User…"
                        className="h-8 w-48 text-xs pl-3 pr-3"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-[480px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          {TABLE_COLS.map(col => (
                            <th
                              key={col.key}
                              onClick={() => handleSortClick(col.key)}
                              className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors bg-slate-50"
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                {sortCol === col.key ? (
                                  sortDir === "asc"
                                    ? <ChevronUp className="w-3 h-3 text-blue-600" />
                                    : <ChevronDown className="w-3 h-3 text-blue-600" />
                                ) : null}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSummaries.map((u, i) => {
                          const ar = u.answered != null && u.total_calls ? u.answered / u.total_calls : (u.answer_rate || 0);
                          return (
                            <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                              <td className="px-4 py-2.5 font-medium text-slate-800">{highlightUser(u.user)}</td>
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
                        {filteredSummaries.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                              {searchTerm ? "No users match your search." : "No user data for this period."}
                            </td>
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