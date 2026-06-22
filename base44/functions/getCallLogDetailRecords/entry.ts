import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH_SIZE = 5000;
const DEFAULT_LIMIT = 500;

function normalizeExtension(ext: string | null | undefined) {
  if (!ext || typeof ext !== 'string') return '';
  return String(ext).trim().replace(/[\s\-()]/g, '').replace(/\D/g, '');
}

function buildExtToUser(users) {
  const map: Record<string, { id: string }> = {};
  for (const user of users) {
    if (!user.extensions || !Array.isArray(user.extensions)) continue;
    for (const ext of user.extensions) {
      map[ext] = user;
      const normalized = normalizeExtension(ext);
      if (normalized && normalized !== ext) map[normalized] = user;
    }
  }
  return map;
}

function getFilterMeta(filterType: string) {
  const titles: Record<string, string> = {
    total: 'All Calls',
    inbound: 'Inbound Calls',
    outbound: 'Outbound Calls',
    answered: 'Answered Calls',
    missed: 'Missed Calls',
    'outbound-connected': 'Outbound Connected Calls (≥30s)',
    'overall-contacted': 'All Answered Inbound + Answered Outbound',
    'benchmark-inbound': 'Inbound Calls (Benchmark Users)',
    'frontend-inbound': 'Inbound Calls (Front Desk)',
  };
  return titles[filterType] || 'Call Records';
}

function matchesInboundFilter(
  call,
  filterType: string,
  extToUser: Record<string, { id: string }>,
  benchmarkUserIds: Set<string>,
  frontDeskUserIds: Set<string>,
) {
  switch (filterType) {
    case 'inbound':
    case 'total':
      return true;
    case 'answered':
      return Boolean(call.answered);
    case 'missed':
      return Boolean(call.missed);
    case 'overall-contacted':
      return Boolean(call.answered);
    case 'benchmark-inbound': {
      const user = extToUser[call.extension];
      return Boolean(user && benchmarkUserIds.has(user.id));
    }
    case 'frontend-inbound': {
      const user = extToUser[call.extension];
      return Boolean(user && frontDeskUserIds.has(user.id));
    }
    default:
      return false;
  }
}

function matchesOutboundFilter(call, filterType: string) {
  switch (filterType) {
    case 'outbound':
    case 'total':
      return true;
    case 'outbound-connected':
      return call.result === 'answered' && (call.duration_seconds || 0) >= 30;
    case 'overall-contacted':
      return call.result === 'answered';
    default:
      return false;
  }
}

async function countAndCollect(
  entity,
  direction: 'inbound' | 'outbound',
  filterType: string,
  extToUser,
  benchmarkUserIds,
  frontDeskUserIds,
  limit: number,
  skip: number,
) {
  let totalCount = 0;
  const records = [];
  let entitySkip = 0;

  while (true) {
    const batch = await entity.filter({}, '-updated_date', BATCH_SIZE, entitySkip);
    if (!batch?.length) break;

    for (const call of batch) {
      const matches = direction === 'inbound'
        ? matchesInboundFilter(call, filterType, extToUser, benchmarkUserIds, frontDeskUserIds)
        : matchesOutboundFilter(call, filterType);

      if (!matches) continue;

      totalCount++;
      if (totalCount > skip && records.length < limit) {
        records.push(call);
      }
    }

    entitySkip += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return { records, totalCount };
}

async function fetchFilteredRecords(
  base44,
  filterType: string,
  limit: number,
  skip: number,
) {
  const users = await base44.asServiceRole.entities.UserDirectory.list();
  const extToUser = buildExtToUser(users);
  const benchmarkUserIds = new Set(
    users.filter((u) => u.include_in_benchmark).map((u) => u.id)
  );
  const frontDeskUserIds = new Set(
    users.filter((u) => u.benchmark_group === 'Front Desk' && u.include_in_benchmark).map((u) => u.id)
  );

  const needsInbound = [
    'total', 'inbound', 'answered', 'missed', 'overall-contacted', 'benchmark-inbound', 'frontend-inbound',
  ].includes(filterType);
  const needsOutbound = [
    'total', 'outbound', 'outbound-connected', 'overall-contacted',
  ].includes(filterType);

  if (filterType === 'total') {
    const [inboundResult, outboundResult] = await Promise.all([
      countAndCollect(
        base44.asServiceRole.entities.InboundCallRaw,
        'inbound',
        'inbound',
        extToUser,
        benchmarkUserIds,
        frontDeskUserIds,
        limit,
        skip,
      ),
      countAndCollect(
        base44.asServiceRole.entities.OutboundCallRaw,
        'outbound',
        'outbound',
        extToUser,
        benchmarkUserIds,
        frontDeskUserIds,
        Math.max(0, limit - 0),
        Math.max(0, skip - 0),
      ),
    ]);

    const combined = [...inboundResult.records, ...outboundResult.records].slice(0, limit);
    return {
      records: combined,
      totalCount: inboundResult.totalCount + outboundResult.totalCount,
    };
  }

  if (needsInbound && !needsOutbound) {
    return countAndCollect(
      base44.asServiceRole.entities.InboundCallRaw,
      'inbound',
      filterType,
      extToUser,
      benchmarkUserIds,
      frontDeskUserIds,
      limit,
      skip,
    );
  }

  if (needsOutbound && !needsInbound) {
    return countAndCollect(
      base44.asServiceRole.entities.OutboundCallRaw,
      'outbound',
      filterType,
      extToUser,
      benchmarkUserIds,
      frontDeskUserIds,
      limit,
      skip,
    );
  }

  if (filterType === 'overall-contacted') {
    const [inboundResult, outboundResult] = await Promise.all([
      countAndCollect(
        base44.asServiceRole.entities.InboundCallRaw,
        'inbound',
        'overall-contacted',
        extToUser,
        benchmarkUserIds,
        frontDeskUserIds,
        limit,
        skip,
      ),
      countAndCollect(
        base44.asServiceRole.entities.OutboundCallRaw,
        'outbound',
        'overall-contacted',
        extToUser,
        benchmarkUserIds,
        frontDeskUserIds,
        limit,
        Math.max(0, skip),
      ),
    ]);

    const combined = [...inboundResult.records, ...outboundResult.records].slice(0, limit);
    return {
      records: combined,
      totalCount: inboundResult.totalCount + outboundResult.totalCount,
    };
  }

  return { records: [], totalCount: 0 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { filterType, limit = DEFAULT_LIMIT, skip = 0 } = body;

    if (!filterType) {
      return Response.json({ error: 'Missing filterType' }, { status: 400 });
    }

    const { records, totalCount } = await fetchFilteredRecords(
      base44,
      filterType,
      Math.min(Number(limit) || DEFAULT_LIMIT, DEFAULT_LIMIT),
      Number(skip) || 0,
    );

    return Response.json({
      success: true,
      filterType,
      title: getFilterMeta(filterType),
      records,
      totalCount,
    });
  } catch (error) {
    console.error('getCallLogDetailRecords failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
