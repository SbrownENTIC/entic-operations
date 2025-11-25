import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.8';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const { to, subject, body, from_name } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ 
        error: 'Missing required fields: to, subject, body' 
      }, { status: 400 });
    }

    // Get SMTP credentials from environment
    const smtpHost = Deno.env.get('MAILGUN_SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('MAILGUN_SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('MAILGUN_SMTP_USER');
    const smtpPassword = Deno.env.get('MAILGUN_SMTP_PASSWORD');
    const fromEmail = Deno.env.get('MAILGUN_FROM_EMAIL');

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      return Response.json({ 
        error: 'SMTP not configured. Please set MAILGUN_SMTP_HOST, MAILGUN_SMTP_USER, MAILGUN_SMTP_PASSWORD, and MAILGUN_FROM_EMAIL environment variables.' 
      }, { status: 500 });
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // true for 465, false for other ports like 587
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    });

    // Prepare from field
    const fromField = from_name ? `${from_name} <${fromEmail}>` : fromEmail;

    // Send email via SMTP
    const info = await transporter.sendMail({
      from: fromField,
      to: to,
      subject: subject,
      html: body.replace(/\n/g, '<br>')
    });
    
    return Response.json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ 
      error: error.message || 'An error occurred while sending email'
    }, { status: 500 });
  }
});