import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U'; // Base ID for ENTIC
const UCONN_INVOICES_TABLE = 'UConn Invoices';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Ensure authenticated context
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id, pdf_url } = await req.json();

    if (!invoice_id || !pdf_url) {
      return Response.json({ error: 'Missing invoice_id or pdf_url' }, { status: 400 });
    }

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Fetch invoice details
    const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch linked outside income to identify providers
    const outsideIncomes = await base44.asServiceRole.entities.OutsideIncome.filter({
        invoice_id: invoice.id
    });

    // Get unique provider IDs
    const providerIds = [...new Set(outsideIncomes.map(inc => inc.provider_id))];
    const providers = await Promise.all(
        providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    const providerList = providers.map(p => `- ${p.full_name}`).join('\n');
    const invoiceMonth = invoice.month || 'the invoice period';

    // Construct Email Content
    const emailSubject = `UConn ${invoiceMonth} Invoices`;
    const toRecipient = "amoffo@uchc.edu";
    const ccRecipients = "steve.brown@enticmd.com, Heldridge@enticmd.com";
    
    const emailBody = `Hi Allyson,\n\nHope your week is off to a fantastic start.\n\nThe ${invoiceMonth} clinic session details for you to process and enter for:\n\n${providerList}\n\nYou can view the invoice here: ${pdf_url}\n\nThank you so much,\nSteve Brown\nOperations Manager`;

    // Prepare Airtable Record Fields
    const fields = {
        "Invoice Number": invoice.invoice_number || 'N/A',
        "Month": invoiceMonth,
        "Providers": providers.map(p => p.full_name).join(', '),
        "PDF URL": pdf_url,
        "Status": "Ready for Email",
        "Email Subject": emailSubject,
        "Email Body": emailBody,
        "To": toRecipient,
        "CC": ccRecipients,
        "Invoice ID": invoice_id
    };

    // Create record in Airtable
    const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(UCONN_INVOICES_TABLE)}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields })
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Airtable Error: ${JSON.stringify(errorData)}`);
    }

    return Response.json({ success: true, message: "UConn invoice synced to Airtable successfully" });

  } catch (error) {
    console.error('Error syncing UConn invoice to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});