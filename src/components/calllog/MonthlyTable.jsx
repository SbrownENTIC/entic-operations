import React from 'react';
import { format, parseISO } from 'date-fns';

export default function MonthlyTable({ data = [] }) {
  const formatMonth = (monthStr) => {
    try {
      return format(parseISO(monthStr + '-01'), 'MMMM yyyy');
    } catch {
      return monthStr;
    }
  };

  const formatRate = (rate) => {
    const value = Number(rate);
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '0.0%';
  };

  return (
    <div className="overflow-auto max-h-96 border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="p-3 text-left font-semibold text-slate-700">Month</th>
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
                <td className="p-3 text-slate-700 font-medium">{formatMonth(row.month)}</td>
                <td className="p-3 text-right text-slate-700">{row.total_inbound}</td>
                <td className="p-3 text-right text-green-700 font-medium">{row.total_answered}</td>
                <td className="p-3 text-right text-red-700 font-medium">{row.total_missed}</td>
                <td className="p-3 text-right font-semibold text-blue-700">{formatRate(row.answer_rate)}</td>
                <td className="p-3 text-right text-slate-700">{row.benchmark_inbound}</td>
                <td className="p-3 text-right text-green-700 font-medium">{row.benchmark_answered}</td>
                <td className="p-3 text-right font-semibold text-purple-700">{formatRate(row.benchmark_answer_rate)}</td>
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