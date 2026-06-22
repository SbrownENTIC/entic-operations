import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Calculate all call metrics from raw data in a single pass per dataset.
 */
export function useCallMetrics(inbound, outbound, users) {
  return useMemo(() => {
    const extToUser = {};
    users.forEach((user) => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach((ext) => {
          extToUser[ext] = user;
        });
      }
    });

    const benchmarkUsers = users.filter((u) => u.include_in_benchmark);
    const benchmarkUserIds = new Set(benchmarkUsers.map((u) => u.id));
    const frontDeskUserIds = new Set(
      benchmarkUsers.filter((u) => u.benchmark_group === 'Front Desk').map((u) => u.id)
    );

    const totalInbound = inbound.length;
    const totalOutbound = outbound.length;
    const totalCalls = totalInbound + totalOutbound;

    let totalAnswered = 0;
    let totalMissed = 0;
    let benchmarkInboundCount = 0;
    let benchmarkAnswered = 0;
    let frontDeskInboundCount = 0;
    let frontDeskAnswered = 0;
    const unmappedInboundExts = new Set();

    for (const call of inbound) {
      if (call.answered) totalAnswered++;
      if (call.missed) totalMissed++;

      const user = extToUser[call.extension];
      if (!user) {
        unmappedInboundExts.add(call.extension);
        continue;
      }

      if (benchmarkUserIds.has(user.id)) {
        benchmarkInboundCount++;
        if (call.answered) benchmarkAnswered++;
      }

      if (frontDeskUserIds.has(user.id)) {
        frontDeskInboundCount++;
        if (call.answered) frontDeskAnswered++;
      }
    }

    let connectedOutbound = 0;
    let answeredOutbound = 0;

    for (const call of outbound) {
      if (call.result === 'answered') {
        answeredOutbound++;
        if ((call.duration_seconds || 0) >= 30) {
          connectedOutbound++;
        }
      }
    }

    const inboundAnswerRate = totalInbound === 0 ? 0 : Math.min(totalAnswered / totalInbound, 1.0);
    const outboundContactRate = totalOutbound === 0 ? 0 : Math.min(connectedOutbound / totalOutbound, 1.0);
    const totalContacted = totalAnswered + answeredOutbound;
    const overallContactRate = totalCalls === 0 ? 0 : Math.min(totalContacted / totalCalls, 1.0);
    const benchmarkAnswerRate = benchmarkInboundCount === 0
      ? 0
      : Math.min(benchmarkAnswered / benchmarkInboundCount, 1.0);
    const frontDeskAnswerRate = frontDeskInboundCount === 0
      ? 0
      : Math.min(frontDeskAnswered / frontDeskInboundCount, 1.0);

    return {
      totalCalls,
      totalInbound,
      totalOutbound,
      totalAnswered,
      totalMissed,
      inboundAnswerRate,
      connectedOutbound,
      outboundContactRate,
      totalContacted,
      overallContactRate,
      benchmarkInbound: benchmarkInboundCount,
      benchmarkAnswered,
      benchmarkAnswerRate,
      frontDeskInbound: frontDeskInboundCount,
      frontDeskAnswered,
      frontDeskAnswerRate,
      unmappedCount: unmappedInboundExts.size,
      unmappedExtensions: Array.from(unmappedInboundExts),
    };
  }, [inbound, outbound, users]);
}

/**
 * Format percentage for display (2 decimal places)
 */
export function formatPercent(num) {
  return `${(num * 100).toFixed(2)}%`;
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
