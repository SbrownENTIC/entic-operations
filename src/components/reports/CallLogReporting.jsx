import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Phone, AlertCircle, CheckCircle, Loader2, Download, Trash2, ChevronUp, ChevronDown, Users } from "lucide-react";
import CallLogUserConfigAdmin from "./CallLogUserConfigAdmin";
import PerformanceViews from "./PerformanceViews";
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
  if (val == null || val === "") return "—";
  return (val * 100).toFixed(1) + "%";
}

function formatAnswerRate(inboundAnswered, inbound) {
  if (!inbound) return "—";
  return ((inboundAnswered / inbound) * 100).toFixed(1) + "%";
}

// Parse a YYYY-MM-DD string to a JS Date at noon UTC to avoid timezone-shift issues
function parseWeekDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
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
  "direction",
  "result",
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

/** Convert Excel serial date or date string to YYYY-MM-DD (no week normalization — raw value only) */
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
  // Date object (ExcelJS may return Date objects) — always use UTC to avoid timezone shift
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const day = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // String: parse to YYYY-MM-DD using explicit field extraction only — no native Date() parse
  const s = String(val).trim();
  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY (4-digit year)
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) return `${mdy4[3]}-${String(mdy4[1]).padStart(2,"0")}-${String(mdy4[2]).padStart(2,"0")}`;
  // MM/DD/YY (2-digit year — treat 00-99 as 2000-2099)
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const year = 2000 + parseInt(mdy2[3], 10);
    return `${year}-${String(mdy2[1]).padStart(2,"0")}-${String(mdy2[2]).padStart(2,"0")}`;
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
    queryFn: async () => {
      const all = await base44.entities.CallLogPeriod.list();
      // Sort by monthly_key descending (newest first)
      return all.sort((a, b) => (b.monthly_key || "").localeCompare(a.monthly_key || ""));
    }
  });

  // Auto-select default period on load (newest month)
  React.useEffect(() => {
    if (!periods.length || selectedPeriod) return;
    setSelectedPeriod(periods[0]); // First after sorting = newest month
  }, [periods]);

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriod?.id],
    queryFn: () => base44.entities.CallLogUserSummary.filter({ period_id: selectedPeriod.id }),
    enabled: !!selectedPeriod?.id
  });

  const { data: allUserConfigs = [] } = useQuery({
    queryKey: ["call-log-user-configs"],
    queryFn: () => base44.entities.CallLogUserConfig.list(),
  });

  const userConfigMap = React.useMemo(() => {
    const map = {};
    for (const cfg of allUserConfigs) {
      if (cfg.user_name) map[cfg.user_name] = cfg;
    }
    return map;
  }, [allUserConfigs]);

  // Build sortedWeeks for performance views from selected period
  const sortedWeeks = React.useMemo(() => {
    const uploadedWeeks = selectedPeriod?.uploaded_weeks || [];
    return uploadedWeeks.slice().sort((a, b) => (a.week_start || "").localeCompare(b.week_start || ""));
  }, [selectedPeriod]);

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
    { key: "answer_rate",           label: "Inbound Answer Rate",     type: "num"   },
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
    if (key === "answer_rate") {
      const inbound = u.inbound || 0;
      const inboundAnswered = u.inbound_answered != null ? u.inbound_answered : (u.answered || 0);
      return inbound > 0 ? inboundAnswered / inbound : -1; // -1 so blank (0 inbound) sorts last
    }
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
  const totalCalls          = activeSummaries.reduce((s, u) => s + (u.total_calls || 0), 0);
  const totalInbound        = activeSummaries.reduce((s, u) => s + (u.inbound || 0), 0);
  const totalOutbound       = activeSummaries.reduce((s, u) => s + (u.outbound || 0), 0);
  const totalInboundAnswered= activeSummaries.reduce((s, u) => s + (u.inbound_answered != null ? u.inbound_answered : (u.answered || 0)), 0);
  const totalAnswered       = totalInboundAnswered; // display field = inbound answered only
  const totalMissed         = activeSummaries.reduce((s, u) => s + (u.missed || 0), 0);
  const totalDurationSec    = activeSummaries.reduce((s, u) => s + (u.total_duration_seconds || 0), 0);
  const overallAnswerRate   = totalInbound > 0 ? totalInboundAnswered / totalInbound : null;
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

    // Fetch fresh CallLogPeriod record to ensure we have latest data
    const freshPeriod = await base44.entities.CallLogPeriod.get(selectedPeriod.id);
    if (!freshPeriod) {
      alert("Error: Could not load period data. Please try again.");
      return;
    }

    const monthKey = freshPeriod.monthly_key;
    console.log("Exporting month:", monthKey);

    const periodLabel = formatPeriodLabel(freshPeriod);
    const uploadedWeeks = freshPeriod.uploaded_weeks || [];

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

    // Helper: style a table header row (with wrap text + max height)
    const styleTableHeader = (row, numCols, leftAlignUpTo = 1) => {
      row.height = 30; // allow wrap; capped at 45 by Excel if needed
      for (let c = 1; c <= numCols; c++) {
        const cell = row.getCell(c);
        cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
        cell.fill      = mkFill(HEADER_BG);
        cell.alignment = { horizontal: c <= leftAlignUpTo ? "left" : "center", vertical: "middle", wrapText: true };
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

    // Row 4: Monthly Summary header
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
      if (type === "percent") { vc.numFmt = "0.00%"; }
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
    styleTableHeader(weekHRow, 10, 2);

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
            cell.numFmt = "0.00%";
            cell.fill   = mkFill(bg);
            cell.font   = mkFont({ color: { argb: fg } });
          }
        });
      });


    }

    // Blank row
    ws.addRow([]);

    // ==============================
    // SECTION 3: FULL USER BREAKDOWN TABLE (Official Excel Table — all weeks)
    // ==============================
    addSectionHeader(ws, "Full User Breakdown (All Weeks)", 11);

    // Subtle instruction line
    const instrHint = ws.addRow(["To view a specific week, use the Week Start filter in the table header.", ...Array(10).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
    instrHint.height = 16;
    instrHint.getCell(1).font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
    instrHint.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

    const userTableStartRow = ws.rowCount + 1;

    // Sort A–Z by user name before rendering; exclude zero-activity rows for that week
    const realUserRows = userWeekRows
      .filter(u => !u._warning && (u.total_calls || 0) > 0)
      .sort((a, b) => (a.user || "").localeCompare(b.user || ""));

    if (realUserRows.length === 0) {
      const emptyRow = ws.addRow(["No user-level weekly data found.", ...Array(10).fill("")]);
      ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
      emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
      emptyRow.height = 18;
    } else {
      // Header row (userTableStartRow)
      const userHRow = ws.addRow(["Week Start","Week End","User","Total Calls","Inbound","Outbound","Answered","Missed","Total Duration","Answer Rate","Avg Duration"]);
      styleTableHeader(userHRow, 11);

      // Freeze at the header row of this table
      ws.views = [{ showGridLines: false, state: "frozen", ySplit: userTableStartRow, xSplit: 0 }];

      const tableRows = [];
      realUserRows.forEach((u, idx) => {
        const ar = u.answer_rate;
        const { bg, fg } = arColor(ar);
        const arPct = parseFloat((ar * 100).toFixed(1)) / 100;
        const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;

        const rowValues = [
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
        ];
        const row = ws.addRow(rowValues);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill      = mkFill(bgArgb);
          cell.font      = mkFont({});
          cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
          cell.border    = { bottom: thinBorder, right: thinBorder };
          if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
          if (colNum === 10) {
            cell.numFmt = "0.00%";
            cell.fill   = mkFill(bg);
            cell.font   = mkFont({ color: { argb: fg } });
          }
        });
        tableRows.push(rowValues);
      });

      // Register as official Excel Table with AutoFilter on all columns
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
        rows: tableRows,
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
    // IMPORTANT: week_start and week_end are stored as real Date objects so that
    // the FILTER formula in the main sheet (C4=$C$4) can do a date-to-date comparison.
    const pivotDataRows = [];
    userWeekRows.filter(u => !u._warning && (u.total_calls || 0) > 0).forEach(u => {
      pivotDataRows.push({
        week_start:             parseWeekDate(u.week_start),   // real Date — must match C4
        week_end:               parseWeekDate(u.week_end),     // real Date
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
        // Col 1 = Week Start, Col 2 = Week End — format as date so FILTER comparison works
        if (colNum === 1 || colNum === 2) cell.numFmt = "mmm d, yyyy";
        if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 10) {
          cell.numFmt = "0.00%";
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

    // ---- Hide Pivot Data sheet (keep in workbook but not visible to user) ----
    wsPivot.state = "hidden";

    // ==============================
    // LOAD CallLogUserConfig for export enrichment
    // ==============================
    const allUserConfigs = await base44.entities.CallLogUserConfig.list();
    // Map all configs by user_name (exact match, used for every lookup at export time)
    const userConfigMap = {};
    for (const cfg of allUserConfigs) {
      if (cfg.user_name) userConfigMap[cfg.user_name] = cfg;
    }

    // Helper: coerce stored boolean-like values (handles true, "true", 1, etc.)
    const coerceBool = (val) => {
      if (typeof val === "boolean") return val;
      if (val === null || val === undefined) return false;
      const s = String(val).toLowerCase().trim();
      return ["true", "yes", "1", "x", "✓", "checked"].includes(s);
    };

    // Helper: is a user eligible for Front Desk benchmark math?
    // STRICT: uses only CallLogUserConfig — never falls back to snapshot fields.
    // Must be Front Desk + include_in_benchmark true + active not false.
    const isFrontDeskBenchmark = (userName) => {
      const cfg = userConfigMap[userName];
      if (!cfg) {
        console.log(`[CallLog Export] isFrontDeskBenchmark("${userName}"): NO CONFIG FOUND => false`);
        return false;
      }
      const benchGroup     = cfg.benchmark_group;
      const includeInBench = coerceBool(cfg.include_in_benchmark);
      // active defaults to true if missing/undefined (only false if explicitly false)
      const isActive       = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
      const result = benchGroup === "Front Desk" && includeInBench === true && isActive;
      console.log(`[CallLog Export] isFrontDeskBenchmark("${userName}"): group="${benchGroup}" raw_include=${JSON.stringify(cfg.include_in_benchmark)} include=${includeInBench} raw_active=${JSON.stringify(cfg.active)} active=${isActive} => ${result}`);
      return result;
    };

    // Helper: get location from directory only (never parse from name)
    const getUserLocation = (userName) => {
      const cfg = userConfigMap[userName];
      if (!cfg || !cfg.location || cfg.location === "N/A") return "";
      return cfg.location;
    };

    // Location-based daily goal map (per desk type)
    const LOCATION_GOALS = {
      Bloomfield:  { check_in: 34, check_out: 35 },
      Manchester:  { check_in: 28, check_out: 30 },
      Glastonbury: { check_in: 22, check_out: 25 },
      Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
    };
    const WORK_DAYS_PER_WEEK = 5;

    // Determine desk type from user name and return the weekly goal
    const getDeskGoal = (userName) => {
      const location = getUserLocation(userName);
      const goals = LOCATION_GOALS[location];
      if (!goals) return 0;
      const nameLower = (userName || "").toLowerCase();
      let deskType = "check_in"; // default
      if (nameLower.includes("check out") || nameLower.includes("checkout")) deskType = "check_out";
      else if (nameLower.includes("check in") || nameLower.includes("checkin")) deskType = "check_in";
      else if (nameLower.includes("phone")) deskType = "phone_only";
      const dailyRate = goals[deskType] ?? goals["check_in"] ?? 0;
      return dailyRate * WORK_DAYS_PER_WEEK;
    };

    // Conditional color for performance pct (same thresholds for both sheets)
    const perfColor = (pct) => {
      if (pct >= 1.0) return { bg: "FFC6EFCE", fg: "FF276221" };
      if (pct >= 0.9) return { bg: "FFFFEB9C", fg: "FF9C6500" };
      return               { bg: "FFFFC7CE", fg: "FF9C0006" };
    };

    // ==============================
    // SHEET 2: DESK PERFORMANCE
    // ==============================
    const wsDesk = wb.addWorksheet("Front End Performance", {
      views: [{ showGridLines: false }]
    });
    wsDesk.columns = [
      { width: 18 }, // Week Start
      { width: 34 }, // Desk
      { width: 16 }, // Location
      { width: 18 }, // Total Answered
      { width: 14 }, // Desk Goal
      { width: 18 }, // Percent of Goal
    ];

    // Build desk-per-week aggregation — STRICT: join by user_name to CallLogUserConfig only
    // Desk Performance: Front Desk + include_in_benchmark === true + active !== false
    const deskWeekMap = {}; // key: "weekStart||desk"
    sortedWeeks.forEach(week => {
      const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
      snapshot.forEach(u => {
        const userName = u.user || "";
        if (!isFrontDeskBenchmark(userName)) return;

        const desk = userName;
        const location = getUserLocation(userName);
        const weeklyGoal = getDeskGoal(userName);
        const key = `${week.week_start}||${desk}`;
        if (!deskWeekMap[key]) {
          deskWeekMap[key] = {
            week_start: week.week_start,
            desk,
            location,
            weeklyGoal,
            totalAnswered: 0,
          };
        }
        deskWeekMap[key].totalAnswered += (u.answered || 0);
      });
    });

    const deskRows = Object.values(deskWeekMap).sort((a, b) => {
      const ws = a.week_start.localeCompare(b.week_start);
      if (ws !== 0) return ws;
      return a.desk.localeCompare(b.desk);
    });

    // --- Row 1: Banner ---
    wsDesk.addRow([`${periodLabel} – Front End Performance`, "", "", "", "", ""]);
    wsDesk.mergeCells("A1:F1");
    const deskTitle = wsDesk.getCell("A1");
    deskTitle.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    deskTitle.fill      = mkFill(DARK_NAVY);
    deskTitle.alignment = { horizontal: "center", vertical: "middle" };
    wsDesk.getRow(1).height = 40;

    // --- Row 2: blank ---
    wsDesk.addRow([]);
    wsDesk.getRow(2).height = 6;

    // --- Row 3: Reporting Period ---
    wsDesk.addRow([`Reporting Period: ${periodLabel}`]);
    wsDesk.getCell("A3").font = mkFont({ bold: true });
    wsDesk.getRow(3).height = 18;

    // --- Row 4: Generated On ---
    wsDesk.addRow([`Generated On: ${generatedOn}`]);
    wsDesk.getCell("A4").font = mkFont({ color: { argb: "FF666666" } });
    wsDesk.getRow(4).height = 18;

    // --- Row 5: blank ---
    wsDesk.addRow([]);
    wsDesk.getRow(5).height = 6;

    // --- Horizontal dashboard cards for each week ---
    const SUMMARY_BG      = "FFE8F0FE";
    const CARD_BORDER_COLOR = "FF2E5096";
    const CARD_W          = 4;  // columns per card
    const CARD_GAP        = 1;  // blank columns between cards
    const CARDS_PER_ROW   = 3;  // max cards per row
    const CARD_H          = 5;  // 1 header + 4 metric rows (no spacer rows)

    // Helper: get week end for a given week start
    const getWeekEnd = (ws) => {
      const found = sortedWeeks.find(w => w.week_start === ws);
      return found ? found.week_end : "";
    };

    // Helper: apply medium border around card
    const applyCardBorder = (ws, startRow, startCol, numRows, numCols) => {
      const borderColor = { argb: CARD_BORDER_COLOR };
      for (let r = startRow; r < startRow + numRows; r++) {
        for (let c = startCol; c < startCol + numCols; c++) {
          const cell = ws.getCell(r, c);
          const isTop    = r === startRow;
          const isBottom = r === startRow + numRows - 1;
          const isLeft   = c === startCol;
          const isRight  = c === startCol + numCols - 1;
          cell.border = {
            top:    isTop    ? { style: "medium", color: borderColor } : cell.border?.top,
            bottom: isBottom ? { style: "medium", color: borderColor } : cell.border?.bottom,
            left:   isLeft   ? { style: "medium", color: borderColor } : cell.border?.left,
            right:  isRight  ? { style: "medium", color: borderColor } : cell.border?.right,
          };
        }
      }
    };

    // Helper: render one card onto a worksheet
    const renderCard = (ws, startRow, startCol, headerText, cardMetrics) => {
      // Row 1: dark blue header, merged
      const hdrCell = ws.getCell(startRow, startCol);
      hdrCell.value     = headerText;
      hdrCell.font      = mkFont({ bold: true, size: 10, color: { argb: WHITE } });
      hdrCell.fill      = mkFill(DARK_NAVY);
      hdrCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(startRow).height = 20;
      ws.mergeCells(startRow, startCol, startRow, startCol + CARD_W - 1);

      // Rows 2–5: metric rows (label left, value right, both columns)
      cardMetrics.forEach(([label, val, type], mi) => {
        const r = startRow + 1 + mi;
        ws.getRow(r).height = 17;
        // Fill all cells in card row with SUMMARY_BG
        for (let c = startCol; c < startCol + CARD_W; c++) {
          ws.getCell(r, c).fill = mkFill(SUMMARY_BG);
        }
        const lc = ws.getCell(r, startCol);
        const vc = ws.getCell(r, startCol + CARD_W - 1);
        lc.value     = label;
        lc.font      = mkFont({ size: 9, color: { argb: "FF444444" } });
        lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        vc.value     = val;
        vc.font      = mkFont({ bold: true, size: 10 });
        vc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
        if (type === "number")  vc.numFmt = "#,##0";
        if (type === "percent") vc.numFmt = "0.00%";
      });

      applyCardBorder(ws, startRow, startCol, CARD_H, CARD_W);
    };

    // Set compact column widths for desk sheet card area
    wsDesk.getColumn(1).width = 18;
    wsDesk.getColumn(2).width = 12;
    wsDesk.getColumn(3).width = 12;
    wsDesk.getColumn(4).width = 12;
    wsDesk.getColumn(5).width = 1;  // gap col
    wsDesk.getColumn(6).width = 18;
    wsDesk.getColumn(7).width = 12;
    wsDesk.getColumn(8).width = 12;
    wsDesk.getColumn(9).width = 12;
    wsDesk.getColumn(10).width = 1; // gap col
    wsDesk.getColumn(11).width = 18;
    wsDesk.getColumn(12).width = 12;
    wsDesk.getColumn(13).width = 12;
    wsDesk.getColumn(14).width = 12;

    const deskUniqueWeeks = [...new Set(deskRows.map(d => d.week_start))].sort();
    const numDeskCardRows = Math.ceil(deskUniqueWeeks.length / CARDS_PER_ROW);
    const deskCardStartRow = wsDesk.rowCount + 1;

    // Pre-add rows for the card grid (CARD_H rows per card row + 1 gap row between card rows)
    for (let i = 0; i < numDeskCardRows * CARD_H + Math.max(0, numDeskCardRows - 1); i++) {
      wsDesk.addRow([]);
      wsDesk.getRow(wsDesk.rowCount).height = 17;
    }

    deskUniqueWeeks.forEach((weekStart, idx) => {
      const cardRowIdx = Math.floor(idx / CARDS_PER_ROW);
      const cardColIdx = idx % CARDS_PER_ROW;
      const startRow = deskCardStartRow + cardRowIdx * (CARD_H + 1);
      const startCol = 1 + cardColIdx * (CARD_W + CARD_GAP);

      const weekDeskRows = deskRows.filter(d => d.week_start === weekStart);
      const weekPcts = weekDeskRows.map(d => d.weeklyGoal > 0 ? d.totalAnswered / d.weeklyGoal : 0);
      const weekTotalDesks = new Set(weekDeskRows.map(d => d.desk)).size;
      const weekAvgPct = weekPcts.length > 0 ? weekPcts.reduce((s, v) => s + v, 0) / weekPcts.length : 0;
      const weekMeeting = weekPcts.filter(p => p >= 1.0).length;
      const weekBelow90 = weekPcts.filter(p => p < 0.9).length;

      renderCard(wsDesk, startRow, startCol, `Week of ${formatDate(weekStart)}`, [
        ["Avg % of Goal", weekAvgPct,     "percent"],
        ["≥ 100%",        weekMeeting,    "number"],
        ["< 90%",         weekBelow90,    "number"],
        ["Total Desks",   weekTotalDesks, "number"],
      ]);
    });

    // Blank row after cards block
    wsDesk.addRow([]);
    wsDesk.getRow(wsDesk.rowCount).height = 8;

    // --- Section header ---
    const deskSectionRow = wsDesk.addRow(["Detailed Front End Performance by Week", "", "", "", "", ""]);
    wsDesk.mergeCells(`A${wsDesk.rowCount}:F${wsDesk.rowCount}`);
    const deskSectionCell = wsDesk.getCell(`A${wsDesk.rowCount}`);
    deskSectionCell.font      = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
    deskSectionCell.fill      = mkFill(SECTION_BG);
    deskSectionCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    deskSectionRow.height = 24;

    // --- Table header ---
    const deskTableStartRow = wsDesk.rowCount + 1;
    const deskHRow = wsDesk.addRow(["Week Start", "Desk", "Location", "Total Answered", "Weekly Goal", "% of Weekly Goal"]);
    styleTableHeader(deskHRow, 6, 3);

    // Freeze pane at row AFTER header (so header is always visible)
    wsDesk.views = [{ showGridLines: false, state: "frozen", ySplit: deskTableStartRow, xSplit: 0 }];

    const deskTableRows = [];
    deskRows.forEach((d, idx) => {
      const pct = d.weeklyGoal > 0 ? d.totalAnswered / d.weeklyGoal : 0;
      const { bg, fg } = perfColor(pct);
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const rowValues = [formatDate(d.week_start), d.desk, d.location, d.totalAnswered, d.weeklyGoal, pct];
      const row = wsDesk.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(bgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: thinBorder, right: thinBorder };
        if ([4, 5].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 6) {
          cell.numFmt = "0.00%";
          if (d.weeklyGoal > 0) {
            cell.fill = mkFill(bg);
            cell.font = mkFont({ color: { argb: fg } });
          }
        }
      });
      deskTableRows.push(rowValues);
    });

    if (deskRows.length > 0) {
      wsDesk.addTable({
        name: "DeskPerformance",
        ref: `A${deskTableStartRow}:F${wsDesk.rowCount}`,
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [
          { name: "Week Start",       filterButton: true },
          { name: "Desk",             filterButton: true },
          { name: "Location",         filterButton: true },
          { name: "Total Answered",   filterButton: true },
          { name: "Weekly Goal",      filterButton: true },
          { name: "% of Weekly Goal", filterButton: true },
        ],
        rows: deskTableRows,
      });

      // Auto-fit column widths for desk sheet based on content
      wsDesk.columns.forEach((col) => {
        let maxLen = 10;
        col.eachCell({ includeEmpty: false }, (cell) => {
          const val = cell.value != null ? String(cell.value) : "";
          if (val.length > maxLen) maxLen = val.length;
        });
        col.width = Math.min(maxLen + 2, 40);
      });
    }

    // ==============================
    // SHEET 3: INDIVIDUAL PERFORMANCE
    // ==============================
    const wsIndiv = wb.addWorksheet("Individual Performance", {
      views: [{ showGridLines: false }]
    });
    wsIndiv.columns = [
      { width: 18 }, // Week Start
      { width: 30 }, // User
      { width: 34 }, // Desk
      { width: 16 }, // Location
      { width: 14 }, // Answered
      { width: 14 }, // Desk Goal
      { width: 18 }, // Percent of Goal
    ];

    // Build individual rows: ALL users in snapshot
    // Goal math ONLY for isFrontDeskBenchmark users; all others get blank goal columns
    const indivRows = [];
    sortedWeeks.forEach(week => {
      const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];

      snapshot.forEach(u => {
        const userName = u.user || "";
        const answered = u.answered || 0;
        const location = getUserLocation(userName);
        const eligible = isFrontDeskBenchmark(userName);
        const weeklyGoal = eligible ? getDeskGoal(userName) : 0;

        if (eligible && weeklyGoal > 0) {
          indivRows.push({
            week_start:     week.week_start,
            user:           userName,
            desk:           userName,
            location,
            answered,
            weeklyGoal,
            percentOfGoal:  answered / weeklyGoal,
            isDeskUser:     true,
          });
        } else {
          indivRows.push({
            week_start:     week.week_start,
            user:           userName,
            desk:           "",
            location,
            answered,
            weeklyGoal:     null,
            percentOfGoal:  null,
            isDeskUser:     false,
          });
        }
      });
    });

    // Sort: % of Weekly Goal asc (blanks at bottom), then Week Start asc as tiebreaker
    indivRows.sort((a, b) => {
      const aHasGoal = a.percentOfGoal !== null && a.percentOfGoal !== undefined;
      const bHasGoal = b.percentOfGoal !== null && b.percentOfGoal !== undefined;
      // Rows with blank % of Weekly Goal go to the bottom
      if (aHasGoal && !bHasGoal) return -1;
      if (!aHasGoal && bHasGoal) return 1;
      // Both have a value: sort by % ascending
      if (aHasGoal && bHasGoal) {
        const pctDiff = a.percentOfGoal - b.percentOfGoal;
        if (pctDiff !== 0) return pctDiff;
      }
      // Tiebreaker: Week Start ascending
      return a.week_start.localeCompare(b.week_start);
    });

    // --- Row 1: Banner ---
    wsIndiv.addRow([`${periodLabel} – Individual Performance`, "", "", "", "", "", ""]);
    wsIndiv.mergeCells("A1:G1");
    const indivTitle = wsIndiv.getCell("A1");
    indivTitle.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    indivTitle.fill      = mkFill(DARK_NAVY);
    indivTitle.alignment = { horizontal: "center", vertical: "middle" };
    wsIndiv.getRow(1).height = 40;

    // --- Row 2: blank ---
    wsIndiv.addRow([]);
    wsIndiv.getRow(2).height = 6;

    // --- Row 3: Reporting Period ---
    wsIndiv.addRow([`Reporting Period: ${periodLabel}`]);
    wsIndiv.getCell("A3").font = mkFont({ bold: true });
    wsIndiv.getRow(3).height = 18;

    // --- Row 4: Generated On ---
    wsIndiv.addRow([`Generated On: ${generatedOn}`]);
    wsIndiv.getCell("A4").font = mkFont({ color: { argb: "FF666666" } });
    wsIndiv.getRow(4).height = 18;

    // --- Row 5: blank ---
    wsIndiv.addRow([]);
    wsIndiv.getRow(5).height = 6;

    // --- Horizontal dashboard cards for Individual Performance ---

    const indivUniqueWeeks = [...new Set(indivRows.map(r => r.week_start))].sort();
    const numIndivCardRows = Math.ceil(indivUniqueWeeks.length / CARDS_PER_ROW);
    const indivCardStartRow = wsIndiv.rowCount + 1;

    for (let i = 0; i < numIndivCardRows * CARD_H + Math.max(0, numIndivCardRows - 1); i++) {
      wsIndiv.addRow([]);
      wsIndiv.getRow(wsIndiv.rowCount).height = 17;
    }

    indivUniqueWeeks.forEach((weekStart, idx) => {
      const cardRowIdx = Math.floor(idx / CARDS_PER_ROW);
      const cardColIdx = idx % CARDS_PER_ROW;
      const startRow = indivCardStartRow + cardRowIdx * (CARD_H + 1);
      const startCol = 1 + cardColIdx * (CARD_W + CARD_GAP);

      const weekIndivRows = indivRows.filter(r => r.week_start === weekStart);
      const weekEligibleRows = weekIndivRows.filter(r => r.isDeskUser);
      const weekTotalUsers = new Set(weekIndivRows.map(r => r.user)).size;
      const weekEligiblePcts = weekEligibleRows.map(r => r.percentOfGoal || 0);
      const weekAvgPct = weekEligiblePcts.length > 0 ? weekEligiblePcts.reduce((s, v) => s + v, 0) / weekEligiblePcts.length : 0;
      const weekMeeting = weekEligiblePcts.filter(p => p >= 1.0).length;
      const weekBelow90 = weekEligiblePcts.filter(p => p < 0.9).length;

      renderCard(wsIndiv, startRow, startCol, `Week of ${formatDate(weekStart)}`, [
        ["Avg % of Goal",  weekAvgPct,     "percent"],
        ["≥ 100%",         weekMeeting,    "number"],
        ["< 90%",          weekBelow90,    "number"],
        ["Total Users",    weekTotalUsers, "number"],
      ]);
    });

    // Blank row after cards
    wsIndiv.addRow([]);
    wsIndiv.getRow(wsIndiv.rowCount).height = 8;

    // --- blank row ---
    wsIndiv.addRow([]);
    wsIndiv.getRow(wsIndiv.rowCount).height = 6;

    // --- Section header ---
    const indivSectionRow = wsIndiv.addRow(["Detailed Individual Performance by Week", "", "", "", "", "", ""]);
    wsIndiv.mergeCells(`A${wsIndiv.rowCount}:G${wsIndiv.rowCount}`);
    const indivSectionCell = wsIndiv.getCell(`A${wsIndiv.rowCount}`);
    indivSectionCell.font      = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
    indivSectionCell.fill      = mkFill(SECTION_BG);
    indivSectionCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    indivSectionRow.height = 24;

    // --- Table header ---
    const indivTableStartRow = wsIndiv.rowCount + 1;

    // Header — use styleTableHeader for consistent wrap + freeze
    const indivHRow = wsIndiv.addRow(["Week Start", "User", "Desk", "Location", "Answered", "Weekly Goal", "% of Weekly Goal"]);
    styleTableHeader(indivHRow, 7, 4);

    // Freeze pane at row AFTER header
    wsIndiv.views = [{ showGridLines: false, state: "frozen", ySplit: indivTableStartRow, xSplit: 0 }];

    const indivTableRows = [];
    indivRows.forEach((r, idx) => {
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const rowValues = [
        formatDate(r.week_start),
        r.user,
        r.desk || "",
        r.location || "",
        r.answered,
        r.weeklyGoal !== null && r.weeklyGoal !== undefined ? r.weeklyGoal : "",
        r.percentOfGoal !== null && r.percentOfGoal !== undefined ? r.percentOfGoal : "",
      ];
      const row = wsIndiv.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(bgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum <= 4 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: thinBorder, right: thinBorder };
        if (colNum === 5) cell.numFmt = "#,##0";
        if (colNum === 6 && r.weeklyGoal !== null && r.weeklyGoal !== undefined) cell.numFmt = "#,##0";
        if (colNum === 7) {
          cell.numFmt = "0.00%";
          if (r.percentOfGoal !== null && r.percentOfGoal !== undefined) {
            const { bg, fg } = perfColor(r.percentOfGoal);
            cell.fill = mkFill(bg);
            cell.font = mkFont({ color: { argb: fg } });
          }
        }
      });
      indivTableRows.push(rowValues);
    });

    if (indivRows.length > 0) {
      wsIndiv.addTable({
        name: "IndividualPerformance",
        ref: `A${indivTableStartRow}:G${wsIndiv.rowCount}`,
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [
          { name: "Week Start",       filterButton: true },
          { name: "User",             filterButton: true },
          { name: "Desk",             filterButton: true },
          { name: "Location",         filterButton: true },
          { name: "Answered",         filterButton: true },
          { name: "Weekly Goal",      filterButton: true },
          { name: "% of Weekly Goal", filterButton: true },
        ],
        rows: indivTableRows,
      });

      // Auto-fit column widths for individual sheet based on content
      wsIndiv.columns.forEach((col) => {
        let maxLen = 10;
        col.eachCell({ includeEmpty: false }, (cell) => {
          const val = cell.value != null ? String(cell.value) : "";
          if (val.length > maxLen) maxLen = val.length;
        });
        col.width = Math.min(maxLen + 2, 40);
      });
    }

    // ---- Write and download ----
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${periodLabel} – Call Performance Report.xlsx`;
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
      </div>

      <Tabs defaultValue="reporting">
        <TabsList className="mb-2">
          <TabsTrigger value="reporting" className="gap-2"><Phone className="w-3.5 h-3.5" /> Reporting</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="w-3.5 h-3.5" /> User Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <CallLogUserConfigAdmin />
        </TabsContent>

        <TabsContent value="reporting">
      <div className="flex justify-end">
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
                  { label: "Inbound Answered", value: totalInboundAnswered.toLocaleString(), color: "text-green-700" },
                  { label: "Missed",           value: totalMissed.toLocaleString(),          color: "text-red-600" },
                  { label: "Inbound Answer Rate",
                    value: overallAnswerRate === null ? "—" : (overallAnswerRate * 100).toFixed(1) + "%",
                    color: overallAnswerRate === null ? "text-slate-400" : overallAnswerRate >= 0.8 ? "text-green-700" : overallAnswerRate >= 0.5 ? "text-yellow-700" : "text-red-600" },
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

              {/* Performance Views */}
              {sortedWeeks.length > 0 && (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <PerformanceViews sortedWeeks={sortedWeeks} userConfigMap={userConfigMap} />
                  </CardContent>
                </Card>
              )}

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
                          const inbound = u.inbound || 0;
                          const inboundAnswered = u.inbound_answered != null ? u.inbound_answered : (u.answered || 0);
                          const ar = inbound > 0 ? inboundAnswered / inbound : null;
                          return (
                            <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                              <td className="px-4 py-2.5 font-medium text-slate-800">{highlightUser(u.user)}</td>
                              <td className="px-4 py-2.5 text-slate-700">{(u.total_calls || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-blue-700">{inbound.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-indigo-700">{(u.outbound || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-green-700">{inboundAnswered.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-red-600">{(u.missed || 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.total_duration_seconds)}</td>
                              <td className="px-4 py-2.5">
                                {ar === null ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <span className={`font-semibold ${ar >= 0.8 ? "text-green-700" : ar >= 0.5 ? "text-yellow-700" : "text-red-600"}`}>
                                    {(ar * 100).toFixed(1)}%
                                  </span>
                                )}
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
        </TabsContent>

      </Tabs>

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