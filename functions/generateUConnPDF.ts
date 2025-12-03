import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Parse request
        const { invoice_id } = await req.json();
        if (!invoice_id) {
            return Response.json({ error: "invoice_id is required" }, { status: 400 });
        }

        // 2. Fetch Data
        const invoice = await base44.entities.Invoice.get(invoice_id);
        if (!invoice) {
            return Response.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Get linked income records to build line items
        let lineItems = [];
        if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
            const allIncomes = await base44.entities.OutsideIncome.list(); // In a real app, ideally filter by IDs, but list() is fine for small datasets
            const linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
            
            const providers = await base44.entities.Provider.list();

            for (const income of linkedIncomes) {
                const provider = providers.find(p => p.id === income.provider_id);
                const providerName = provider ? provider.full_name : "Unknown Provider";
                
                // "Description should be providers name and first day worked"
                // "if more than one day next line would be providers name and the second day worked"
                if (income.work_dates && income.work_dates.length > 0) {
                    for (const date of income.work_dates) {
                        // Format date to something readable if needed, e.g. YYYY-MM-DD
                        lineItems.push({
                            description: `${providerName} ${date}`,
                            quantity: "1",
                            unitPrice: "1340"
                        });
                    }
                }
            }
        }

        // 3. Load Template
        // Template URI from previous step
        const templateUri = "private/691521cbabed77e5043c7037/8416bf28c_MasterUConnServiceInvoice.pdf";
        
        // Get a signed URL to download the private file
        const signedUrlRes = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
            file_uri: templateUri,
            expires_in: 60
        });
        
        const templateResponse = await fetch(signedUrlRes.signed_url);
        const templateBuffer = await templateResponse.arrayBuffer();

        // 4. Fill PDF
        const pdfDoc = await PDFDocument.load(templateBuffer);
        const form = pdfDoc.getForm();

        // Fill Header Fields
        const invoiceNumField = form.getTextField('InvoiceNumber');
        if (invoiceNumField) invoiceNumField.setText(invoice.invoice_number || '');

        const invoiceDateField = form.getTextField('InvoiceDate');
        if (invoiceDateField) invoiceDateField.setText(invoice.invoice_date || '');

        // Fill Rows (Up to 7 as per instructions)
        for (let i = 0; i < Math.min(lineItems.length, 7); i++) {
            const item = lineItems[i];
            const rowNum = i + 1;
            
            try {
                // Qty field: Qty1, Qty2...
                const qtyField = form.getTextField(`Qty${rowNum}`);
                if (qtyField) qtyField.setText(item.quantity);

                // Description field: Desc1, Desc2...
                const descField = form.getTextField(`Desc${rowNum}`);
                if (descField) descField.setText(item.description);

                // Unit Price field: UnitPrice1, UnitPrice2...
                const priceField = form.getTextField(`UnitPrice${rowNum}`);
                if (priceField) priceField.setText(item.unitPrice);
                
                // Total for line? Usually Qty * UnitPrice. 
                // If there is a Total field per line, we might need to fill it too.
                // Assuming there might be a 'Amount1', 'Amount2' field or similar?
                // User didn't specify, so skipping line total for now.
                
            } catch (err) {
                console.log(`Error filling row ${rowNum}:`, err.message);
            }
        }

        // Flatten form to prevent further editing (optional, makes it look like a regular doc)
        form.flatten();

        const pdfBytes = await pdfDoc.save();

        // 5. Return PDF
        return new Response(pdfBytes, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Invoice_${invoice.invoice_number || 'draft'}.pdf"`
            }
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});