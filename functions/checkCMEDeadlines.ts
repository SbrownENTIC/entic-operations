import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const notifyEmail = 'steve.brown@enticmd.com';
        const currentYear = new Date().getFullYear();

        // Fetch all active providers and CME records for this year
        const [providers, cmeRecords, waivers] = await Promise.all([
            base44.asServiceRole.entities.Provider.filter({ status: 'active' }),
            base44.asServiceRole.entities.CME.list(),
            base44.asServiceRole.entities.CMEWaiver.filter({ year: currentYear })
        ]);

        // Only doctors (role contains 'Doctor' or 'MD' or 'DO')
        const doctors = providers.filter(p => {
            const role = (p.role || '').toLowerCase();
            return role.includes('md') || role.includes('do') || role.includes('doctor') || role.includes('physician');
        });

        // Get waived provider IDs
        const waivedProviderIds = new Set(waivers.map(w => w.provider_id));

        // Sum CME credits per provider for current year
        const cmeByProvider = {};
        for (const cme of cmeRecords) {
            if (!cme.completion_date) continue;
            const cmeYear = new Date(cme.completion_date).getFullYear();
            if (cmeYear !== currentYear) continue;
            cmeByProvider[cme.provider_id] = (cmeByProvider[cme.provider_id] || 0) + (cme.credits || 0);
        }

        // Find non-compliant doctors (less than 3 credits, not waived)
        const nonCompliant = doctors.filter(d => 
            !waivedProviderIds.has(d.id) && (cmeByProvider[d.id] || 0) < 3
        );

        if (nonCompliant.length === 0) {
            return Response.json({
                success: true,
                message: 'All doctors are CME compliant. No notifications sent.',
                emailsSent: 0
            });
        }

        // Build a summary email for steve
        const rows = nonCompliant.map(d => {
            const credits = cmeByProvider[d.id] || 0;
            return `  - ${d.full_name}: ${credits} / 3 credits`;
        }).join('\n');

        const subject = `CME Compliance Alert: ${nonCompliant.length} Doctor(s) Need Attention (${currentYear})`;
        const body = `Hi Steve,

This is your daily CME compliance summary for ${currentYear}.

The following doctor(s) have not yet met the 3 CME credit requirement:

${rows}

Please follow up with these providers to ensure they complete their CME requirements.

Best,
ENTIC Operations Center`;

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: notifyEmail,
            subject,
            body
        });

        return Response.json({
            success: true,
            message: `CME compliance check complete. Notification sent for ${nonCompliant.length} non-compliant doctor(s).`,
            nonCompliantCount: nonCompliant.length,
            emailsSent: 1
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});