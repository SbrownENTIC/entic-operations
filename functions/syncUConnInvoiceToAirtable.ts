import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'app6seexOdkDrMl2U'; // Base ID for ENTIC
const NOTIFICATIONS_TABLE = 'Notifications'; // Using the generic notifications table

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Ensure authenticated context
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    // Support both single (legacy) and array (new) formats
    let itemsToProcess = [];
    
    if (payload.invoices && Array.isArray(payload.invoices)) {
        itemsToProcess = payload.invoices;
    } else if (payload.invoice_id && payload.pdf_url) {
        itemsToProcess = [{ id: payload.invoice_id, pdf_url: payload.pdf_url }];
    }

    if (itemsToProcess.length === 0) {
      return Response.json({ error: 'No invoices provided' }, { status: 400 });
    }

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    // Collect all invoice IDs
    const invoiceIds = itemsToProcess.map(i => i.id);
    const attachments = itemsToProcess.map(i => ({ "url": i.pdf_url }));

    // Fetch all invoice details
    const invoiceDetails = await Promise.all(
        invoiceIds.map(id => base44.asServiceRole.entities.Invoice.get(id))
    );

    // Filter out any nulls if invoices weren't found
    const validInvoices = invoiceDetails.filter(i => i);
    
    if (validInvoices.length === 0) {
        return Response.json({ error: 'No valid invoices found' }, { status: 404 });
    }

    // Fetch linked outside income for ALL invoices to identify providers
    // We do this concurrently
    const allOutsideIncomes = await Promise.all(
        validInvoices.map(inv => base44.asServiceRole.entities.OutsideIncome.filter({
            invoice_id: inv.id
        }))
    );

    // Flatten the array of arrays
    const flatIncomes = allOutsideIncomes.flat();

    // Get unique provider IDs
    const providerIds = [...new Set(flatIncomes.map(inc => inc.provider_id))];
    const providers = await Promise.all(
        providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    const providerList = providers.map(p => `- ${p.full_name}`).join('\n');
    
    // Use the month from the first invoice (assuming batch is for same month)
    const invoiceMonth = validInvoices[0].month || 'the invoice period';
    const invoiceNumbers = validInvoices.map(i => i.invoice_number).join(', ');

    // Construct Email Content
    const emailSubject = `UConn ${invoiceMonth} Invoices`;
    const toRecipient = "amoffo@uchc.edu, jserrano@uchc.edu";
    // Ensure these are the correct CCs
    const ccRecipients = "steve.brown@enticmd.com, heldridge@enticmd.com";
    
    const emailBody = `Hey Team,\n\nHope your week is off to a fantastic start.\n\nThe ${invoiceMonth} clinic session details for you to process and enter for:\n\n${providerList}\n\nPlease see the attached invoices.\n\nThank you so much,\nSteve Brown\nOperations Manager`;

    // Prepare Airtable Record Fields - Mapping to the generic Notifications table
    const fields = {
        "Recipient": toRecipient,
        "Subject": emailSubject,
        "Body": emailBody,
        "From Name": 'ENTIC Operations Team',
        "Reminder Name": `UConn Invoices: ${invoiceNumbers}`,
        "Reminder Type": "Invoice Email",
        "Send Date": new Date().toISOString().split('T')[0],
        "Status": "Pending Email Send",
        "CC": ccRecipients,
        "Attachments": attachments
    };

    // Create record in Airtable
    const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(NOTIFICATIONS_TABLE)}`,
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

    return Response.json({ success: true, message: `Synced ${itemsToProcess.length} invoices to Airtable successfully` });

  } catch (error) {
    console.error('Error syncing UConn invoices to Airtable:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});