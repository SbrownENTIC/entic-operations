import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get today's date in YYYY-MM-DD format (EST timezone)
    const today = new Date().toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/');
    const todayFormatted = `${today[2]}-${today[0]}-${today[1]}`; // YYYY-MM-DD
    
    // Fetch all active reminders that should be sent today (using service role for cron job)
    const reminders = await base44.asServiceRole.entities.Reminder.filter({
      send_date: todayFormatted,
      status: 'active'
    });
    
    if (reminders.length === 0) {
      return Response.json({
        success: true,
        message: `No reminders scheduled for ${todayFormatted}`,
        sent_count: 0
      });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each reminder
    for (const reminder of reminders) {
      let emailsSent = 0;
      let emailErrors = [];
      
      try {
        // Send email to each recipient using Base44's email service
        for (const recipient of reminder.recipients) {
          try {
            console.log(`Attempting to send email to: ${recipient}`);
            
            await base44.asServiceRole.integrations.Core.SendEmail({
              from_name: 'ENTIC Operations Team',
              to: recipient,
              subject: reminder.email_subject,
              body: reminder.email_body.replace(/\n/g, '<br>') + '<br><br><br>'
            });
            
            emailsSent++;
            console.log(`Email sent successfully to: ${recipient}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${recipient}:`, emailError.message);
            emailErrors.push({
              recipient: recipient,
              error: emailError.message
            });
          }
        }
        
        // Only update reminder if at least one email was sent successfully
        if (emailsSent > 0) {
          // Calculate next send date for recurring reminders
          let nextSendDate = null;
          if (reminder.frequency !== 'once') {
            const currentDate = new Date(reminder.send_date);
            const frequencyCount = reminder.frequency_count || 1;
            
            switch (reminder.frequency) {
              case 'daily':
                currentDate.setDate(currentDate.getDate() + frequencyCount);
                break;
              case 'weekly':
                currentDate.setDate(currentDate.getDate() + (7 * frequencyCount));
                break;
              case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + frequencyCount);
                break;
              case 'quarterly':
                currentDate.setMonth(currentDate.getMonth() + (3 * frequencyCount));
                break;
              case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + frequencyCount);
                break;
            }
            
            nextSendDate = currentDate.toISOString().split('T')[0];
          }
          
          // Update reminder record
          await base44.asServiceRole.entities.Reminder.update(reminder.id, {
            last_sent_date: new Date().toISOString(),
            send_count: (reminder.send_count || 0) + 1,
            status: reminder.frequency === 'once' ? 'completed' : 'active',
            next_send_date: nextSendDate,
            ...(reminder.frequency !== 'once' && nextSendDate ? { send_date: nextSendDate } : {})
          });
          
          successCount++;
          
          if (emailErrors.length > 0) {
            errors.push({
              reminder_name: reminder.reminder_name,
              partial_success: true,
              emails_sent: emailsSent,
              emails_failed: emailErrors.length,
              email_errors: emailErrors
            });
          }
        } else {
          // No emails sent successfully
          throw new Error(`Failed to send any emails. Errors: ${JSON.stringify(emailErrors)}`);
        }
        
      } catch (error) {
        errorCount++;
        errors.push({
          reminder_name: reminder.reminder_name,
          error: error.message,
          email_errors: emailErrors.length > 0 ? emailErrors : null
        });
        console.error(`Failed to process reminder ${reminder.reminder_name}:`, error);
      }
    }
    
    return Response.json({
      success: true,
      message: `Processed ${reminders.length} reminder(s) for ${todayFormatted}`,
      sent_count: successCount,
      error_count: errorCount,
      errors: errors.length > 0 ? errors : null
    });
    
  } catch (error) {
    console.error('Error sending scheduled reminders:', error);
    return Response.json({ 
      error: error.message || 'An error occurred while sending reminders'
    }, { status: 500 });
  }
});