import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { format, parseISO, getDate, getMonth, getYear } from 'npm:date-fns@2.30.0';

const safeSetField = (form, fieldName, value) => {
    try {
        const field = form.getTextField(fieldName);
        if (field) {
            field.setText(value ? String(value) : '');
        }
    } catch (e) {
        // Field probably doesn't exist or is not a text field
        // console.log(`Field ${fieldName} skipped: ${e.message}`);
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

        // 3. Determine Month and Year
        let targetDate = new Date();
        if (invoice.invoice_date) {
            targetDate = parseISO(invoice.invoice_date);
        }
        
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
        const targetMonthIdx = getMonth(targetDate); // 0-indexed
        const targetYear = getYear(targetDate);

        // 4. Load Template
        const templateUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/2a7f46392_ManchesterHospitalInvocieTemplateWithInitials.pdf";
        
        const templateResponse = await fetch(templateUrl);
        if (!templateResponse.ok) {
             throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
        }
        const templateBuffer = await templateResponse.arrayBuffer();

        // 5. Fill PDF
        const pdfDoc = await PDFDocument.load(templateBuffer);
        const form = pdfDoc.getForm();

        // Fill Header Fields using safe setter
        safeSetField(form, 'Group', 'ENTIC');
        safeSetField(form, 'Payment Rate', '1,000');
        safeSetField(form, 'MD Coverage Services Provided', monthName);
        // PDF field names appear to be swapped relative to visual labels
        safeSetField(form, 'Month', yearStr);
        safeSetField(form, 'Year', monthName);

        // Fill Calendar Days
        for (const income of linkedIncomes) {
            const provider = providers.find(p => p.id === income.provider_id);
            const providerName = provider ? provider.full_name : "Unknown";

            if (income.work_dates && income.work_dates.length > 0) {
                for (const dateStr of income.work_dates) {
                    const date = parseISO(dateStr);
                    
                    // Only map dates that match the target invoice month/year
                    if (getMonth(date) === targetMonthIdx && getYear(date) === targetYear) {
                        const dayOfMonth = getDate(date);
                        const fieldName = dayOfMonth.toString();
                        
                        try {
                            const dayField = form.getTextField(fieldName);
                            if (dayField) {
                                const existingText = dayField.getText();
                                if (existingText && existingText.length > 0 && !existingText.includes(providerName)) {
                                    dayField.setText(`${existingText}\n${providerName}`);
                                    dayField.setFontSize(8);
                                } else if (!existingText || existingText.length === 0) {
                                    dayField.setText(providerName);
                                }
                            }
                        } catch (e) {
                            // Ignore missing day fields
                        }
                    }
                }
            }
        }

        // Flatten form
        try {
            form.flatten();
        } catch (e) {
            console.error("Error flattening form:", e);
        }

        const filename = `Manchester Invoice - ${monthName} ${yearStr}.pdf`;

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