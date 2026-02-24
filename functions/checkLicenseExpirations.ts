import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const notifyEmail = 'steve.brown@enticmd.com';

        const licenses = await base44.asServiceRole.entities.License.list();
        const providers = await base44.asServiceRole.entities.Provider.list();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const results = { sent7: [], sent14: [], sent30: [], skipped: 0 };

        for (const license of licenses) {
            if (!license.expiration_date) { results.skipped++; continue; }

            const exp = new Date(license.expiration_date);
            exp.setHours(0, 0, 0, 0);
            const daysUntil = Math.round((exp - today) / (1000 * 60 * 60 * 24));

            const provider = providers.find(p => p.id === license.provider_id);
            const providerName = provider?.full_name || 'Unknown Provider';
            const licenseType = license.license_type || 'License';

            const expFormatted = exp.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            if (daysUntil === 30 && !license.reminder_30_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: notifyEmail,
                    subject: `License Expiring in 30 Days: ${providerName} - ${licenseType}`,
                    body: `Hi Steve,

This is a 30-day advance notice that the following license is expiring soon:

  Provider: ${providerName}
  License Type: ${licenseType}
  Expiration Date: ${expFormatted}
  Days Remaining: 30

Please follow up with the provider to begin the renewal process.

Best,
ENTIC Operations Center`
                });
                await base44.asServiceRole.entities.License.update(license.id, { reminder_30_sent: true });
                results.sent30.push(`${providerName} - ${licenseType}`);
            }

            if (daysUntil === 14 && !license.reminder_14_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: notifyEmail,
                    subject: `License Expiring in 14 Days: ${providerName} - ${licenseType}`,
                    body: `Hi Steve,

This is a 14-day notice that the following license is expiring soon:

  Provider: ${providerName}
  License Type: ${licenseType}
  Expiration Date: ${expFormatted}
  Days Remaining: 14

If renewal hasn't started yet, please follow up with the provider immediately.

Best,
ENTIC Operations Center`
                });
                await base44.asServiceRole.entities.License.update(license.id, { reminder_14_sent: true });
                results.sent14.push(`${providerName} - ${licenseType}`);
            }

            if (daysUntil === 7 && !license.reminder_7_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: notifyEmail,
                    subject: `URGENT: License Expiring in 7 Days: ${providerName} - ${licenseType}`,
                    body: `Hi Steve,

URGENT: The following license expires in just 7 days:

  Provider: ${providerName}
  License Type: ${licenseType}
  Expiration Date: ${expFormatted}
  Days Remaining: 7

Immediate action is required to avoid a lapse in compliance.

Best,
ENTIC Operations Center`
                });
                await base44.asServiceRole.entities.License.update(license.id, { reminder_7_sent: true });
                results.sent7.push(`${providerName} - ${licenseType}`);
            }
        }

        const totalSent = results.sent7.length + results.sent14.length + results.sent30.length;

        return Response.json({
            success: true,
            message: `License expiration check complete. ${totalSent} reminder email(s) sent.`,
            emailsSent: totalSent,
            results
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});