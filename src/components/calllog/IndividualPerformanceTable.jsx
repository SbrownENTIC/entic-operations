import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export default function IndividualPerformanceTable({ data = [], showOutbound = true, defaultSort = 'total_inbound' }) {
  const [sortColumn, setSortColumn] = useState(defaultSort);
  const [sortDirection, setSortDirection] = useState('desc');

  const sortableColumns = [
    'total_inbound',
    'total_answered',
    'total_missed',
    'answer_rate',
    ...(showOutbound ? [
      'total_outbound',
      'outbound_connected',
      'outbound_contact_rate',
      'overall_contact_rate',
      'avg_duration_seconds'
    ] : [])
  ];

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortColumn] || 0;
      let bVal = b[sortColumn] || 0;

      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? result : -result;
    });

    return sorted;
  }, [data, sortColumn, sortDirection]);

  const totals = useMemo(() => {
    if (data.length === 0) return null;

    const totalInbound = data.reduce((sum, row) => sum + (row.total_inbound || 0), 0);
    const totalAnswered = data.reduce((sum, row) => sum + (row.total_answered || 0), 0);
    const totalMissed = data.reduce((sum, row) => sum + (row.total_missed || 0), 0);
    const inboundAnswerRate = totalInbound > 0 ? totalAnswered / totalInbound : 0;
    const totalOutbound = data.reduce((sum, row) => sum + (row.total_outbound || 0), 0);
    const totalOutboundConnected = data.reduce((sum, row) => sum + (row.outbound_connected || 0), 0);
    const outboundContactRate = totalOutbound > 0 ? totalOutboundConnected / totalOutbound : 0;
    
    // Overall contact rate (answered inbound + ALL answered outbound, not just ≥30s)
    // Note: data rows have overall_contact_rate already calculated per user
    // For the total, we need to calculate from scratch using the individual rates
    const totalCalls = totalInbound + totalOutbound;
    // Sum the total contacted from each row's overall_contact_rate would be circular
    // Instead, calculate: sum(answered inbound) + sum(total outbound where result=answered)
    // But we don't have that breakdown here - use the weighted calculation from individual rows
    const overallContactRateWeighted = totalCalls > 0 
      ? data.reduce((sum, row) => sum + (row.overall_contact_rate * (row.total_inbound + row.total_outbound)), 0) / totalCalls
      : 0;
    
    // Weighted average duration
    let totalDurationSeconds = 0;
    let countWithDuration = 0;
    data.forEach(row => {
      if (row.avg_duration_seconds && row.total_inbound > 0) {
        totalDurationSeconds += row.avg_duration_seconds * row.total_inbound;
        countWithDuration += row.total_inbound;
      }
    });
    const avgDurationSeconds = countWithDuration > 0 ? totalDurationSeconds / countWithDuration : 0;
    const avgDurationMinutes = (avgDurationSeconds / 60).toFixed(2);

    return {
      totalInbound,
      totalAnswered,
      totalMissed,
      inboundAnswerRate,
      totalOutbound,
      totalOutboundConnected,
      outboundContactRate,
      overallContactRate: overallContactRateWeighted,
      avgDurationMinutes
    };
  }, [data]);

  const colCount = showOutbound ? 13 : 7;
  const SortIcon = ({ column }) => {
    if (sortColumn === column) {
      return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
    }
    return <ArrowUpDown className="w-4 h-4 opacity-40" />;
  };

  const SortHeader = ({ label, column }) => (
    <th
      className={`p-3 text-right font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors ${
        sortableColumns.includes(column) ? '' : 'cursor-default hover:bg-slate-100'
      }`}
      onClick={() => sortableColumns.includes(column) && handleSort(column)}
    >
      <div className="flex items-center justify-end gap-2">
        {label}
        {sortableColumns.includes(column) && <SortIcon column={column} />}
      </div>
    </th>
  );

  return (
    <div className="overflow-auto max-h-96 border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="p-3 text-left font-semibold text-slate-700">User</th>
            <th className="p-3 text-left font-semibold text-slate-700">Group</th>
            <th className="p-3 text-center font-semibold text-slate-700">Benchmark</th>
            <SortHeader label="Inbound" column="total_inbound" />
            <SortHeader label="Answered" column="total_answered" />
            <SortHeader label="Missed" column="total_missed" />
            <SortHeader label="Answer Rate" column="answer_rate" />
            {showOutbound && (
              <>
                <SortHeader label="Outbound Attempts" column="total_outbound" />
                <SortHeader label="Outbound Connected" column="outbound_connected" />
                <SortHeader label="Outbound Contact Rate" column="outbound_contact_rate" />
                <SortHeader label="Overall Contact Rate" column="overall_contact_rate" />
                <SortHeader label="Avg Duration (Minutes)" column="avg_duration_seconds" />
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedData.length > 0 ? (
            <>
              {sortedData.map((row, i) => (
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
                      <td className="p-3 text-right text-green-700 font-medium">{row.outbound_connected || 0}</td>
                      <td className="p-3 text-right font-semibold text-purple-700">
                        {row.total_outbound > 0 ? (row.outbound_contact_rate * 100).toFixed(2) : '0'}%
                      </td>
                      <td className="p-3 text-right font-semibold text-indigo-700">
                        {((row.total_inbound + row.total_outbound) > 0 ? (row.overall_contact_rate * 100).toFixed(2) : '0')}%
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {(row.avg_duration_seconds / 60).toFixed(2)} min
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {totals && (
                <tr className="bg-slate-200 border-t border-b border-slate-300 font-bold sticky bottom-0">
                  <td className="p-3 text-slate-900">TOTAL</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right text-slate-900">{totals.totalInbound}</td>
                  <td className="p-3 text-right text-green-800">{totals.totalAnswered}</td>
                  <td className="p-3 text-right text-red-800">{totals.totalMissed}</td>
                  <td className="p-3 text-right text-blue-900">{(totals.inboundAnswerRate * 100).toFixed(2)}%</td>
                  {showOutbound && (
                    <>
                      <td className="p-3 text-right text-slate-900">{totals.totalOutbound}</td>
                      <td className="p-3 text-right text-green-800">{totals.totalOutboundConnected}</td>
                      <td className="p-3 text-right text-purple-900">{(totals.outboundContactRate * 100).toFixed(2)}%</td>
                      <td className="p-3 text-right text-indigo-900">{(totals.overallContactRate * 100).toFixed(2)}%</td>
                      <td className="p-3 text-right text-slate-900">{totals.avgDurationMinutes} min</td>
                    </>
                  )}
                </tr>
              )}
            </>
          ) : (
            <tr>
              <td colSpan={colCount} className="p-8 text-center text-slate-500">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}