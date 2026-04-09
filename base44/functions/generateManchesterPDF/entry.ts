import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { format, parseISO, getMonth, getYear } from 'npm:date-fns@2.30.0';

import { TextAlignment } from 'npm:pdf-lib@1.17.1';

const formatCurrency = (amount) => {
    return '$' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeSetField = (form, fieldName, value, fontSize, align) => {
    try {
        const field = form.getTextField(fieldName);
        if (field) {
            field.setText(value ? String(value) : '');
            if (fontSize) field.setFontSize(fontSize);
            if (align !== undefined) field.setAlignment(align);
        }
    } catch (e) {
        // Field doesn't exist or wrong type
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Parse request
        const { invoice_id, save_to_record } = await req.json();
        if (!invoice_id) {
            return Response.json({ error: "invoice_id is required" }, { status: 400 });
        }

        // 2. Fetch Data
        const invoice = await base44.entities.Invoice.get(invoice_id);
        if (!invoice) {
            return Response.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Get linked income records
        let linkedIncomes = [];
        if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
            const allIncomes = await base44.entities.OutsideIncome.list();
            linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
        }

        const providers = await base44.entities.Provider.list();

        // 3. Determine Month and Year from linked OutsideIncome work dates
        let targetDate = invoice.invoice_date ? parseISO(invoice.invoice_date) : new Date();

        if (linkedIncomes.length > 0) {
            const allDates = linkedIncomes.reduce((acc, inc) => {
                return inc.work_dates ? [...acc, ...inc.work_dates] : acc;
            }, []).sort();
            if (allDates.length > 0) {
                targetDate = parseISO(allDates[0]);
            }
        }

        const monthName = format(targetDate, 'MMMM');
        const yearStr = format(targetDate, 'yyyy');
        const targetMonthIdx = getMonth(targetDate);
        const targetYear = getYear(targetDate);

        // 4. Load Template
        const templateUrl = "https://media.base44.com/files/public/691521cbabed77e5043c7037/90efb151f_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";"https://media.base44.com/files/public/691521cbabed77e5043c7037/f85160c21_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";"https://media.base44.com/files/public/691521cbabed77e5043c7037/23b640b06_TestHH-Manchester-ECHNInvoicetemplate-ENTIC.pdf";"https://media.base44.com/files/public/691521cbabed77e5043c7037/272e9f6ed_HH-ManchesterECHNInvoicetemplate-ENTIC.pdf";
        
        const templateResponse = await fetch(templateUrl);
        if (!templateResponse.ok) {
             throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
        }
        const templateBuffer = await templateResponse.arrayBuffer();

        // 5. Fill PDF
        const pdfDoc = await PDFDocument.load(templateBuffer);
        const form = pdfDoc.getForm();

        // Invoice Number: template already has "EARNOSETHROATCALL" prefix — only write MM/YY
        const invoiceDateFormatted = invoice.invoice_date ? parseISO(invoice.invoice_date) : new Date();
        const invoiceMMYY = format(invoiceDateFormatted, 'MM/yy');
        safeSetField(form, 'invoice_number', invoiceMMYY, 11);

        // Invoice Date: MM/DD/YYYY
        safeSetField(form, 'invoice_date', format(invoiceDateFormatted, 'MM/dd/yyyy'), 11);

        // Month & Year of Service: e.g. "March 2026"
        safeSetField(form, 'month_year_service', `${monthName} ${yearStr}`, 11);

        // Providers
        const uniqueProviderIds = [...new Set(linkedIncomes.map(inc => inc.provider_id).filter(Boolean))];
        const providerFullNames = uniqueProviderIds.map(pid => {
            const p = providers.find(prov => prov.id === pid);
            return p ? `${p.full_name}, M.D.` : null;
        }).filter(Boolean);

        // Number of shifts = sum of days_worked from linked OutsideIncome records
        const totalShifts = linkedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
        safeSetField(form, 'Shift Count', String(totalShifts), 11);

        // Subtotal = shifts * $1,000 per shift
        const subtotalAmount = totalShifts * 1000;
        console.log('invoice.total_amount:', invoice.total_amount);
        const totalDue = invoice.total_amount || subtotalAmount;

        safeSetField(form, 'subtotal', formatCurrency(subtotalAmount), 11, TextAlignment.Right);
        safeSetField(form, 'Total', formatCurrency(totalDue), 11, TextAlignment.Right);

        // Flatten form
        try {
            form.flatten();
        } catch (e) {
            console.error("Error flattening form:", e);
        }

        // Get all unique provider full names for the filename
        let providerNamesStr = "Provider";
        if (providerFullNames.length > 0) {
            providerNamesStr = providerFullNames.map(name => name.replace(', M.D.', '')).join(', ');
        } else if (invoice.staff_member_id) {
            const invoiceProvider = providers.find(p => p.id === invoice.staff_member_id);
            if (invoiceProvider) providerNamesStr = invoiceProvider.full_name;
        }

        const safeProgramGroup = (invoice.program_group || "Manchester").replace(/\//g, "-");
        const filename = `${monthName} ${yearStr}- ${safeProgramGroup} On Call Invoice- ${providerNamesStr} Approved.pdf`;

        // Check if we should save to record
        if (save_to_record) {
             const pdfBytes = await pdfDoc.save();
             const file = new File([pdfBytes], filename, { type: 'application/pdf' });
             
             // Upload file
             const { file_url } = await base44.integrations.Core.UploadFile({ file });
             
             // Update invoice record
             await base44.entities.Invoice.update(invoice.id, {
                 draft_invoice_url: file_url,
                 status: 'sent_for_approval',
                 invoice_sent_for_approval: true,
                 sent_for_approval_at: new Date().toISOString()
             });
             
             return Response.json({ 
                 success: true, 
                 url: file_url,
                 filename: filename
             });
        }

        const pdfBase64 = await pdfDoc.saveAsBase64();

        // 5. Return JSON with Base64
        return Response.json({ 
            pdf_base64: pdfBase64,
            filename: filename
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});