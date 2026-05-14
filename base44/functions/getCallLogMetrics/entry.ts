import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, benchmarkOnly = false } = body;

    // Fetch user directory for benchmark filtering
    const users = await base44.asServiceRole.entities.UserDirectory.list('-updated_date', 10000);
    const benchmarkUserIds = new Set();
    const extToUser = {};

    users.forEach(u => {
      if (u.extensions && Array.isArray(u.extensions)) {
        u.extensions.forEach(ext => {
          extToUser[ext] = u;
        });
      }
      if (u.include_in_benchmark) {
        benchmarkUserIds.add(u.id);
      }
    });

    // Fetch all inbound calls in date range
    const inboundCalls = await base44.asServiceRole.entities.InboundCallRaw.filter(
      { call_date: { $gte: startDate, $lte: endDate } },
      '-call_date',
      10000
    );

    // Fetch all outbound calls in date range
    const outboundCalls = await base44.asServiceRole.entities.OutboundCallRaw.filter(
      { call_date: { $gte: startDate, $lte: endDate } },
      '-call_date',
      10000
    );

    // Calculate metrics
    const totalInbound = inboundCalls.length;
    const totalOutbound = outboundCalls.length;
    const totalCalls = totalInbound + totalOutbound;

    // Inbound metrics
    const totalAnswered = inboundCalls.filter(c => c.answered).length;
    const totalMissed = inboundCalls.filter(c => c.missed).length;
    const inboundAnswerRate = totalInbound === 0 ? 0 : Math.min(totalAnswered / totalInbound, 1.0);

    // Outbound metrics (only result = "answered")
    const connectedOutbound = outboundCalls.filter(c => c.result === 'answered').length;
    const outboundAnswerRate = totalOutbound === 0 ? 0 : Math.min(connectedOutbound / totalOutbound, 1.0);

    // Benchmark metrics
    let benchmarkInbound = 0;
    let benchmarkAnswered = 0;
    let benchmarkOutbound = 0;
    let benchmarkConnected = 0;

    if (benchmarkOnly || benchmarkUserIds.size > 0) {
      benchmarkInbound = inboundCalls.filter(c => {
        const user = extToUser[c.extension];
        return user && benchmarkUserIds.has(user.id);
      }).length;

      benchmarkAnswered = inboundCalls.filter(c => {
        const user = extToUser[c.extension];
        return c.answered && user && benchmarkUserIds.has(user.id);
      }).length;

      benchmarkOutbound = outboundCalls.filter(c => {
        const user = extToUser[c.extension];
        return user && benchmarkUserIds.has(user.id);
      }).length;

      benchmarkConnected = outboundCalls.filter(c => {
        const user = extToUser[c.extension];
        return c.result === 'answered' && user && benchmarkUserIds.has(user.id);
      }).length;
    }

    const benchmarkAnswerRate = benchmarkInbound === 0 ? 0 : Math.min(benchmarkAnswered / benchmarkInbound, 1.0);
    const benchmarkOutboundAnswerRate = benchmarkOutbound === 0 ? 0 : Math.min(benchmarkConnected / benchmarkOutbound, 1.0);

    return Response.json({
      totalCalls,
      inbound: totalInbound,
      outbound: totalOutbound,
      answered: totalAnswered,
      missed: totalMissed,
      connectedOutbound,
      inboundAnswerRate,
      outboundAnswerRate,
      benchmarkInbound,
      benchmarkAnswered,
      benchmarkAnswerRate,
      benchmarkOutbound,
      benchmarkConnected,
      benchmarkOutboundAnswerRate
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});