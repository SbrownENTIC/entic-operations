import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Phone, ArrowLeft, AlertCircle, CheckCircle, Loader2, Download, Trash2 } from "lucide-react";
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
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
  "total call duration",
  "inbound call duration",
  "outbound call duration"
];

// ---- File parsing ----
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
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

  const [view, setView] = useState("list");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["call-log-periods"],
    queryFn: () => base44.entities.CallLogPeriod.list("-uploaded_at")
  });

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriod?.id],
    queryFn: () => base44.entities.CallLogUserSummary.filter({ period_id: selectedPeriod.id }),
    enabled: !!selectedPeriod?.id
  });

  const activeSummaries = userSummaries
    .filter(u => (u.total_calls || 0) > 0)
    .sort((a, b) => (b.total_calls || 0) - (a.total_calls || 0));

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
    setUploadError("");
    setPeriodStart("");
    setPeriodEnd("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
  };

  const handleUpload = async () => {
    setUploadError("");
    if (!uploadFile)    { setUploadError("Please select a file."); return; }
    if (!periodStart)   { setUploadError("Reporting Period Start Date is required."); return; }
    if (!periodEnd)     { setUploadError("Reporting Period End Date is required."); return; }
    if (periodEnd < periodStart) { setUploadError("End date must be on or after start date."); return; }

    setUploading(true);
    let rows;
    try {
      rows = await parseFile(uploadFile);
    } catch {
      setUploadError("Failed to parse file. Please check the file format.");
      setUploading(false);
      return;
    }

    if (!rows || rows.length === 0) {
      setUploadError("File contains no data rows.");
      setUploading(false);
      return;
    }

    // Client-side header validation (normalized)
    const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
    const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
    if (missing.length > 0) {
      setUploadError(`Invalid file format. Required headers missing: ${missing.join(", ")}`);
      setUploading(false);
      return;
    }

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

      queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
      queryClient.invalidateQueries({ queryKey: ["call-log-summaries"] });

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
      setView("list");
    }
    setDeleteDialogPeriod(null);
    setDeleting(false);
    toast({ title: "Deleted", description: "Reporting period deleted." });
  };

  const exportPeriodCSV = () => {
    if (!selectedPeriod) return;
    const csvRows = [
      ["User","Total Calls","Inbound","Outbound","Answered","Missed","Duration (H:MM:SS)","Answer Rate (%)","Avg Duration (H:MM:SS)"],
      ...activeSummaries.map(u => [
        u.user,
        u.total_calls,
        u.inbound,
        u.outbound,
        u.answered,
        u.missed,
        secondsToHHMMSS(u.total_duration_seconds),
        formatPercent(u.answer_rate),
        secondsToHHMMSS(u.avg_duration_seconds)
      ]),
      [],
      ["TOTALS", totalCalls, totalInbound, totalOutbound, totalAnswered, totalMissed,
        secondsToHHMMSS(totalDurationSec), formatPercent(overallAnswerRate), secondsToHHMMSS(overallAvgDurationSec)]
    ];
    const csv = csvRows.map(r => r.map(c => {
      const cs = String(c);
      return cs.includes(",") || cs.includes('"') ? `"${cs.replace(/"/g, '""')}"` : cs;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `call_log_${selectedPeriod.reporting_period_start}_${selectedPeriod.reporting_period_end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- DETAIL VIEW ----
  if (view === "detail" && selectedPeriod) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setView("list"); setSelectedPeriod(null); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">
              {formatDate(selectedPeriod.reporting_period_start)} – {formatDate(selectedPeriod.reporting_period_end)}
            </h2>
            <p className="text-sm text-slate-500">{selectedPeriod.source_file_name}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[selectedPeriod.status] || "bg-slate-100 text-slate-700"}`}>
            {selectedPeriod.status}
          </span>
          <Button variant="outline" size="sm" onClick={exportPeriodCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        {summariesLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : (
          <>
            {/* Summary metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Calls",    value: totalCalls.toLocaleString() },
                { label: "Inbound",        value: totalInbound.toLocaleString() },
                { label: "Outbound",       value: totalOutbound.toLocaleString() },
                { label: "Answered",       value: totalAnswered.toLocaleString() },
                { label: "Missed",         value: totalMissed.toLocaleString() },
                { label: "Answer Rate",    value: formatPercent(overallAnswerRate) },
                { label: "Total Duration", value: secondsToHHMMSS(totalDurationSec) },
                { label: "Avg Duration",   value: secondsToHHMMSS(overallAvgDurationSec) },
              ].map(m => (
                <Card key={m.label} className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                    <p className="text-xl font-bold text-slate-900">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* User breakdown table */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <CardTitle className="text-base">User Breakdown ({activeSummaries.length} users)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["User","Total Calls","Inbound","Outbound","Answered","Missed","Duration","Answer Rate","Avg Duration"].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSummaries.map((u, i) => (
                        <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{u.user}</td>
                          <td className="px-4 py-2.5 text-slate-700">{(u.total_calls || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-600">{(u.inbound || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-600">{(u.outbound || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-green-700">{(u.answered || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-red-600">{(u.missed || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.total_duration_seconds)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`font-semibold ${(u.answer_rate || 0) >= 0.8 ? "text-green-700" : (u.answer_rate || 0) >= 0.5 ? "text-yellow-700" : "text-red-600"}`}>
                              {formatPercent(u.answer_rate)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.avg_duration_seconds)}</td>
                        </tr>
                      ))}
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
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Call Log Reporting
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Upload raw Vonage exports and view reporting periods</p>
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

            <div className="text-xs text-slate-500 bg-white/60 border border-slate-200 rounded p-2.5">
              <strong>Expected Vonage headers:</strong> User, Total Calls, Total Call Duration, Inbound Calls, Inbound Call Duration, Outbound Calls, Outbound Call Duration, Answered Calls, Missed Calls<br />
              <span className="text-slate-400">Header matching is case-insensitive. Duration values should be HH:MM:SS.</span>
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

      {/* Periods list */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {periodsLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading periods...
            </div>
          ) : periods.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No call log periods uploaded yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">End Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">File</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Uploaded At</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period, i) => (
                  <tr
                    key={period.id}
                    className={`border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${i % 2 !== 0 ? "bg-slate-50/30" : ""}`}
                    onClick={() => { setSelectedPeriod(period); setView("detail"); }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{formatDate(period.reporting_period_start)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(period.reporting_period_end)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[period.status] || "bg-slate-100 text-slate-700"}`}>
                        {period.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{period.source_file_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {period.uploaded_at
                        ? new Date(period.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => setDeleteDialogPeriod(period)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

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