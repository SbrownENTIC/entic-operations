import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ADMIN_EMAIL = 'steve.brown@enticmd.com';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Fetch pending time off requests and providers
        const [pendingRequests, providers] = await Promise.all([
            base44.asServiceRole.entities.ProviderTimeOff.filter({ status: 'pending' }),
            base44.asServiceRole.entities.Provider.list()
        ]);

        if (pendingRequests.length === 0) {
            return Response.json({
                success: true,
                message: 'No pending time off requests. No notification sent.',
                emailsSent: 0
            });
        }

        const formatDate = (d) => {
            if (!d) return '—';
            return new Date(d).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                timeZone: 'America/New_York'
            });
        };

        const typeLabel = (type) => {
            const labels = { time_off: 'Time Off', cme: 'CME', partial_day: 'Partial Day', holiday: 'Holiday' };
            return labels[type] || type;
        };

        const lines = pendingRequests.map(req => {
            const provider = providers.find(p => p.id === req.provider_id);
            const name = provider?.full_name || 'Unknown Provider';
            const dateRange = req.start_date === req.end_date
                ? formatDate(req.start_date)
                : `${formatDate(req.start_date)} – ${formatDate(req.end_date)}`;
            return `  • ${name} | ${typeLabel(req.type)} | ${dateRange}${req.reason ? ` | "${req.reason}"` : ''}`;
        }).join('\n');

        const subject = `Pending Time Off Requests – ${pendingRequests.length} Awaiting Approval`;
        const body = `Hi Steve,

The following time off / CME requests are currently pending approval:

${lines}

Please log in to the ENTIC Operations Center to review and approve or decline these requests.

Best,
ENTIC Operations Center`;

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: ADMIN_EMAIL,
            subject,
            body
        });

        return Response.json({
            success: true,
            message: `Pending time off notification sent for ${pendingRequests.length} request(s).`,
            emailsSent: 1,
            pendingCount: pendingRequests.length
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});