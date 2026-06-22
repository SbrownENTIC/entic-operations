import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH_SIZE = 5000;

function normalizeExtension(ext: string | null | undefined) {
  if (!ext || typeof ext !== 'string') return '';
  return String(ext).trim().replace(/[\s\-()]/g, '').replace(/\D/g, '');
}

function getWeekStart(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function getMonthStart(dateStr: string) {
  return dateStr.slice(0, 7);
}

async function fetchAllRecords(entity) {
  const allRows = [];
  let skip = 0;

  while (true) {
    const batch = await entity.filter({}, '-updated_date', BATCH_SIZE, skip);
    if (!batch?.length) break;
    allRows.push(...batch);
    skip += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return allRows;
}

function buildExtToUser(users) {
  const map: Record<string, unknown> = {};

  for (const user of users) {
    if (!user.extensions || !Array.isArray(user.extensions)) continue;
    for (const ext of user.extensions) {
      map[ext] = user;
      const normalized = normalizeExtension(ext);
      if (normalized && normalized !== ext) {
        map[normalized] = user;
      }
    }
  }

  return map;
}

function computeReport(inbound, outbound, users) {
  const extToUser = buildExtToUser(users);
  const benchmarkUserIds = new Set(
    users.filter((u) => u.include_in_benchmark).map((u) => u.id)
  );
  const frontDeskUserIds = new Set(
    users.filter((u) => u.include_in_benchmark && u.benchmark_group === 'Front Desk').map((u) => u.id)
  );

  const weekMap: Record<string, Record<string, unknown>> = {};
  const monthMap: Record<string, Record<string, unknown>> = {};
  const userMap: Record<string, Record<string, unknown>> = {};
  const answeredOutboundByUser: Record<string, number> = {};
  const unmapped: Record<string, Record<string, unknown>> = {};
  const mappedExts = new Set(Object.keys(extToUser));

  let totalAnswered = 0;
  let totalMissed = 0;
  let benchmarkInboundCount = 0;
  let benchmarkAnswered = 0;
  let frontDeskInboundCount = 0;
  let frontDeskAnswered = 0;

  for (const call of inbound) {
    if (call.answered) totalAnswered++;
    if (call.missed) totalMissed++;

    const weekKey = getWeekStart(call.call_date);
    const monthKey = getMonthStart(call.call_date);
    const normalizedExt = normalizeExtension(call.extension);
    const user = (extToUser[normalizedExt] || extToUser[call.extension]) as { id: string } | undefined;
    const isBenchmark = Boolean(user && benchmarkUserIds.has(user.id));

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        week_start: weekKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0,
        total_outbound: 0,
        outbound_connected: 0,
      };
    }
    weekMap[weekKey].total_inbound = (weekMap[weekKey].total_inbound as number) + 1;
    if (call.answered) weekMap[weekKey].total_answered = (weekMap[weekKey].total_answered as number) + 1;
    if (call.missed) weekMap[weekKey].total_missed = (weekMap[weekKey].total_missed as number) + 1;
    if (isBenchmark) {
      weekMap[weekKey].benchmark_inbound = (weekMap[weekKey].benchmark_inbound as number) + 1;
      if (call.answered) weekMap[weekKey].benchmark_answered = (weekMap[weekKey].benchmark_answered as number) + 1;
    }

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0,
      };
    }
    monthMap[monthKey].total_inbound = (monthMap[monthKey].total_inbound as number) + 1;
    if (call.answered) monthMap[monthKey].total_answered = (monthMap[monthKey].total_answered as number) + 1;
    if (call.missed) monthMap[monthKey].total_missed = (monthMap[monthKey].total_missed as number) + 1;
    if (isBenchmark) {
      monthMap[monthKey].benchmark_inbound = (monthMap[monthKey].benchmark_inbound as number) + 1;
      if (call.answered) monthMap[monthKey].benchmark_answered = (monthMap[monthKey].benchmark_answered as number) + 1;
    }

    if (user) {
      const userId = user.id;
      if (!userMap[userId]) {
        const fullUser = (extToUser[normalizedExt] || extToUser[call.extension]) as {
          id: string;
          name: string;
          benchmark_group: string;
          include_in_benchmark: boolean;
        };
        userMap[userId] = {
          user_id: userId,
          user_name: fullUser.name,
          benchmark_group: fullUser.benchmark_group,
          include_in_benchmark: fullUser.include_in_benchmark,
          total_inbound: 0,
          total_answered: 0,
          total_missed: 0,
          total_duration_seconds: 0,
          total_outbound: 0,
          outbound_connected: 0,
        };
      }
      userMap[userId].total_inbound = (userMap[userId].total_inbound as number) + 1;
      if (call.answered) userMap[userId].total_answered = (userMap[userId].total_answered as number) + 1;
      if (call.missed) userMap[userId].total_missed = (userMap[userId].total_missed as number) + 1;
      userMap[userId].total_duration_seconds =
        (userMap[userId].total_duration_seconds as number) + (call.duration_seconds || 0);

      if (benchmarkUserIds.has(userId)) {
        benchmarkInboundCount++;
        if (call.answered) benchmarkAnswered++;
      }
      if (frontDeskUserIds.has(userId)) {
        frontDeskInboundCount++;
        if (call.answered) frontDeskAnswered++;
      }
    } else if (call.extension) {
      if (!mappedExts.has(call.extension)) {
        if (!unmapped[call.extension]) {
          unmapped[call.extension] = {
            extension: call.extension,
            inbound: 0,
            outbound: 0,
            firstSeen: call.call_date,
            lastSeen: call.call_date,
          };
        }
        unmapped[call.extension].inbound = (unmapped[call.extension].inbound as number) + 1;
        if (call.call_date < unmapped[call.extension].firstSeen) {
          unmapped[call.extension].firstSeen = call.call_date;
        }
        if (call.call_date > unmapped[call.extension].lastSeen) {
          unmapped[call.extension].lastSeen = call.call_date;
        }
      }
    }
  }

  let connectedOutbound = 0;
  let answeredOutbound = 0;

  for (const call of outbound) {
    const weekKey = getWeekStart(call.call_date);
    const normalizedExt = normalizeExtension(call.extension);
    const user = (extToUser[normalizedExt] || extToUser[call.extension]) as { id: string } | undefined;
    const isBenchmark = Boolean(user && benchmarkUserIds.has(user.id));
    const isConnected = call.result === 'answered' && (call.duration_seconds || 0) >= 30;

    if (!weekMap[weekKey]) {
      weekMap[weekKey] = {
        week_start: weekKey,
        total_inbound: 0,
        total_answered: 0,
        total_missed: 0,
        benchmark_inbound: 0,
        benchmark_answered: 0,
        total_outbound: 0,
        outbound_connected: 0,
      };
    }
    weekMap[weekKey].total_outbound = (weekMap[weekKey].total_outbound as number) + 1;
    if (isConnected) weekMap[weekKey].outbound_connected = (weekMap[weekKey].outbound_connected as number) + 1;

    if (call.result === 'answered') {
      answeredOutbound++;
      if ((call.duration_seconds || 0) >= 30) connectedOutbound++;
    }

    if (user) {
      const userId = user.id;
      if (!userMap[userId]) {
        const fullUser = (extToUser[normalizedExt] || extToUser[call.extension]) as {
          id: string;
          name: string;
          benchmark_group: string;
          include_in_benchmark: boolean;
        };
        userMap[userId] = {
          user_id: userId,
          user_name: fullUser.name,
          benchmark_group: fullUser.benchmark_group,
          include_in_benchmark: fullUser.include_in_benchmark,
          total_inbound: 0,
          total_answered: 0,
          total_missed: 0,
          total_duration_seconds: 0,
          total_outbound: 0,
          outbound_connected: 0,
        };
      }
      userMap[userId].total_outbound = (userMap[userId].total_outbound as number) + 1;
      if (isConnected) userMap[userId].outbound_connected = (userMap[userId].outbound_connected as number) + 1;
      userMap[userId].total_duration_seconds =
        (userMap[userId].total_duration_seconds as number) + (call.duration_seconds || 0);

      if (call.result === 'answered') {
        answeredOutboundByUser[userId] = (answeredOutboundByUser[userId] || 0) + 1;
      }
    } else if (call.extension && !mappedExts.has(call.extension)) {
      if (!unmapped[call.extension]) {
        unmapped[call.extension] = {
          extension: call.extension,
          inbound: 0,
          outbound: 0,
          firstSeen: call.call_date,
          lastSeen: call.call_date,
        };
      }
      unmapped[call.extension].outbound = (unmapped[call.extension].outbound as number) + 1;
      if (call.call_date < unmapped[call.extension].firstSeen) {
        unmapped[call.extension].firstSeen = call.call_date;
      }
      if (call.call_date > unmapped[call.extension].lastSeen) {
        unmapped[call.extension].lastSeen = call.call_date;
      }
    }
  }

  const totalInbound = inbound.length;
  const totalOutbound = outbound.length;
  const totalCalls = totalInbound + totalOutbound;

  const weeklyData = Object.values(weekMap).map((week) => ({
    ...week,
    answer_rate: (week.total_inbound as number) === 0
      ? 0
      : Math.min((week.total_answered as number) / (week.total_inbound as number), 1.0),
    benchmark_answer_rate: (week.benchmark_inbound as number) === 0
      ? 0
      : Math.min((week.benchmark_answered as number) / (week.benchmark_inbound as number), 1.0),
  }));

  const monthlyData = Object.values(monthMap)
    .map((month) => ({
      ...month,
      answer_rate: (month.total_inbound as number) === 0
        ? 0
        : Math.min((month.total_answered as number) / (month.total_inbound as number), 1.0),
      benchmark_answer_rate: (month.benchmark_inbound as number) === 0
        ? 0
        : Math.min((month.benchmark_answered as number) / (month.benchmark_inbound as number), 1.0),
    }))
    .sort((a, b) => String(b.month).localeCompare(String(a.month)));

  const individualData = Object.values(userMap).map((user) => {
    const totalInboundForUser = user.total_inbound as number;
    const totalOutboundForUser = user.total_outbound as number;
    const totalCallsForUser = totalInboundForUser + totalOutboundForUser;
    const allAnsweredOutbound = answeredOutboundByUser[user.user_id as string] || 0;
    const totalContacted = (user.total_answered as number) + allAnsweredOutbound;

    return {
      ...user,
      answer_rate: totalInboundForUser === 0
        ? 0
        : Math.min((user.total_answered as number) / totalInboundForUser, 1.0),
      avg_duration_seconds: totalInboundForUser === 0
        ? 0
        : Math.round((user.total_duration_seconds as number) / totalInboundForUser),
      outbound_contact_rate: totalOutboundForUser === 0
        ? 0
        : Math.min((user.outbound_connected as number) / totalOutboundForUser, 1.0),
      overall_contact_rate: totalCallsForUser === 0
        ? 0
        : Math.min(totalContacted / totalCallsForUser, 1.0),
    };
  });

  const unmappedInboundExts = new Set(
    Object.keys(unmapped).filter((ext) => (unmapped[ext].inbound as number) > 0)
  );

  const metrics = {
    totalCalls,
    totalInbound,
    totalOutbound,
    totalAnswered,
    totalMissed,
    inboundAnswerRate: totalInbound === 0 ? 0 : Math.min(totalAnswered / totalInbound, 1.0),
    connectedOutbound,
    outboundContactRate: totalOutbound === 0 ? 0 : Math.min(connectedOutbound / totalOutbound, 1.0),
    totalContacted: totalAnswered + answeredOutbound,
    overallContactRate: totalCalls === 0 ? 0 : Math.min((totalAnswered + answeredOutbound) / totalCalls, 1.0),
    benchmarkInbound: benchmarkInboundCount,
    benchmarkAnswered,
    benchmarkAnswerRate: benchmarkInboundCount === 0
      ? 0
      : Math.min(benchmarkAnswered / benchmarkInboundCount, 1.0),
    frontDeskInbound: frontDeskInboundCount,
    frontDeskAnswered,
    frontDeskAnswerRate: frontDeskInboundCount === 0
      ? 0
      : Math.min(frontDeskAnswered / frontDeskInboundCount, 1.0),
    unmappedCount: unmappedInboundExts.size,
    unmappedExtensions: Array.from(unmappedInboundExts),
  };

  const unmappedData = Object.values(unmapped).sort(
    (a, b) => (b.inbound as number) - (a.inbound as number)
  );

  return {
    metrics,
    weeklyData,
    monthlyData,
    individualData,
    users,
    unmappedData,
    inboundCount: totalInbound,
    outboundCount: totalOutbound,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [inbound, outbound, users] = await Promise.all([
      fetchAllRecords(base44.asServiceRole.entities.InboundCallRaw),
      fetchAllRecords(base44.asServiceRole.entities.OutboundCallRaw),
      base44.asServiceRole.entities.UserDirectory.list(),
    ]);

    const report = computeReport(inbound, outbound, users);

    return Response.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('getCallLogReportBundle failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
