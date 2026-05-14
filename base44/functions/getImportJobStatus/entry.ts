import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { importJobId } = body;

    if (!importJobId) {
      return Response.json({ error: 'Missing importJobId' }, { status: 400 });
    }

    // Use service role to fetch job details
    const job = await base44.asServiceRole.entities.ImportJob.get(importJobId);
    
    if (!job) {
      return Response.json({ error: 'ImportJob not found' }, { status: 404 });
    }

    return Response.json({
      id: job.id,
      type: job.type,
      total_rows: job.total_rows,
      processed_rows: job.processed_rows,
      status: job.status,
      error_message: job.error_message
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});