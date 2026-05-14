import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { callType, filter = {}, limit = 100, offset = 0 } = body;

    if (!['inbound', 'outbound'].includes(callType)) {
      return Response.json({ error: 'Invalid callType' }, { status: 400 });
    }

    const entityName = callType === 'inbound' ? 'InboundCallRaw' : 'OutboundCallRaw';
    
    // Get total count
    const allRecords = await base44.asServiceRole.entities[entityName].filter(
      filter,
      '-call_date',
      100000
    );
    const total = allRecords.length;

    // Get paginated slice
    const records = allRecords.slice(offset, offset + limit);

    return Response.json({
      records,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});