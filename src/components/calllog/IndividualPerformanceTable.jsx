import React from 'react';

export default function IndividualPerformanceTable({ data = [], showOutbound = true }) {
  return (
    <div className="overflow-auto max-h-96 border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="p-3 text-left font-semibold text-slate-700">User</th>
            <th className="p-3 text-left font-semibold text-slate-700">Group</th>
            <th className="p-3 text-center font-semibold text-slate-700">Benchmark</th>
            <th className="p-3 text-right font-semibold text-slate-700">Inbound</th>
            <th className="p-3 text-right font-semibold text-slate-700">Answered</th>
            <th className="p-3 text-right font-semibold text-slate-700">Missed</th>
            <th className="p-3 text-right font-semibold text-slate-700">Answer Rate</th>
            {showOutbound && (
              <>
                <th className="p-3 text-right font-semibold text-slate-700">Outbound</th>
                <th className="p-3 text-right font-semibold text-slate-700">Avg Duration</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                <td className="p-3 text-slate-700 font-medium">{row.user_name}</td>
                <td className="p-3 text-slate-600">{row.benchmark_group || '—'}</td>
                <td className="p-3 text-center text-slate-700">{row.include_in_benchmark ? '✓' : '—'}</td>
                <td className="p-3 text-right text-slate-700">{row.total_inbound || 0}</td>
                <td className="p-3 text-right text-green-700 font-medium">{row.total_answered || 0}</td>
                <td className="p-3 text-right text-red-700 font-medium">{row.total_missed || 0}</td>
                <td className="p-3 text-right font-semibold text-blue-700">
                  {row.total_inbound > 0 ? (row.answer_rate * 100).toFixed(1) : '0'}%
                </td>
                {showOutbound && (
                  <>
                    <td className="p-3 text-right text-slate-700">{row.total_outbound || 0}</td>
                    <td className="p-3 text-right text-slate-600">{row.avg_duration_seconds || 0}s</td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showOutbound ? 9 : 7} className="p-8 text-center text-slate-500">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}