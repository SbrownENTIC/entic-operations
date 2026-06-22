import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export default function CallLogDetailModal({ metric, loading = false, onClose }) {
  const data = metric?.data || [];
  const totalCount = metric?.totalCount ?? data.length;

  const columns = metric?.type === 'outbound' || (data[0] && 'dialed_number' in data[0] && !('caller_number' in data[0]))
    ? ['call_date', 'call_time', 'extension', 'dialed_number', 'duration_seconds']
    : ['call_date', 'call_time', 'extension', 'caller_number', 'duration_seconds', 'disposition', 'answered', 'missed'];

  const columnLabels = {
    call_date: 'Date',
    call_time: 'Time',
    extension: 'Extension',
    caller_number: 'Caller',
    dialed_number: 'Dialed',
    duration_seconds: 'Duration (s)',
    disposition: 'Disposition',
    answered: 'Answered',
    missed: 'Missed',
  };

  const formatValue = (key, value) => {
    if (key === 'duration_seconds') return value ? value.toLocaleString() : '0';
    if (key === 'answered' || key === 'missed') return value ? 'Yes' : 'No';
    return String(value || '');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{metric?.title || 'Call Records'}</DialogTitle>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading records…' : `${totalCount.toLocaleString()} records`}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-auto flex-1 border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th key={col} className="p-3 text-left font-semibold text-slate-700">
                      {columnLabels[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.slice(0, 500).map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                      {columns.map((col) => (
                        <td key={col} className="p-3 text-slate-700">
                          {formatValue(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="p-8 text-center text-slate-500">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalCount > 500 && (
          <p className="text-xs text-slate-500 mt-2">
            Showing first 500 records. Export to Excel to view summary data for all {totalCount.toLocaleString()} records.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
