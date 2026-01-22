import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const NOTIFICATIONS_TABLE = 'tblVG6MUoSifOpHsh';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
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

    // Get unique provider IDs (from both linked incomes and the invoices themselves)
    const providerIdsFromIncomes = flatIncomes.map(inc => inc.provider_id);
    const providerIdsFromInvoices = validInvoices.map(inv => inv.staff_member_id);
    const providerIds = [...new Set([...providerIdsFromIncomes, ...providerIdsFromInvoices])].filter(Boolean);

    const providers = await Promise.all(
        providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    const providerList = providers.map(p => `• ${p.full_name}`).join('\n') || "(No providers identified)";
    
    // Use the month from the first invoice (assuming batch is for same month)
    const invoiceMonth = validInvoices[0].month || 'the invoice period';
    const invoiceNumbers = validInvoices.map(i => i.invoice_number).join(', ') || "(No Invoice Numbers)";

    // Construct Email Content
    const emailSubject = `Manchester ${invoiceMonth} Invoices`;
    const toRecipient = "apacileo@echn.org";
    // Ensure these are the correct CCs
    const ccRecipients = "steve.brown@enticmd.com";
    
    const emailBody = `Hey Ann Marie,\n\nHope your week is off to a fantastic start.\n\nThe ${invoiceMonth} clinic session details are attached for you to process and enter for:\n\n${providerList}\n\nThank you so much,\n\nSteve Brown\n\nOperations Manager`;

    // Prepare Airtable Record Fields - Mapping to the generic Notifications table
    const fields = {
        "Recipient": toRecipient,
        "Subject": emailSubject,
        "Body": emailBody,
        "From Name": 'ENTIC Operations Team',
        "Reminder Name": `Manchester Invoices: ${invoiceNumbers}`,
        "Reminder Type": "Invoice Email",
        "Send Date": new Date().toISOString().split('T')[0],
        "Status": "Pending Email Send",
        "CC": ccRecipients,
        "Attachments": attachments
    };

    // Create record in Airtable
    const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${NOTIFICATIONS_TABLE}`,
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
    console.error('Error syncing Manchester invoices to Airtable:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
      details: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }, { status: 500 });
  }
  });