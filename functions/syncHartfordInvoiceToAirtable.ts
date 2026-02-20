import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { logSystemEvent } from "./utils/systemLogger.js";

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const NOTIFICATIONS_TABLE = 'tblVG6MUoSifOpHsh';

Deno.serve(async (req) => {
  try {
    await logSystemEvent("syncHartfordInvoiceToAirtable", "START");
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
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

    const invoiceIds = itemsToProcess.map(i => i.id);

    const invoiceDetails = await Promise.all(
        invoiceIds.map(id => base44.asServiceRole.entities.Invoice.get(id))
    );

    // Filter for Hartford Hospital AND exclude Directorship invoices
    // The user specified that Directorship details are on the main invoice, so we don't need to send the Directorship invoice record/pdf.
    const validInvoices = invoiceDetails.filter(i => 
        i && 
        i.program_group === 'Hartford Hospital' &&
        !i.invoice_number?.includes('(Directorship)')
    );
    
    if (validInvoices.length === 0) {
        // If we filtered out everything (e.g. only Directorship invoice was selected), just return success to avoid errors in UI
        const ignoredInvoices = invoiceDetails.filter(i => i && i.invoice_number?.includes('(Directorship)'));
        if (ignoredInvoices.length > 0) {
            return Response.json({ success: true, message: `Skipped ${ignoredInvoices.length} Directorship invoice(s) as requested` });
        }
        return Response.json({ error: 'No valid Hartford Hospital invoices found' }, { status: 404 });
    }

    // Rebuild attachments list to only include PDFs for the valid (non-Directorship) invoices
    const validIds = validInvoices.map(i => i.id);
    const attachments = itemsToProcess
        .filter(item => validIds.includes(item.id))
        .map(i => ({ "url": i.pdf_url }));

    const allOutsideIncomes = await Promise.all(
        validInvoices.map(inv => base44.asServiceRole.entities.OutsideIncome.filter({
            invoice_id: inv.id
        }))
    );

    const flatIncomes = allOutsideIncomes.flat();

    const providerIdsFromIncomes = flatIncomes.map(inc => inc.provider_id);
    const providerIdsFromInvoices = validInvoices.map(inv => inv.staff_member_id);
    const providerIds = [...new Set([...providerIdsFromIncomes, ...providerIdsFromInvoices])].filter(Boolean);

    const providers = await Promise.all(
        providerIds.map(id => base44.asServiceRole.entities.Provider.get(id))
    );

    const providerList = providers.map(p => `- ${p.full_name}`).join('\n') || "(No providers identified)";
    
    const invoiceMonth = validInvoices[0].month || 'the invoice period';
    const invoiceNumbers = validInvoices.map(i => i.invoice_number).join(', ') || "(No Invoice Numbers)";

    const emailSubject = `Hartford Hospital ${invoiceMonth} Invoices`;
    const toRecipient = "ap@hhchealth.org";
    const ccRecipients = "steve.brown@enticmd.com";
    
    const emailBody = `Hey Team,\n\nHope your week is off to a fantastic start.\n\nThe Hartford Hospital ${invoiceMonth} clinic session details for you to process and enter for:\n\n${providerList}\n\nPlease see the attached invoices.\n\nThank you so much,\nSteve Brown\nOperations Manager`;

    const fields = {
        "Recipient": toRecipient,
        "Subject": emailSubject,
        "Body": emailBody,
        "From Name": 'ENTIC Operations Team',
        "Reminder Name": `Hartford Hospital Invoices: ${invoiceNumbers}`,
        "Reminder Type": "Invoice Email",
        "Send Date": new Date().toISOString().split('T')[0],
        "Status": "Pending Email Send",
        "CC": ccRecipients,
        "Attachments": attachments
    };

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

    // Automatically mark associated Directorship invoices as sent
    const timestamp = new Date().toISOString();
    await Promise.all(validInvoices.map(async (mainInvoice) => {
        try {
             // Find sibling directorship invoices
             const siblings = await base44.asServiceRole.entities.Invoice.filter({
                 staff_member_id: mainInvoice.staff_member_id,
                 month: mainInvoice.month,
                 program_group: 'Hartford Hospital'
             });
             
             const directorships = siblings.filter(inv => 
                 inv.invoice_number && 
                 inv.invoice_number.includes('(Directorship)')
             );
             
             await Promise.all(directorships.map(dirInv => 
                 base44.asServiceRole.entities.Invoice.update(dirInv.id, {
                     status: 'sent_to_vendor',
                     invoice_sent_to_vendor: true,
                     sent_to_vendor_at: timestamp,
                     manual_status_override: true
                 })
             ));
        } catch (err) {
            console.error(`Failed to update directorship invoice for ${mainInvoice.invoice_number}:`, err);
        }
    }));

    await logSystemEvent("syncHartfordInvoiceToAirtable", "SUCCESS");
    return Response.json({ success: true, message: `Synced ${validInvoices.length} Hartford Hospital invoices to Airtable successfully` });

  } catch (error) {
    await logSystemEvent("syncHartfordInvoiceToAirtable", "ERROR", error.message);
    console.error('Error syncing Hartford Hospital invoices to Airtable:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack,
      details: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }, { status: 500 });
  }
});