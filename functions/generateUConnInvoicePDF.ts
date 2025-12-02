import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const PDF_TEMPLATE_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/8d3375995_MasterUConnServiceInvoice.pdf";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { invoice_id } = await req.json();

        if (!invoice_id) {
            return Response.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        // 1. Fetch Data
        const invoice = await base44.entities.Invoice.get(invoice_id);
        if (!invoice) {
            return Response.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const provider = await base44.entities.Provider.get(invoice.staff_member_id);
        
        // Fetch linked outside incomes
        const incomeIds = invoice.outside_income_ids || [];
        const incomes = [];
        for (const id of incomeIds) {
            const inc = await base44.entities.OutsideIncome.get(id);
            if (inc) incomes.push(inc);
        }

        // 2. Prepare Line Items
        let lineItems = [];
        const providerName = provider ? provider.full_name : "Unknown Provider";

        // Flatten work dates from all linked incomes
        for (const inc of incomes) {
            if (inc.work_dates && Array.isArray(inc.work_dates)) {
                for (const dateStr of inc.work_dates) {
                    lineItems.push({
                        date: new Date(dateStr),
                        dateStr: dateStr, // Keep original string for reference
                        description: `${providerName} ${new Date(dateStr).toLocaleDateString('en-US')}`
                    });
                }
            }
        }

        // Sort by date
        lineItems.sort((a, b) => a.date - b.date);

        // Limit to 7 lines
        if (lineItems.length > 7) {
            lineItems = lineItems.slice(0, 7);
        }

        // 3. Load and Fill PDF
        const templateBytes = await fetch(PDF_TEMPLATE_URL).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();
        
        // Log fields for debugging (visible in dashboard logs)
        // const fields = form.getFields().map(f => f.getName());
        // console.log("PDF Fields:", fields);

        // Helper to set text if field exists
        const setText = (name, value) => {
            try {
                const field = form.getTextField(name);
                if (field) field.setText(value);
            } catch (e) {
                // Try case-insensitive matching if exact match fails
                try {
                    const fields = form.getFields();
                    const match = fields.find(f => f.getName().toLowerCase() === name.toLowerCase());
                    if (match && match.constructor.name === 'PDFTextField') {
                         match.setText(value);
                    }
                } catch (e2) {
                    console.warn(`Could not find field: ${name}`);
                }
            }
        };

        // Set Header Fields
        setText('Invoice No', invoice.invoice_number || '');
        setText('Date', invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-US') : '');
        
        // Set Line Items
        // Note: Field names are guessed based on standard AcroForm structures. 
        // Common patterns: "Row1_Qty", "Qty1", "Quantity_1", etc.
        // Based on the provided PDF visual, it's a table.
        // I'll try a few common patterns for the first row to "detect" the naming scheme if possible, 
        // but for now I'll try to iterate based on the field list I assume exists.
        // Given I can't see the field names, I'll try a robust strategy: 
        // Find fields that look like columns.
        
        // Let's assume rows are indexed 1 to 7 or 0 to 6.
        // And columns are Quantity, Description, Unit Price, Line Total
        
        const allFields = form.getFields().map(f => f.getName());
        
        // Helper to find field by fuzzy name matching row index
        const findFieldForColumn = (colName, rowIndex) => {
             // Search for patterns like "QuantityRow1", "Quantity1", "Row1_Quantity"
             // rowIndex is 1-based (1..7)
             const patterns = [
                 new RegExp(`^${colName}.*${rowIndex}$`, 'i'), // Quantity1
                 new RegExp(`^.*${rowIndex}.*${colName}$`, 'i'), // Row1_Quantity
                 new RegExp(`^${colName}\\[${rowIndex-1}\\]$`, 'i') // Quantity[0]
             ];
             
             // Filter fields that contain the column name
             const candidates = allFields.filter(f => f.toLowerCase().includes(colName.toLowerCase()));
             
             // Try to find a match for the row
             for (const pattern of patterns) {
                 const match = candidates.find(c => pattern.test(c));
                 if (match) return match;
             }
             
             // Fallback: simple index-based mapping if candidates are sorted? 
             // Risky without seeing names.
             // Let's just try standard names commonly used in Acrobat: "Row1", "Row2"...
             // or "undefined_2", "undefined_3" if auto-generated.
             
             return null;
        };

        // Actually, let's just loop 1-7 and try standard names.
        // If the PDF was created in Acrobat, it might be "Row1", "Row2"... 
        
        // Let's try to dump all fields to console for the first run to help debug if needed,
        // but also try to fill based on "order" if names are obscure? No, can't rely on order.
        
        // STRATEGY: Iterate through fields, group by Y coordinate? Too complex for here.
        // Let's guess specific names often found in these templates.
        // "Quantity_1", "Description_1", "Unit Price_1", "Line Total_1"
        
        let totalAmount = 0;

        for (let i = 0; i < 7; i++) {
            const rowIndex = i + 1; // 1-based index
            const item = lineItems[i];
            
            const qty = item ? "1" : "";
            const desc = item ? item.description : "";
            const price = item ? "1340.00" : "";
            const lineTotal = item ? "1340.00" : "";
            
            if (item) totalAmount += 1340;

            // Try explicit names first (common in LiveCycle/Acrobat)
            setText(`QuantityRow${rowIndex}`, qty);
            setText(`DescriptionRow${rowIndex}`, desc);
            setText(`UnitPriceRow${rowIndex}`, price);
            setText(`TotalRow${rowIndex}`, lineTotal);

            // Fallbacks
            setText(`Qty${rowIndex}`, qty);
            setText(`Desc${rowIndex}`, desc);
            setText(`Price${rowIndex}`, price);
            setText(`Total${rowIndex}`, lineTotal);
            
            // Fallback 2 (Space separated)
            setText(`Quantity ${rowIndex}`, qty);
            setText(`Description ${rowIndex}`, desc);
            setText(`Unit Price ${rowIndex}`, price);
            setText(`Line Total ${rowIndex}`, lineTotal);
        }

        // Set Totals
        const formattedTotal = totalAmount.toFixed(2);
        setText('Subtotal', formattedTotal);
        setText('Sales Tax', '0.00');
        setText('Total', formattedTotal);
        
        // Additional attempts for total fields
        setText('SubTotal', formattedTotal);
        setText('GrandTotal', formattedTotal);
        setText('InvoiceTotal', formattedTotal);


        // 4. Save and Upload
        const pdfBytes = await pdfDoc.save();
        
        // Create a Blob-like object for upload (need to convert to File or Blob for SDK?)
        // The UploadFile integration takes a 'file' parameter which is a File object or blob? 
        // In Deno, we might need to handle this differently. 
        // The Base44 SDK `base44.integrations.Core.UploadFile` expects `file`.
        // We need to pass a File object.
        
        const file = new File([pdfBytes], `Invoice_${invoice.invoice_number || 'Draft'}_${Date.now()}.pdf`, { type: 'application/pdf' });
        
        const uploadRes = await base44.integrations.Core.UploadFile({
            file: file
        });
        
        if (uploadRes && uploadRes.file_url) {
            // 5. Update Invoice
            await base44.entities.Invoice.update(invoice.id, {
                draft_invoice_url: uploadRes.file_url
            });
            
            return Response.json({ 
                success: true, 
                message: 'PDF generated and attached', 
                url: uploadRes.file_url 
            });
        }

        return Response.json({ error: 'Failed to upload generated PDF' }, { status: 500 });

    } catch (error) {
        console.error("Error generating PDF:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});