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
function minutesToHHMMSS(minutes) {
  if (!minutes || minutes === 0) return "0:00:00";
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}

// Legacy: convert stored seconds to HH:MM:SS (used only for monthly summary from CallLogUserSummary entity)
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

/** Serialize a cell value to a plain JS primitive safe for JSON */
function serializeCellValue(val) {
  if (val == null) return "";
  if (val instanceof Date) {
    // Serialize Date as YYYY-MM-DD using UTC to avoid timezone shifts
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "object" && val.result != null) return serializeCellValue(val.result); // formula
  if (typeof val === "object" && val.text != null) return val.text; // rich text
  if (typeof val === "object") return String(val);
  return val;
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
        obj[h] = serializeCellValue(values[i]);
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

    const periodLabel = formatPeriodLabel(selectedPeriod);
    const uploadedWeeks = selectedPeriod.uploaded_weeks || [];

    const now = new Date();
    const generatedOn = now.toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" }) +
      " " + now.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });

    // ---- Colors ----
    const DARK_NAVY  = "FF1F3864";
    const SECTION_BG = "FF2E5096";
    const LIGHT_GRAY = "FFF5F5F5";
    const ALT_ROW    = "FFEEF2FA";
    const WHITE      = "FFFFFFFF";
    const TOTALS_BG  = "FFD9E1F2";
    const HEADER_BG  = "FF344D7E";

    const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
    const thinBorder = { style: "thin", color: { argb: "FFDDDDDD" } };
    const medBorder  = { style: "medium", color: { argb: DARK_NAVY } };

    // Helper: style a section header row (spans numCols columns starting at col 1)
    const addSectionHeader = (ws, text, numCols, startCol = "A") => {
      const row = ws.addRow([text, ...Array(numCols - 1).fill("")]);
      const endCol = String.fromCharCode(startCol.charCodeAt(0) + numCols - 1);
      ws.mergeCells(`${startCol}${ws.rowCount}:${endCol}${ws.rowCount}`);
      const cell = ws.getCell(`${startCol}${ws.rowCount}`);
      cell.font      = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
      cell.fill      = mkFill(SECTION_BG);
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      row.height = 24;
      return row;
    };

    // Helper: style a table header row
    const styleTableHeader = (row, numCols) => {
      row.height = 20;
      for (let c = 1; c <= numCols; c++) {
        const cell = row.getCell(c);
        cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
        cell.fill      = mkFill(HEADER_BG);
        cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
      }
    };

    // Answer rate conditional color
    const arColor = (rate) => {
      if (rate >= 0.5)  return { bg: "FFC6EFCE", fg: "FF276221" };
      if (rate >= 0.2)  return { bg: "FFFFEB9C", fg: "FF9C6500" };
      return                   { bg: "FFFFC7CE", fg: "FF9C0006" };
    };

    // ---- Validate uploaded_weeks ----
    if (!uploadedWeeks || uploadedWeeks.length === 0) {
      if (totalCalls > 0) {
        console.warn("[CallLog Export] WARNING: Monthly totals exist but uploaded_weeks is empty. Week snapshots were not stored.");
      }
      // Still generate file but with empty sections
    }

    // ---- Build weekly rows from uploaded_weeks ----
    // Enforced shape: { week_start, week_end, totals: {...}, user_snapshot: [...] }
    const sortedWeeks = uploadedWeeks
      .slice()
      .sort((a, b) => (a.week_start || "").localeCompare(b.week_start || ""));

    const weekRows = sortedWeeks.map(week => {
      // Use week.totals if present (new shape), otherwise fall back to summing user_snapshot
      let totals;
      if (week.totals && typeof week.totals.total_calls === "number") {
        totals = week.totals;
      } else {
        // Legacy fallback: compute from user_snapshot
        const snap = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
        console.warn(`[CallLog Export] Week ${week.week_start}–${week.week_end} missing totals field, computing from user_snapshot`);
        totals = {
          total_calls:            snap.reduce((s, u) => s + (u.total_calls || 0), 0),
          inbound:                snap.reduce((s, u) => s + (u.inbound || 0), 0),
          outbound:               snap.reduce((s, u) => s + (u.outbound || 0), 0),
          answered:               snap.reduce((s, u) => s + (u.answered || 0), 0),
          missed:                 snap.reduce((s, u) => s + (u.missed || 0), 0),
          total_duration_minutes: snap.reduce((s, u) => s + (u.total_duration_minutes || 0), 0),
        };
      }
      return {
        week_start:             week.week_start,
        week_end:               week.week_end,
        total_calls:            totals.total_calls || 0,
        inbound:                totals.inbound || 0,
        outbound:               totals.outbound || 0,
        answered:               totals.answered || 0,
        missed:                 totals.missed || 0,
        total_duration_minutes: totals.total_duration_minutes || 0,
        avg_duration_minutes:   (totals.total_calls || 0) > 0 ? (totals.total_duration_minutes || 0) / totals.total_calls : 0,
        answer_rate:            (totals.total_calls || 0) > 0 ? (totals.answered || 0) / totals.total_calls : 0,
        user_snapshot:          Array.isArray(week.user_snapshot) ? week.user_snapshot : [],
        missing_snapshot:       !Array.isArray(week.user_snapshot) || week.user_snapshot.length === 0,
      };
    });

    // ---- Build per-user-per-week rows from user_snapshot ----
    const userWeekRows = [];
    sortedWeeks.forEach(week => {
      const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
      if (snapshot.length === 0) {
        // Warning row placeholder — handled in render below
        userWeekRows.push({ _warning: true, week_start: week.week_start, week_end: week.week_end });
        return;
      }
      snapshot.forEach(u => {
        const tc = u.total_calls || 0;
        if (u.total_duration_minutes == null) {
          console.warn(`[CallLog Export] Duration field missing in user_snapshot for user "${u.user}" week ${week.week_start}`);
        }
        const durMin = u.total_duration_minutes || 0;
        userWeekRows.push({
          week_start:             week.week_start,
          week_end:               week.week_end,
          user:                   u.user || "",
          total_calls:            tc,
          inbound:                u.inbound  || 0,
          outbound:               u.outbound || 0,
          answered:               u.answered || 0,
          missed:                 u.missed   || 0,
          total_duration_minutes: durMin,
          avg_duration_minutes:   tc > 0 ? durMin / tc : 0,
          answer_rate:            tc > 0 ? (u.answered || 0) / tc : 0,
        });
      });
    });
    // Sort real rows: user A-Z, then week_start asc (warning rows stay in place)
    userWeekRows.sort((a, b) => {
      if (a._warning && b._warning) return (a.week_start || "").localeCompare(b.week_start || "");
      if (a._warning) return -1;
      if (b._warning) return 1;
      const nc = (a.user || "").localeCompare(b.user || "");
      if (nc !== 0) return nc;
      return (a.week_start || "").localeCompare(b.week_start || "");
    });

    // ---- Create workbook ----
    const wb = new ExcelJS.Workbook();
    wb.creator = "ENTIC Operations Center";
    const wsName = periodLabel.substring(0, 31);
    const ws = wb.addWorksheet(wsName, {
      views: [{ showGridLines: false }]
    });

    // Column widths (11 columns max for user-breakdown table)
    ws.columns = [
      { width: 14 }, // Week Start / User
      { width: 14 }, // Week End
      { width: 30 }, // User (in user table) / metric
      { width: 13 }, // Total Calls
      { width: 13 }, // Inbound
      { width: 13 }, // Outbound
      { width: 13 }, // Answered
      { width: 11 }, // Missed
      { width: 22 }, // Duration
      { width: 16 }, // Answer Rate
      { width: 24 }, // Avg Duration
    ];

    // ==============================
    // SECTION 1: EXECUTIVE SUMMARY
    // ==============================

    // Row 1: Title
    ws.addRow([`${periodLabel} - Call Log`, ...Array(10).fill("")]);
    ws.mergeCells(`A1:K1`);
    const titleCell = ws.getCell("A1");
    titleCell.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    titleCell.fill      = mkFill(DARK_NAVY);
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 40;

    // Row 2: Reporting Period
    ws.addRow([`Reporting Period: ${periodLabel}`]);
    ws.getCell("A2").font = mkFont({ bold: true });
    ws.getRow(2).height = 18;

    // Row 3: Generated On
    ws.addRow([`Generated On: ${generatedOn}`]);
    ws.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
    ws.getRow(3).height = 18;

    // Row 4: blank
    ws.addRow([]);

    // Row 5: Monthly Summary header
    addSectionHeader(ws, "Monthly Summary", 4);

    // Rows 6-13: metrics (label | value in cols A and B)
    const metrics = [
      ["Total Calls",      totalCalls,                                         "number"],
      ["Inbound",          totalInbound,                                       "number"],
      ["Outbound",         totalOutbound,                                      "number"],
      ["Answered",         totalAnswered,                                      "number"],
      ["Missed",           totalMissed,                                        "number"],
      ["Answer Rate",      totalCalls > 0 ? overallAnswerRate : 0,             "percent"],
      ["Total Duration",   secondsToHHMMSS(totalDurationSec),                  "text"],
      ["Average Duration", secondsToHHMMSS(overallAvgDurationSec),             "text"],
    ];
    metrics.forEach(([label, val, type], idx) => {
      const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
      const row = ws.addRow([label, type === "percent" ? val : val]);
      row.height = 18;
      const lc = row.getCell(1);
      const vc = row.getCell(2);
      lc.font  = mkFont({ bold: true });
      lc.fill  = mkFill(bgArgb);
      lc.alignment = { horizontal: "left", vertical: "middle" };
      vc.font  = mkFont({ bold: true, size: 12 });
      vc.fill  = mkFill(bgArgb);
      vc.alignment = { horizontal: "right", vertical: "middle" };
      if (type === "number")  vc.numFmt = "#,##0";
      if (type === "percent") { vc.numFmt = "0.0%"; }
      [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
    });

    // Blank row
    ws.addRow([]);

    // ==============================
    // SECTION 2: WEEKLY SUMMARY TABLE
    // ==============================
    addSectionHeader(ws, "Weekly Summary", 10);

    const weekTableHeaderRowNum = ws.rowCount + 1;
    const weekHeaders = ["Week Start","Week End","Total Calls","Inbound","Outbound","Answered","Missed","Answer Rate","Total Duration","Avg Duration"];
    const weekHRow = ws.addRow(weekHeaders);
    styleTableHeader(weekHRow, 10);

    if (weekRows.length === 0) {
      const emptyRow = ws.addRow(["No weekly data found for this month.", ...Array(9).fill("")]);
      ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
      emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
      emptyRow.height = 18;
    } else {
      weekRows.forEach((wk, idx) => {
        const ar = wk.answer_rate;
        const { bg, fg } = arColor(ar);
        const bgArgb = idx % 2 === 0 ? WHITE : LIGHT_GRAY;

        const row = ws.addRow([
          formatDate(wk.week_start),
          formatDate(wk.week_end),
          wk.total_calls,
          wk.inbound,
          wk.outbound,
          wk.answered,
          wk.missed,
          ar,
          minutesToHHMMSS(wk.total_duration_minutes),
          minutesToHHMMSS(wk.avg_duration_minutes),
        ]);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill      = mkFill(bgArgb);
          cell.font      = mkFont({});
          cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
          cell.border    = { bottom: thinBorder, right: thinBorder };
          if ([3,4,5,6,7].includes(colNum)) cell.numFmt = "#,##0";
          if (colNum === 8) {
            cell.numFmt = "0.0%";
            cell.fill   = mkFill(bg);
            cell.font   = mkFont({ color: { argb: fg } });
          }
        });
      });

      // Autofilter on weekly table
      ws.autoFilter = {
        from: { row: weekTableHeaderRowNum, column: 1 },
        to:   { row: weekTableHeaderRowNum + weekRows.length, column: 10 }
      };
    }

    // Blank row
    ws.addRow([]);

    // ==============================
    // SECTION 3: USER BREAKDOWN TABLE (Official Excel Table)
    // ==============================
    addSectionHeader(ws, "User Breakdown (by Week)", 11);

    const userTableStartRow = ws.rowCount + 1;

    const realUserRows = userWeekRows.filter(u => !u._warning);

    if (realUserRows.length === 0 && userWeekRows.every(u => u._warning)) {
      const emptyRow = ws.addRow(["User snapshot missing for all weeks — totals still available in Weekly Summary above.", ...Array(10).fill("")]);
      ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
      emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FFCC8800" } });
      emptyRow.height = 18;
    } else if (realUserRows.length === 0) {
      const emptyRow = ws.addRow(["No user-level weekly data found.", ...Array(10).fill("")]);
      ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
      emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
      emptyRow.height = 18;
    } else {
      // Add header row manually (ExcelJS addTable will reference it)
      const userHRow = ws.addRow(["Week Start","Week End","User","Total Calls","Inbound","Outbound","Answered","Missed","Total Duration","Answer Rate","Avg Duration"]);
      styleTableHeader(userHRow, 11);

      // Freeze top row of user breakdown table
      ws.views = [{ showGridLines: false, state: "frozen", ySplit: userTableStartRow, xSplit: 0 }];

      const tableDataRows = [];
      userWeekRows.forEach((u) => {
        if (u._warning) {
          // Insert a styled note row (outside the table range)
          const warnRow = ws.addRow([
            formatDate(u.week_start),
            formatDate(u.week_end),
            "User snapshot missing for this week",
            ...Array(8).fill("")
          ]);
          ws.mergeCells(`C${ws.rowCount}:K${ws.rowCount}`);
          warnRow.height = 18;
          warnRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill   = mkFill("FFFFF3CD");
            cell.font   = mkFont({ italic: true, color: { argb: "FF856404" } });
            cell.border = { bottom: thinBorder };
          });
          return;
        }

        const ar = u.answer_rate;
        const { bg, fg } = arColor(ar);
        const arPct = parseFloat((ar * 100).toFixed(1)) / 100;

        const row = ws.addRow([
          formatDate(u.week_start),
          formatDate(u.week_end),
          u.user || "",
          u.total_calls,
          u.inbound,
          u.outbound,
          u.answered,
          u.missed,
          minutesToHHMMSS(u.total_duration_minutes),
          arPct,
          minutesToHHMMSS(u.avg_duration_minutes),
        ]);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.font      = mkFont({});
          cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
          cell.border    = { bottom: thinBorder, right: thinBorder };
          if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
          if (colNum === 10) {
            cell.numFmt = "0.0%";
            cell.fill   = mkFill(bg);
            cell.font   = mkFont({ color: { argb: fg } });
          }
        });

        tableDataRows.push(row);
      });

      // Register as official Excel Table (enables filter dropdowns + named table)
      const userTableEndRow = ws.rowCount;
      ws.addTable({
        name: "UserBreakdown",
        ref: `A${userTableStartRow}:K${userTableEndRow}`,
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: true,
        },
        columns: [
          { name: "Week Start",      filterButton: true },
          { name: "Week End",        filterButton: true },
          { name: "User",            filterButton: true },
          { name: "Total Calls",     filterButton: true },
          { name: "Inbound",         filterButton: true },
          { name: "Outbound",        filterButton: true },
          { name: "Answered",        filterButton: true },
          { name: "Missed",          filterButton: true },
          { name: "Total Duration",  filterButton: true },
          { name: "Answer Rate",     filterButton: true },
          { name: "Avg Duration",    filterButton: true },
        ],
        rows: tableDataRows.map(r => r.values.slice(1)),
      });
    }

    // ==============================
    // PIVOT DATA SHEET (flat data for user-built pivot with slicer)
    // ==============================
    const wsPivot = wb.addWorksheet("Pivot Data", {
      views: [{ showGridLines: true, state: "frozen", ySplit: 1, xSplit: 0 }]
    });
    wsPivot.columns = [
      { header: "Week Start",     key: "week_start",             width: 16 },
      { header: "Week End",       key: "week_end",               width: 16 },
      { header: "User",           key: "user",                   width: 30 },
      { header: "Total Calls",    key: "total_calls",            width: 14 },
      { header: "Inbound",        key: "inbound",                width: 12 },
      { header: "Outbound",       key: "outbound",               width: 12 },
      { header: "Answered",       key: "answered",               width: 12 },
      { header: "Missed",         key: "missed",                 width: 12 },
      { header: "Total Duration", key: "total_duration_minutes", width: 22 },
      { header: "Answer Rate",    key: "answer_rate",            width: 14 },
      { header: "Avg Duration",   key: "avg_duration_minutes",   width: 22 },
    ];

    // Style pivot header row
    const pivotHeaderRow = wsPivot.getRow(1);
    pivotHeaderRow.height = 20;
    pivotHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
      cell.fill      = mkFill(DARK_NAVY);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border    = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
    });

    // Add flat data rows (real rows only — skip _warning)
    const pivotDataRows = [];
    userWeekRows.filter(u => !u._warning).forEach(u => {
      pivotDataRows.push({
        week_start:             formatDate(u.week_start),
        week_end:               formatDate(u.week_end),
        user:                   u.user || "",
        total_calls:            u.total_calls,
        inbound:                u.inbound,
        outbound:               u.outbound,
        answered:               u.answered,
        missed:                 u.missed,
        total_duration_minutes: minutesToHHMMSS(u.total_duration_minutes),
        answer_rate:            parseFloat((u.answer_rate * 100).toFixed(1)) / 100,
        avg_duration_minutes:   minutesToHHMMSS(u.avg_duration_minutes),
      });
    });

    pivotDataRows.forEach((rowData, idx) => {
      const row = wsPivot.addRow(rowData);
      row.height = 17;
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(bgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: thinBorder, right: thinBorder };
        if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 10) {
          cell.numFmt = "0.0%";
          const { bg, fg } = arColor(rowData.answer_rate);
          cell.fill = mkFill(bg);
          cell.font = mkFont({ color: { argb: fg } });
        }
      });
    });

    // Register Pivot Data as an Excel Table so it can be used as a Pivot source
    if (pivotDataRows.length > 0) {
      wsPivot.addTable({
        name: "PivotSource",
        ref: `A1:K${1 + pivotDataRows.length}`,
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleLight9",
          showRowStripes: true,
        },
        columns: [
          { name: "Week Start",     filterButton: true },
          { name: "Week End",       filterButton: true },
          { name: "User",           filterButton: true },
          { name: "Total Calls",    filterButton: true },
          { name: "Inbound",        filterButton: true },
          { name: "Outbound",       filterButton: true },
          { name: "Answered",       filterButton: true },
          { name: "Missed",         filterButton: true },
          { name: "Total Duration", filterButton: true },
          { name: "Answer Rate",    filterButton: true },
          { name: "Avg Duration",   filterButton: true },
        ],
        rows: pivotDataRows.map(r => [
          r.week_start, r.week_end, r.user, r.total_calls, r.inbound,
          r.outbound, r.answered, r.missed, r.total_duration_minutes,
          r.answer_rate, r.avg_duration_minutes
        ]),
      });

      // Add instructions cell below the table
      const instrRow = wsPivot.addRow([]);
      instrRow.height = 10;
      const instrRow2 = wsPivot.addRow([
        "➤ To build a Pivot Table with Week Slicer: Select any cell in the table above → Insert → PivotTable → Add to New Sheet → Drag 'User' to Rows, metrics to Values, 'Week Start' to Filters → Insert → Slicer → Select 'Week Start'."
      ]);
      wsPivot.mergeCells(`A${wsPivot.rowCount}:K${wsPivot.rowCount}`);
      instrRow2.getCell(1).font      = mkFont({ italic: true, size: 10, color: { argb: "FF555555" } });
      instrRow2.getCell(1).alignment = { wrapText: true };
      instrRow2.height = 30;
    }

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