import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function CallLogDetailModal({ metric, onClose }) {
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const columns = metric?.callType === 'outbound' 
    ? ['call_date', 'call_time', 'extension', 'dialed_number', 'duration_seconds', 'result']
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
    result: 'Result'
  };

  // Fetch paginated data from backend
  const { data: response = { records: [], total: 0, hasMore: false }, isLoading } = useQuery({
    queryKey: ['call-details', metric?.callType, offset, metric?.filter],
    queryFn: () => base44.functions.invoke('getCallLogDetails', {
      callType: metric?.callType,
      filter: metric?.filter || {},
      limit,
      offset
    }).then(res => res.data),
    enabled: !!metric?.callType
  });

  const formatValue = (key, value) => {
    if (key === 'duration_seconds') return value ? value.toLocaleString() : '0';
    if (key === 'answered' || key === 'missed') return value ? 'Yes' : 'No';
    return String(value || '');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{metric.title}</DialogTitle>
          <p className="text-sm text-slate-500">
            {isLoading ? 'Loading...' : `${response.total} total records`}
          </p>
        </DialogHeader>
        <div className="overflow-auto flex-1 border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="p-3 text-left font-semibold text-slate-700">
                      {columnLabels[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {response.records.length > 0 ? (
                  response.records.map((row, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                      {columns.map(col => (
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
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-slate-600">
            Showing {offset + 1} – {Math.min(offset + limit, response.total)} of {response.total} records
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={!response.hasMore || isLoading}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}