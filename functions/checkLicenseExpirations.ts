import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all licenses and providers
        const licenses = await base44.asServiceRole.entities.License.list();
        const providers = await base44.asServiceRole.entities.Provider.list();
        
        const today = new Date();
        let emailsSent = 0;
        
        for (const license of licenses) {
            const expirationDate = new Date(license.expiration_date);
            const daysUntil = Math.floor((expirationDate - today) / (1000 * 60 * 60 * 24));
            const provider = providers.find(p => p.id === license.provider_id);
            
            if (!provider || !provider.email) continue;
            
            const expirationDateFormatted = expirationDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            // Send 30-day reminder
            if (daysUntil === 30 && !license.reminder_30_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: provider.email,
                    subject: `Automatic Reminder: Your ${license.license_type} expires on ${expirationDateFormatted}`,
                    body: `Hi ${provider.full_name},\n\nJust a quick reminder that your ${license.license_type} is set to expire on ${expirationDateFormatted}\n\nPlease make sure to begin any necessary renewal steps. If you've already taken care of this, please send us a copy of the renewed license to us to have on file for compliance.\n\nBest,\n\nSteve Brown\n\nThe Operations Team`
                });
                
                await base44.asServiceRole.entities.License.update(license.id, { 
                    reminder_30_sent: true 
                });
                
                emailsSent++;
            }
            
            // Send 14-day reminder
            if (daysUntil === 14 && !license.reminder_14_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: provider.email,
                    subject: `Automatic Reminder Action Needed: Your ${license.license_type} is set to expire on ${expirationDateFormatted}`,
                    body: `Hi ${provider.full_name},\n\nWe wanted to let you know that your ${license.license_type} is set to expire on ${expirationDateFormatted}, which is coming up in just two weeks!\n\nIf you haven't started the renewal process, now's the time! If you've already submitted your renewal, please send us a copy so we can keep everything up to date for compliance.\n\nBest,\n\nSteve Brown\n\nThe Operations Team`
                });
                
                await base44.asServiceRole.entities.License.update(license.id, { 
                    reminder_14_sent: true 
                });
                
                emailsSent++;
            }
            
            // Send 7-day reminder
            if (daysUntil === 7 && !license.reminder_7_sent) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: provider.email,
                    subject: `Automatic Notification Urgent Action Needed: Your ${license.license_type} expires on ${expirationDateFormatted}`,
                    body: `Hi ${provider.full_name},\n\nThis is an urgent reminder that your ${license.license_type} will expire on ${expirationDateFormatted}- just one week away!\n\nIf you haven't completed your renewal, please do so as soon as possible to avoid any interruption in compliance. If you have already renewed, please reply with a copy so we can have it on file for compliance purposes.\n\nBest,\n\nSteve Brown\n\nThe Operations Team`
                });
                
                await base44.asServiceRole.entities.License.update(license.id, { 
                    reminder_7_sent: true 
                });
                
                emailsSent++;
            }
        }
        
        return Response.json({ 
            success: true, 
            message: `License expiration check complete. ${emailsSent} reminder email(s) sent.`,
            emailsSent 
        });
        
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});