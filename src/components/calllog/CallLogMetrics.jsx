import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Calculate all call metrics from raw data
 */
export function useCallMetrics(inbound, outbound, users, extensions) {
  return useMemo(() => {
    // Build extension to user map
    const extToUser = {};
    extensions.forEach(ext => {
      if (ext.user_id) {
        const user = users.find(u => u.id === ext.user_id);
        if (user) {
          extToUser[ext.extension] = user;
        }
      }
    });

    // Filter to benchmark users only
    const benchmarkUsers = users.filter(u => u.include_in_benchmark);
    const benchmarkUserIds = new Set(benchmarkUsers.map(u => u.id));

    // Filter to front desk benchmark users
    const frontDeskUsers = benchmarkUsers.filter(u => u.benchmark_group === 'Front Desk');
    const frontDeskUserIds = new Set(frontDeskUsers.map(u => u.id));

    // Calculate totals (all data)
    const totalInbound = inbound.length;
    const totalOutbound = outbound.length;
    const totalCalls = totalInbound + totalOutbound;

    // Calculate answered/missed (all inbound)
    const totalAnswered = inbound.filter(c => c.answered).length;
    const totalMissed = inbound.filter(c => c.missed).length;

    // Inbound answer rate (all data, capped at 1.0)
    const inboundAnswerRate = totalInbound === 0 ? 0 : Math.min(totalAnswered / totalInbound, 1.0);

    // Benchmark-only metrics
    const benchmarkInbound = inbound.filter(c => {
      const user = extToUser[c.extension];
      return user && benchmarkUserIds.has(user.id);
    });
    const benchmarkAnswered = benchmarkInbound.filter(c => c.answered).length;
    const benchmarkAnswerRate = benchmarkInbound.length === 0 ? 0 : 
      Math.min(benchmarkAnswered / benchmarkInbound.length, 1.0);

    // Front-End (Front Desk) metrics
    const frontDeskInbound = inbound.filter(c => {
      const user = extToUser[c.extension];
      return user && frontDeskUserIds.has(user.id);
    });
    const frontDeskAnswered = frontDeskInbound.filter(c => c.answered).length;
    const frontDeskAnswerRate = frontDeskInbound.length === 0 ? 0 :
      Math.min(frontDeskAnswered / frontDeskInbound.length, 1.0);

    // Unmapped extensions
    const mappedExtensions = new Set(Object.keys(extToUser));
    const unmappedInboundExts = new Set(
      inbound.filter(c => !mappedExtensions.has(c.extension)).map(c => c.extension)
    );
    const unmappedCount = unmappedInboundExts.size;

    return {
      totalCalls,
      totalInbound,
      totalOutbound,
      totalAnswered,
      totalMissed,
      inboundAnswerRate,
      benchmarkInbound: benchmarkInbound.length,
      benchmarkAnswered,
      benchmarkAnswerRate,
      frontDeskInbound: frontDeskInbound.length,
      frontDeskAnswered,
      frontDeskAnswerRate,
      unmappedCount,
      unmappedExtensions: Array.from(unmappedInboundExts)
    };
  }, [inbound, outbound, users, extensions]);
}

/**
 * Format percentage for display
 */
export function formatPercent(num) {
  return `${(num * 100).toFixed(1)}%`;
}

/**
 * KPI Card component
 */
export function KPICard({ title, value, subtitle, onClick, variant = 'default' }) {
  const bgColor = variant === 'rate' ? 'bg-purple-50' : variant === 'missed' ? 'bg-red-50' : 'bg-blue-50';
  const textColor = variant === 'rate' ? 'text-purple-700' : variant === 'missed' ? 'text-red-700' : 'text-blue-700';

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${onClick ? 'hover:scale-105' : ''} ${bgColor}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className={`text-3xl font-bold ${textColor} mt-2`}>{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}