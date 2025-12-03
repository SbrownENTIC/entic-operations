import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { format, parseISO } from 'npm:date-fns@2.30.0';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'MM-dd-yyyy');
    } catch (e) {
        return dateStr;
    }
};

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
        let grandTotal = 0;

        if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
            const allIncomes = await base44.entities.OutsideIncome.list();
            const linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
            const providers = await base44.entities.Provider.list();

            for (const income of linkedIncomes) {
                const provider = providers.find(p => p.id === income.provider_id);
                const providerName = provider ? provider.full_name : "Unknown Provider";
                const rate = income.rate || 1340; // Default to 1340 if rate is missing
                
                if (income.work_dates && income.work_dates.length > 0) {
                    for (const date of income.work_dates) {
                        const quantity = 1;
                        const lineTotal = rate * quantity;
                        grandTotal += lineTotal;

                        lineItems.push({
                            description: `${providerName} ${formatDate(date)}`,
                            quantity: quantity.toString(),
                            unitPrice: formatCurrency(rate),
                            lineTotal: formatCurrency(lineTotal)
                        });
                    }
                }
            }
        }

        // 3. Load Template from Public URL
        const templateUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/3692ccc86_MasterUConnServiceInvoice.pdf";
        
        const templateResponse = await fetch(templateUrl);
        if (!templateResponse.ok) {
             throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
        }
        const templateBuffer = await templateResponse.arrayBuffer();

        // 4. Fill PDF
        const pdfDoc = await PDFDocument.load(templateBuffer);
        const form = pdfDoc.getForm();

        // Fill Header Fields
        const invoiceNumField = form.getTextField('InvoiceNumber');
        if (invoiceNumField) invoiceNumField.setText(invoice.invoice_number || '');

        const invoiceDateField = form.getTextField('InvoiceDate');
        if (invoiceDateField) invoiceDateField.setText(formatDate(invoice.invoice_date));

        // Fill Rows (Iterate through potential rows to clear defaults if empty)
        // We iterate up to 20 to ensure we cover all rows in the template and clear any default values (like $0.00)
        for (let i = 0; i < 20; i++) {
            const item = lineItems[i]; // undefined if we ran out of items
            const rowNum = i + 1;
            
            try {
                const qtyField = form.getTextField(`Qty${rowNum}`);
                if (qtyField) qtyField.setText(item ? item.quantity : '');

                const descField = form.getTextField(`Desc${rowNum}`);
                if (descField) descField.setText(item ? item.description : '');

                const priceField = form.getTextField(`UnitPrice${rowNum}`);
                if (priceField) priceField.setText(item ? item.unitPrice : '');
                
                const totalField = form.getTextField(`LineTotal${rowNum}`);
                if (totalField) totalField.setText(item ? item.lineTotal : '');
                
            } catch (err) {
                // Swallow error if field doesn't exist (e.g. reached end of template rows)
            }
        }

        // Fill Totals
        const subtotalField = form.getTextField('Subtotal');
        if (subtotalField) subtotalField.setText(formatCurrency(grandTotal));

        const totalField = form.getTextField('Total');
        if (totalField) totalField.setText(formatCurrency(grandTotal));

        // Flatten form to prevent further editing
        form.flatten();

        const pdfBase64 = await pdfDoc.saveAsBase64();

        // 5. Return JSON with Base64
        return Response.json({ 
            pdf_base64: pdfBase64,
            filename: `Invoice_${invoice.invoice_number || 'draft'}.pdf`
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});