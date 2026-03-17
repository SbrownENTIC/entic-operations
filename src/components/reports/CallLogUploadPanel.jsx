import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatDate } from "./ExcelExportHelpers";

export default function CallLogUploadPanel({
  fileInputRef,
  uploadFile,
  sheetNames,
  selectedSheet,
  weekSummary,
  uploadError,
  uploading,
  onFileSelect,
  onSheetChange,
  onUpload,
  onCancel,
  workbook,
  sheetToJson,
  validatePeriodColumns,
  detectWeekSummary,
  setSelectedSheet,
  setUploadError,
  setWeekSummary,
}) {
  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Upload Vonage Call Log Export</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>✕</Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">Upload Type:</p>
          <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white shadow-sm">✓ User Summary (Aggregated)</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 cursor-default">Inbound Call Detail (CDR)</span>
          </div>
          <p className="text-xs text-slate-400">For CDR inbound call-level detail, use the <strong>Upload CDR</strong> tab.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            File (.xlsx or .csv) <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={onFileSelect}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {uploadFile && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-600" /> {uploadFile.name}
            </p>
          )}
        </div>

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
              {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}

        {sheetNames.length === 1 && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-600" /> Worksheet: <strong>{sheetNames[0]}</strong> (auto-selected)
          </p>
        )}

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
          <strong>Required headers (Aggregated):</strong> User, Total Calls, Inbound Calls, Outbound Calls, Answered Calls, Missed Calls, Total Call Duration (Minutes), Inbound Call Duration (Minutes), Outbound Call Duration (Minutes), Reporting Period Start, Reporting Period End<br />
          <span className="text-slate-400">Inbound Answer Rate = Answered Calls ÷ Inbound Calls. If Inbound Calls = 0, rate = 0%.</span>
        </div>

        {uploadError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {uploadError}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onUpload} disabled={uploading} className="gap-2 bg-blue-600 hover:bg-blue-700">
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              : <><Upload className="w-4 h-4" /> Process Upload</>}
          </Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}