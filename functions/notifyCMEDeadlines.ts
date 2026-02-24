import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ADMIN_EMAIL = 'steve.brown@enticmd.com';
const CURRENT_YEAR = new Date().getFullYear();
const CME_REQUIRED_CREDITS = 3;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Fetch all providers, CME records, and waivers
        const [providers, cmeRecords, waivers] = await Promise.all([
            base44.asServiceRole.entities.Provider.filter({ status: 'active' }),
            base44.asServiceRole.entities.CME.list(),
            base44.asServiceRole.entities.CMEWaiver.list()
        ]);

        // Only doctors (MDs/DOs) need CME
        const doctors = providers.filter(p =>
            p.role && (
                p.role.toLowerCase().includes('md') ||
                p.role.toLowerCase().includes('do') ||
                p.role.toLowerCase().includes('physician') ||
                p.role.toLowerCase().includes('doctor')
            )
        );

        // Build CME credits per provider for current year
        const cmeByProvider = {};
        for (const cme of cmeRecords) {
            if (!cme.completion_date) continue;
            const year = new Date(cme.completion_date).getFullYear();
            if (year !== CURRENT_YEAR) continue;
            cmeByProvider[cme.provider_id] = (cmeByProvider[cme.provider_id] || 0) + (cme.credits || 0);
        }

        // Build waiver set
        const waivedProviderIds = new Set(
            waivers.filter(w => w.year === CURRENT_YEAR).map(w => w.provider_id)
        );

        // Find non-compliant doctors (not waived, less than required credits)
        const nonCompliant = doctors.filter(d =>
            !waivedProviderIds.has(d.id) &&
            (cmeByProvider[d.id] || 0) < CME_REQUIRED_CREDITS
        );

        if (nonCompliant.length === 0) {
            return Response.json({
                success: true,
                message: 'All doctors are CME compliant. No notifications sent.',
                emailsSent: 0
            });
        }

        // Build summary for admin
        const lines = nonCompliant.map(d => {
            const credits = cmeByProvider[d.id] || 0;
            return `  • ${d.full_name}: ${credits} / ${CME_REQUIRED_CREDITS} credits`;
        }).join('\n');

        const subject = `CME Non-Compliance Alert – ${nonCompliant.length} Doctor(s) Require Attention (${CURRENT_YEAR})`;
        const body = `Hi Steve,

The following doctor(s) are currently non-compliant with the ${CURRENT_YEAR} CME requirement of ${CME_REQUIRED_CREDITS} credits:

${lines}

Please follow up with them or mark as "Not Required" in the system if applicable.

Best,
ENTIC Operations Center`;

        await base44.asServiceRole.integrations.Core.SendEmail({
            to: ADMIN_EMAIL,
            subject,
            body
        });

        return Response.json({
            success: true,
            message: `CME non-compliance notification sent for ${nonCompliant.length} doctor(s).`,
            emailsSent: 1,
            nonCompliantDoctors: nonCompliant.map(d => d.full_name)
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});