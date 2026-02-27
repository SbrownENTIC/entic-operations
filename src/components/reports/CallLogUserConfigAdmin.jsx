import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Save, X, AlertCircle, CheckCircle, Loader2, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ExcelJS from "exceljs";

const LOCATIONS = ["Farmington", "Manchester", "Glastonbury", "Bloomfield"];
const GROUPS = ["Front Desk", "NP Coordinator", "Other"];

function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, " ").trim();
}

function serializeCellValue(val) {
  if (val == null) return "";
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "object" && val.result != null) return serializeCellValue(val.result);
  if (typeof val === "object" && val.text != null) return val.text;
  if (typeof val === "object") return String(val);
  return val;
}

function sheetToJson(worksheet) {
  const rows = [];
  let headers = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values.slice(1);
    if (rowNum === 1) {
      headers = values.map(v => (v == null ? "" : String(v)));
    } else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = serializeCellValue(values[i]); });
      rows.push(obj);
    }
  });
  return rows;
}

function parseBooleanValue(val) {
  if (val == null || val === "") return false;
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase().trim();
  return ["true", "yes", "1", "x", "✓", "checked"].includes(s);
}

export default function CallLogUserConfigAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPreview, setImportPreview] = useState(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["call-log-user-configs"],
    queryFn: () => base44.entities.CallLogUserConfig.list("user_name"),
  });

  const filtered = configs
    .filter(c => !search || (c.user_name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.user_name || "").localeCompare(b.user_name || ""));

  const startEdit = (config) => {
    setEditingId(config.id);
    setEditValues({
      extension: config.extension || "",
      location: config.location || "",
      benchmark_group: config.benchmark_group || "Other",
      daily_goal: config.daily_goal || "",
      include_in_benchmark: config.include_in_benchmark || false,
      active: config.active !== false,
      notes: config.notes || "",
    });
  };

  const isExtensionDuplicate = (ext, excludeId = null) => {
    if (!ext || !ext.trim()) return false;
    return configs.some(c => c.id !== excludeId && (c.extension || "").trim() === ext.trim());
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async (id) => {
    if (editValues.extension && isExtensionDuplicate(editValues.extension, id)) {
      toast({ title: "Error", description: `Extension "${editValues.extension.trim()}" is already assigned to another user.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    const saveData = { ...editValues, extension: editValues.extension ? editValues.extension.trim() : null };
    await base44.entities.CallLogUserConfig.update(id, saveData);
    queryClient.invalidateQueries({ queryKey: ["call-log-user-configs"] });
    setEditingId(null);
    setEditValues({});
    setSaving(false);
    toast({ title: "Saved", description: "User config updated." });
  };

  // --- Import ---
  const resetImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportError("");
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportError("");
    setImportPreview(null);

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    let rows = [];
    if (isXlsx) {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) { setImportError("No worksheet found."); return; }
      rows = sheetToJson(ws);
    } else {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) { setImportError("File is empty."); return; }
      const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
      rows = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
        return obj;
      });
    }

    if (!rows.length) { setImportError("No data rows found."); return; }

    // Find header mapping
    const sampleKeys = Object.keys(rows[0]);
    const hMap = {};
    sampleKeys.forEach(k => { hMap[normalizeHeader(k)] = k; });

    if (!hMap["user"]) { setImportError('Column "User" is required.'); return; }

    // Check for blank user_name
    const blankRows = rows.filter(r => !String(r[hMap["user"]] || "").trim());
    if (blankRows.length > 0) {
      setImportError(`${blankRows.length} row(s) have a blank User value. Please fix and re-upload.`);
      return;
    }

    const preview = rows.map(r => ({
      user_name: String(r[hMap["user"]] || "").trim(),
      location: hMap["location"] ? String(r[hMap["location"]] || "").trim() : "",
      benchmark_group: hMap["benchmark_group"] ? String(r[hMap["benchmark_group"]] || "").trim() || "Other" : "Other",
      include_in_benchmark: hMap["need to be added to goal?"]
        ? parseBooleanValue(r[hMap["need to be added to goal?"]])
        : (hMap["include_in_benchmark"] ? parseBooleanValue(r[hMap["include_in_benchmark"]]) : false),
      notes: hMap["notes"] ? String(r[hMap["notes"]] || "").trim() : null,
    }));

    setImportPreview(preview);
  };

  const handleImport = async () => {
    if (!importPreview || !importPreview.length) return;
    setImporting(true);
    setImportError("");

    // Load existing configs for upsert
    const existing = await base44.entities.CallLogUserConfig.list();
    const existingMap = {};
    existing.forEach(c => { existingMap[c.user_name] = c; });

    let created = 0, updated = 0;
    for (const row of importPreview) {
      const existing = existingMap[row.user_name];
      const updateData = {
        location: row.location || undefined,
        benchmark_group: row.benchmark_group || "Other",
        include_in_benchmark: row.include_in_benchmark,
      };
      if (row.notes !== null) updateData.notes = row.notes;

      if (existing) {
        await base44.entities.CallLogUserConfig.update(existing.id, updateData);
        updated++;
      } else {
        await base44.entities.CallLogUserConfig.create({
          user_name: row.user_name,
          benchmark_group: row.benchmark_group || "Other",
          include_in_benchmark: row.include_in_benchmark,
          active: true,
          ...(row.location ? { location: row.location } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
        });
        created++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["call-log-user-configs"] });
    toast({ title: "Import Complete", description: `${created} created, ${updated} updated.` });
    resetImport();
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Call Log User Directory
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Manage user location and benchmark group assignments</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="w-3.5 h-3.5" /> Import Users
        </Button>
      </div>

      {/* Import Panel */}
      {importOpen && (
        <div className="bg-blue-50/40 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 text-sm">Import Call Log User Config</h4>
            <Button variant="ghost" size="sm" onClick={resetImport}><X className="w-4 h-4" /></Button>
          </div>
          <p className="text-xs text-slate-500">
            Accepts .xlsx or .csv. Required column: <strong>User</strong>. Optional: Location, "Need to be Added to Goal?" (checkbox), Benchmark_Group, Notes.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {importError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2.5 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {importError}
            </div>
          )}
          {importPreview && (
            <div className="bg-white border border-slate-200 rounded p-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">{importPreview.length} rows ready to import:</p>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-2 py-1 font-semibold">User</th>
                      <th className="text-left px-2 py-1 font-semibold">Location</th>
                      <th className="text-left px-2 py-1 font-semibold">Group</th>
                      <th className="text-left px-2 py-1 font-semibold">In Benchmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "" : "bg-slate-50/50"}>
                        <td className="px-2 py-0.5">{r.user_name}</td>
                        <td className="px-2 py-0.5">{r.location || "—"}</td>
                        <td className="px-2 py-0.5">{r.benchmark_group}</td>
                        <td className="px-2 py-0.5">{r.include_in_benchmark ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {importPreview.length > 10 && (
                      <tr><td colSpan={4} className="px-2 py-1 text-slate-400 italic">...and {importPreview.length - 10} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || !importPreview}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing...</> : <><CheckCircle className="w-3.5 h-3.5" /> Run Import</>}
            </Button>
            <Button size="sm" variant="outline" onClick={resetImport}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by user name…"
        className="max-w-xs h-8 text-sm"
      />

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">User Name</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Extension</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Location</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Group</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Daily Goal</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">In Benchmark</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Active</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Notes</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((config, i) => {
                const isEditing = editingId === config.id;
                return (
                  <tr key={config.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{config.user_name}</td>

                    {isEditing ? (
                      <>
                        <td className="px-3 py-1.5">
                          <select
                            value={editValues.location || ""}
                            onChange={e => setEditValues(v => ({ ...v, location: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white w-full"
                          >
                            <option value="">— None —</option>
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={editValues.benchmark_group}
                            onChange={e => setEditValues(v => ({ ...v, benchmark_group: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white w-full"
                          >
                            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            value={editValues.daily_goal}
                            onChange={e => setEditValues(v => ({ ...v, daily_goal: e.target.value === "" ? "" : Number(e.target.value) }))}
                            className="h-7 text-xs w-20"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={editValues.include_in_benchmark}
                            onChange={e => setEditValues(v => ({ ...v, include_in_benchmark: e.target.checked }))}
                            className="w-4 h-4 accent-blue-600"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={editValues.active}
                            onChange={e => setEditValues(v => ({ ...v, active: e.target.checked }))}
                            className="w-4 h-4 accent-blue-600"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editValues.notes}
                            onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="Notes…"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 gap-1" onClick={() => saveEdit(config.id)} disabled={saving}>
                              <Save className="w-3 h-3" /> Save
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-slate-600">{config.location || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-xs ${
                            config.benchmark_group === "Front Desk" ? "border-blue-300 text-blue-700 bg-blue-50" :
                            config.benchmark_group === "NP Coordinator" ? "border-purple-300 text-purple-700 bg-purple-50" :
                            "border-slate-300 text-slate-600 bg-slate-50"
                          }`}>
                            {config.benchmark_group || "Other"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-center">{config.daily_goal != null && config.daily_goal !== "" ? config.daily_goal : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-center">
                          {config.include_in_benchmark
                            ? <CheckCircle className="w-4 h-4 text-green-600 inline" />
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {config.active !== false
                            ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
                            : <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">Inactive</Badge>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs max-w-[180px] truncate">{config.notes || ""}</td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => startEdit(config)}>
                            Edit
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-sm">
                    {search ? "No users match your search." : "No user configs yet. Import users to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">{filtered.length} user{filtered.length !== 1 ? "s" : ""} shown</p>
    </div>
  );
}