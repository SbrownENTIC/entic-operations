import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import nodemailer from 'npm:nodemailer@6.9.8';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Allow both authenticated users and service role calls
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const { invoiceId, pdfUrl } = await req.json();

    if (!invoiceId || !pdfUrl) {
      return Response.json({ 
        error: 'Missing required fields: invoiceId, pdfUrl' 
      }, { status: 400 });
    }

    // Get Invoice Data
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoiceId);
    if (!invoice) {
        return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch outside income records linked to this invoice to get provider details
    const outsideIncomes = await base44.asServiceRole.entities.OutsideIncome.filter({
        invoice_id: invoice.id
    });

    // Get unique provider IDs and then fetch provider details
    const providerIds = [...new Set(outsideIncomes.map(inc => inc.provider_id))];
    const providers = await Promise.all(
        providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    const invoiceMonth = invoice.month || 'the invoice period';
    const providerList = providers.map(p => `• ${p.full_name}`).join('\n');

    const subject = `UConn ${invoiceMonth} Invoices`;
    
    const body = `
Hi Allyson,

The ${invoiceMonth} clinic session details for you to process and enter for:

${providerList}

You can view the invoice here: ${pdfUrl}

Thank you so much, and hope your week is off to a fantastic start.

Steve Brown
Operations Manager
    `;

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
      secure: false, 
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    });

    // Send email via SMTP
    const info = await transporter.sendMail({
      from: `Steve Brown <${fromEmail}>`,
      to: 'amoffo@uchc.edu',
      cc: 'steve.brown@enticmd.com, Heldridge@enticmd.com',
      subject: subject,
      text: body
    });
    
    return Response.json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending UConn invoice email:', error);
    return Response.json({ 
      error: error.message || 'An error occurred while sending email'
    }, { status: 500 });
  }
});