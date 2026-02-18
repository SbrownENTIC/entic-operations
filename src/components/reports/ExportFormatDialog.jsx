import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Table2 } from "lucide-react";

export default function ExportFormatDialog({ open, onOpenChange, onExport, isLoading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Export Call Log Report</DialogTitle>
          <DialogDescription>
            Select your preferred format for the report
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-3 py-4">
          <button
            onClick={() => onExport('pdf')}
            disabled={isLoading}
            className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
          >
            <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Professional PDF</div>
              <div className="text-xs text-slate-600">Executive-ready report with charts and styling</div>
            </div>
          </button>

          <button
            onClick={() => onExport('excel')}
            disabled={isLoading}
            className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all text-left disabled:opacity-50"
          >
            <Table2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Formatted Excel</div>
              <div className="text-xs text-slate-600">Styled spreadsheet with frozen headers</div>
            </div>
          </button>

          <button
            onClick={() => onExport('csv')}
            disabled={isLoading}
            className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left disabled:opacity-50"
          >
            <Download className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-slate-900">Raw CSV</div>
              <div className="text-xs text-slate-600">Unformatted data for analysis</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}