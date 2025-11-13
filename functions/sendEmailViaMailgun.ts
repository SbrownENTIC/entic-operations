import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Get Mailgun credentials from environment
    const apiKey = Deno.env.get('MAILGUN_API_KEY');
    const domain = Deno.env.get('MAILGUN_DOMAIN');
    const fromEmail = Deno.env.get('MAILGUN_FROM_EMAIL');

    if (!apiKey || !domain || !fromEmail) {
      return Response.json({ 
        error: 'Mailgun not configured. Please set MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL environment variables.' 
      }, { status: 500 });
    }

    // Prepare from field
    const fromField = from_name ? `${from_name} <${fromEmail}>` : fromEmail;

    // Send email via Mailgun API
    const mailgunUrl = `https://api.mailgun.net/v3/${domain}/messages`;
    
    const formData = new FormData();
    formData.append('from', fromField);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('html', body.replace(/\n/g, '<br>'));

    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`api:${apiKey}`)
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mailgun error:', errorText);
      return Response.json({ 
        error: 'Failed to send email via Mailgun',
        details: errorText
      }, { status: response.status });
    }

    const result = await response.json();
    
    return Response.json({ 
      success: true,
      message: 'Email sent successfully',
      mailgun_id: result.id
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return Response.json({ 
      error: error.message || 'An error occurred while sending email'
    }, { status: 500 });
  }
});