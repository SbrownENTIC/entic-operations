import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { parse, isValid, format, parseISO, isSameDay, getYear } from "date-fns";
import { RefreshCw, ArrowRight, AlertCircle, Trash2, Plus } from "lucide-react";

export default function BulkSyncModal({ isOpen, onClose, providers, existingEntries, onSync, isLoading }) {
  const [step, setStep] = useState('input'); // input, preview
  const [providerId, setProviderId] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selectedDeletions, setSelectedDeletions] = useState([]);

  const reset = () => {
    setStep('input');
    setPasteInput("");
    setAnalysis(null);
    setSelectedDeletions([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAnalyze = () => {
    if (!providerId || !pasteInput) return;

    // 1. Parse Input Dates
    const lines = pasteInput.split(/\r?\n/);
    const validDates = new Set();
    const yearsInInput = new Set();

    lines.forEach(line => {
      const dateMatch = line.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (dateMatch) {
        try {
          const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
          const parsedDate = parse(dateStr, 'M/d/yyyy', new Date());
          if (isValid(parsedDate)) {
            validDates.add(format(parsedDate, 'yyyy-MM-dd'));
            yearsInInput.add(getYear(parsedDate));
          }
        } catch {
          // Skip unparseable date values
        }
      }
    });

    const inputDateList = Array.from(validDates).sort();

    // 2. Get Relevant Existing Entries
    // Filter for selected provider and years present in the input
    // If input has 2026 dates, we only look at 2026 entries for potential deletion
    const providerEntries = existingEntries.filter(e => 
      e.provider_id === providerId && 
      yearsInInput.has(getYear(parseISO(e.start_date)))
    );

    // 3. Compare
    const toAdd = [];
    const toDelete = []; // Candidates for deletion

    // Find dates in input that don't exist
    inputDateList.forEach(dateStr => {
      const exists = providerEntries.some(e => 
        isSameDay(parseISO(e.start_date), parseISO(dateStr))
      );
      if (!exists) {
        toAdd.push(dateStr);
      }
    });

    // Find entries in system not in input
    providerEntries.forEach(entry => {
      // We assume single day entries for simple comparison, or check if start date is in list
      const startDateStr = format(parseISO(entry.start_date), 'yyyy-MM-dd');
      if (!validDates.has(startDateStr)) {
        toDelete.push(entry);
      }
    });

    setAnalysis({
      years: Array.from(yearsInInput).sort().join(', '),
      toAdd,
      toDelete
    });
    
    // Default select all deletions
    setSelectedDeletions(toDelete.map(e => e.id));
    setStep('preview');
  };

  const handleConfirm = () => {
    if (!analysis) return;

    onSync({
      providerId,
      datesToAdd: analysis.toAdd,
      idsToDelete: selectedDeletions
    });
  };

  const toggleDeletion = (id) => {
    setSelectedDeletions(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Sync Time Off</DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4 flex-1 overflow-y-auto p-1">
            <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-800 flex gap-2">
              <RefreshCw className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Sync from Spreadsheet</p>
                <p>This tool helps reconcile the system with your master spreadsheet. Paste your list of dates, and we'll identify which entries need to be added and which ones are in the system but missing from your list (potential deletions).</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Provider *</Label>
              <Combobox
                options={providers.map(p => ({ value: p.id, label: p.full_name }))}
                value={providerId}
                onChange={setProviderId}
                placeholder="Select provider..."
              />
            </div>

            <div className="space-y-2">
              <Label>Paste Dates *</Label>
              <Textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="1/19/2026&#10;2/12/2026&#10;..."
                className="font-mono h-64"
              />
              <p className="text-xs text-slate-500">
                Paste the full column of dates. We'll ignore blank lines and text that isn't a date.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex-1 overflow-y-auto p-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Sync Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setStep('input')}>Back to Input</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* To Add Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-medium border-b pb-2 border-green-200">
                  <Plus className="w-4 h-4" />
                  <span>To Add ({analysis.toAdd.length})</span>
                </div>
                {analysis.toAdd.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No new dates found.</p>
                ) : (
                  <div className="bg-green-50 rounded-md border border-green-100 p-3 max-h-60 overflow-y-auto space-y-1">
                    {analysis.toAdd.map(date => (
                      <div key={date} className="text-sm font-mono text-green-900">
                        {format(parseISO(date), 'MM/dd/yyyy')}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* To Delete Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-medium border-b pb-2 border-red-200">
                  <Trash2 className="w-4 h-4" />
                  <span>Potential Deletions ({analysis.toDelete.length})</span>
                </div>
                <p className="text-xs text-slate-500">
                  These entries exist in the system for {analysis.years} but were NOT in your pasted list. Uncheck any you wish to keep.
                </p>
                {analysis.toDelete.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No mismatches found.</p>
                ) : (
                  <div className="bg-red-50 rounded-md border border-red-100 p-2 max-h-60 overflow-y-auto space-y-2">
                    {analysis.toDelete.map(entry => (
                      <div key={entry.id} className="flex items-start gap-2 p-2 bg-white rounded border border-red-100">
                        <Checkbox 
                          id={`del-${entry.id}`}
                          checked={selectedDeletions.includes(entry.id)}
                          onCheckedChange={() => toggleDeletion(entry.id)}
                        />
                        <label htmlFor={`del-${entry.id}`} className="text-sm cursor-pointer flex-1">
                          <div className="font-medium text-red-900">
                            {format(parseISO(entry.start_date), 'MM/dd/yyyy')}
                          </div>
                          <div className="text-xs text-red-700">
                            {entry.type} • {entry.reason || 'No reason'}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-100 p-4 rounded-lg text-sm space-y-1">
              <p className="font-medium">Summary of Changes:</p>
              <ul className="list-disc pl-5 text-slate-700">
                <li>Create {analysis.toAdd.length} new entries (Default: Time Off, Approved)</li>
                <li>Delete {selectedDeletions.length} existing entries</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === 'input' ? (
            <Button onClick={handleAnalyze} disabled={!providerId || !pasteInput}>
              Analyze & Preview
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Syncing...' : 'Confirm Sync'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}