import React from 'react';

export default function WeeklyTable({ data = [] }) {
  return (
    <div className="overflow-auto max-h-96 border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="p-3 text-left font-semibold text-slate-700">Week Starting</th>
            <th className="p-3 text-right font-semibold text-slate-700">Total Inbound</th>
            <th className="p-3 text-right font-semibold text-slate-700">Answered</th>
            <th className="p-3 text-right font-semibold text-slate-700">Missed</th>
            <th className="p-3 text-right font-semibold text-slate-700">Answer Rate</th>
            <th className="p-3 text-right font-semibold text-slate-700">Benchmark Inbound</th>
            <th className="p-3 text-right font-semibold text-slate-700">Benchmark Answered</th>
            <th className="p-3 text-right font-semibold text-slate-700">Benchmark Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, i) => (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                <td className="p-3 text-slate-700">{row.week_start}</td>
                <td className="p-3 text-right text-slate-700">{row.total_inbound}</td>
                <td className="p-3 text-right text-green-700 font-medium">{row.total_answered}</td>
                <td className="p-3 text-right text-red-700 font-medium">{row.total_missed}</td>
                <td className="p-3 text-right font-semibold text-blue-700">{(row.answer_rate * 100).toFixed(1)}%</td>
                <td className="p-3 text-right text-slate-700">{row.benchmark_inbound}</td>
                <td className="p-3 text-right text-green-700 font-medium">{row.benchmark_answered}</td>
                <td className="p-3 text-right font-semibold text-purple-700">{(row.benchmark_answer_rate * 100).toFixed(1)}%</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="p-8 text-center text-slate-500">No data available</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}