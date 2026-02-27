import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Trash2, CheckCircle, Loader2, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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

const LOCATIONS = ["", "Glastonbury", "Manchester", "Bloomfield", "Farmington"];

const EMPTY_NEW = {
  user_display_name: "",
  extension: "",
  desk_name: "",
  location: "",
  is_active: true,
  notes: "",
};

export default function CallLogExtensionDirectoryAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_NEW });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["call-log-extension-directory"],
    queryFn: () => base44.entities.CallLogExtensionDirectory.list("extension"),
  });

  const filtered = entries
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (e.user_display_name || "").toLowerCase().includes(q) ||
        (e.extension || "").toLowerCase().includes(q) ||
        (e.desk_name || "").toLowerCase().includes(q) ||
        (e.location || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.extension || "").localeCompare(b.extension || ""));

  // Validate uniqueness of extension
  const isExtensionDuplicate = (ext, excludeId = null) => {
    return entries.some(e => e.id !== excludeId && (e.extension || "").trim() === ext.trim() && ext.trim() !== "");
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditValues({
      user_display_name: entry.user_display_name || "",
      extension: entry.extension || "",
      desk_name: entry.desk_name || "",
      location: entry.location || "",
      is_active: entry.is_active !== false,
      notes: entry.notes || "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async (id) => {
    if (!editValues.user_display_name?.trim()) {
      toast({ title: "Error", description: "User Display Name is required.", variant: "destructive" });
      return;
    }
    if (!editValues.extension?.trim()) {
      toast({ title: "Error", description: "Extension is required.", variant: "destructive" });
      return;
    }
    if (isExtensionDuplicate(editValues.extension, id)) {
      toast({ title: "Error", description: `Extension "${editValues.extension}" is already mapped to another user.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    await base44.entities.CallLogExtensionDirectory.update(id, editValues);
    queryClient.invalidateQueries({ queryKey: ["call-log-extension-directory"] });
    setEditingId(null);
    setEditValues({});
    setSaving(false);
    toast({ title: "Saved", description: "Extension mapping updated." });
  };

  const saveNewRow = async () => {
    if (!newRow.user_display_name?.trim()) {
      toast({ title: "Error", description: "User Display Name is required.", variant: "destructive" });
      return;
    }
    if (!newRow.extension?.trim()) {
      toast({ title: "Error", description: "Extension is required.", variant: "destructive" });
      return;
    }
    if (isExtensionDuplicate(newRow.extension)) {
      toast({ title: "Error", description: `Extension "${newRow.extension}" is already mapped.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    await base44.entities.CallLogExtensionDirectory.create({
      ...newRow,
      extension: newRow.extension.trim(),
      user_display_name: newRow.user_display_name.trim(),
    });
    queryClient.invalidateQueries({ queryKey: ["call-log-extension-directory"] });
    setAdding(false);
    setNewRow({ ...EMPTY_NEW });
    setSaving(false);
    toast({ title: "Added", description: "Extension mapping added." });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await base44.entities.CallLogExtensionDirectory.delete(deleteTarget.id);
    queryClient.invalidateQueries({ queryKey: ["call-log-extension-directory"] });
    setDeleteTarget(null);
    setDeleting(false);
    toast({ title: "Deleted", description: "Extension mapping removed." });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            Extension Directory
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Map phone extensions (CDR "To" column) to user display names for inbound call attribution.
            Unmapped extensions are excluded from performance metrics.
          </p>
        </div>
        <Button size="sm" onClick={() => { setAdding(true); setNewRow({ ...EMPTY_NEW }); }} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add Extension
        </Button>
      </div>

      {/* Search */}
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, extension, or location…"
        className="max-w-sm h-8 text-sm"
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
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">Extension</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">User Display Name</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Desk Name</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Location</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Active</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">Notes</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {/* New row form */}
              {adding && (
                <tr className="border-b border-blue-200 bg-blue-50/40">
                  <td className="px-3 py-1.5">
                    <Input
                      value={newRow.extension}
                      onChange={e => setNewRow(v => ({ ...v, extension: e.target.value }))}
                      className="h-7 text-xs w-28"
                      placeholder="e.g. 1001"
                      autoFocus
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={newRow.user_display_name}
                      onChange={e => setNewRow(v => ({ ...v, user_display_name: e.target.value }))}
                      className="h-7 text-xs w-40"
                      placeholder="Display Name"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={newRow.desk_name}
                      onChange={e => setNewRow(v => ({ ...v, desk_name: e.target.value }))}
                      className="h-7 text-xs w-32"
                      placeholder="e.g. Check In"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={newRow.location}
                      onChange={e => setNewRow(v => ({ ...v, location: e.target.value }))}
                      className="border border-slate-300 rounded px-2 py-1 text-xs bg-white w-full"
                    >
                      {LOCATIONS.map(l => <option key={l} value={l}>{l || "— None —"}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={newRow.is_active}
                      onChange={e => setNewRow(v => ({ ...v, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={newRow.notes}
                      onChange={e => setNewRow(v => ({ ...v, notes: e.target.value }))}
                      className="h-7 text-xs"
                      placeholder="Notes…"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 gap-1" onClick={saveNewRow} disabled={saving}>
                        <Save className="w-3 h-3" /> Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => { setAdding(false); setNewRow({ ...EMPTY_NEW }); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map((entry, i) => {
                const isEditing = editingId === entry.id;
                return (
                  <tr key={entry.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                    {isEditing ? (
                      <>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editValues.extension}
                            onChange={e => setEditValues(v => ({ ...v, extension: e.target.value }))}
                            className="h-7 text-xs w-28"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editValues.user_display_name}
                            onChange={e => setEditValues(v => ({ ...v, user_display_name: e.target.value }))}
                            className="h-7 text-xs w-40"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={editValues.desk_name}
                            onChange={e => setEditValues(v => ({ ...v, desk_name: e.target.value }))}
                            className="h-7 text-xs w-32"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={editValues.location}
                            onChange={e => setEditValues(v => ({ ...v, location: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white w-full"
                          >
                            {LOCATIONS.map(l => <option key={l} value={l}>{l || "— None —"}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={editValues.is_active}
                            onChange={e => setEditValues(v => ({ ...v, is_active: e.target.checked }))}
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
                            <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 gap-1" onClick={() => saveEdit(entry.id)} disabled={saving}>
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
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800 whitespace-nowrap">{entry.extension}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{entry.user_display_name}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{entry.desk_name || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">
                          {entry.location
                            ? <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">{entry.location}</Badge>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {entry.is_active !== false
                            ? <CheckCircle className="w-4 h-4 text-green-600 inline" />
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs max-w-[140px] truncate">{entry.notes || ""}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => startEdit(entry)}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(entry)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

              {filtered.length === 0 && !adding && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400 text-sm">
                    {search ? "No entries match your search." : "No extension mappings yet. Click 'Add Extension' to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">{filtered.length} extension{filtered.length !== 1 ? "s" : ""} shown</p>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Extension Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the mapping for extension <strong>{deleteTarget?.extension}</strong> ({deleteTarget?.user_display_name}). Inbound calls to this extension will be excluded from metrics until remapped.
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