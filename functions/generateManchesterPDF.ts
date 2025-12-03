import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { format, parseISO, getDate, getMonth, getYear } from 'npm:date-fns@2.30.0';

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
        // Try to get from invoice month first, otherwise find earliest work date
        let targetDate = new Date();
        if (invoice.invoice_date) {
            targetDate = parseISO(invoice.invoice_date);
        }
        
        if (linkedIncomes.length > 0) {
            // Find the earliest work date to determine the month
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

        // Fill Header Fields
        const groupField = form.getTextField('Group');
        if (groupField) groupField.setText('ENTIC');

        const rateField = form.getTextField('Payment Rate');
        if (rateField) rateField.setText('1000'); // Hardcoded as requested

        // "Coverage Services Provided The Month should be the month..."
        const coverageField = form.getTextField('MD Coverage Services Provided');
        if (coverageField) coverageField.setText(monthName);

        const monthField = form.getTextField('Month');
        if (monthField) monthField.setText(monthName);

        const yearField = form.getTextField('Year');
        if (yearField) yearField.setText(yearStr);

        // Fill Calendar Days
        // Iterate through all linked incomes and their dates
        for (const income of linkedIncomes) {
            const provider = providers.find(p => p.id === income.provider_id);
            const providerName = provider ? provider.full_name : "Unknown";

            if (income.work_dates && income.work_dates.length > 0) {
                for (const dateStr of income.work_dates) {
                    const date = parseISO(dateStr);
                    
                    // Only map dates that match the target invoice month/year
                    if (getMonth(date) === targetMonthIdx && getYear(date) === targetYear) {
                        const dayOfMonth = getDate(date);
                        const fieldName = dayOfMonth.toString(); // '1', '2', etc.
                        
                        try {
                            const dayField = form.getTextField(fieldName);
                            if (dayField) {
                                // Handle cases where multiple providers work the same day (append)
                                const existingText = dayField.getText();
                                if (existingText && existingText.length > 0 && !existingText.includes(providerName)) {
                                    dayField.setText(`${existingText}\n${providerName}`);
                                    // Adjust font size if needed for multiple lines? 
                                    // pdf-lib text fields usually auto-size or clip. 
                                    // Let's assume mostly single provider per day or just append.
                                    dayField.setFontSize(8); // Reduce size to fit multiple
                                } else if (!existingText || existingText.length === 0) {
                                    dayField.setText(providerName);
                                }
                            }
                        } catch (e) {
                            console.log(`Field ${fieldName} not found or error setting text`);
                        }
                    }
                }
            }
        }

        // Flatten form to prevent further editing
        form.flatten();

        // Check if we should save to record
        if (save_to_record) {
             const pdfBytes = await pdfDoc.save();
             const filename = `Manchester Invoice - ${monthName} ${yearStr}.pdf`;
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
            filename: `Manchester Invoice - ${monthName} ${yearStr}.pdf`
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});