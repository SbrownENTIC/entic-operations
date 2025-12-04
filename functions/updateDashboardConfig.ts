import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify authentication
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Get data from request
        const { dashboard_config } = await req.json();

        // Update the user entity directly using their ID with service role
        // This bypasses strict RLS policies that might prevent users from updating their own record via standard API
        await base44.asServiceRole.entities.User.update(user.id, { dashboard_config });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error updating dashboard config:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});