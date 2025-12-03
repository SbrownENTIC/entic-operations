import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { invoiceId } = await req.json();

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Invoice Data
        const invoice = await base44.entities.Invoice.get(invoiceId);
        if (!invoice) throw new Error("Invoice not found");

        // 2. Fetch Related Data
        const provider = await base44.entities.Provider.get(invoice.staff_member_id);
        
        let incomeRecords = [];
        if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
            // Fetch all incomes and filter manually since we can't use 'in' query easily on all IDs at once if many
            // But here we can iterate or use Promise.all
            incomeRecords = await Promise.all(
                invoice.outside_income_ids.map(id => base44.entities.OutsideIncome.get(id))
            );
        }

        // 3. Fetch Template
        // Using the public URL provided by the user
        const templateUrl = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/5b1f5b2f6_MasterUConnServiceInvoice.pdf";
        const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer());

        // 4. Load PDF
        const pdfDoc = await PDFDocument.load(templateBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.getPages()[0];
        const { height } = page.getSize();

        // Helper to draw text
        const draw = (text, x, y, size = 10) => {
            page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });
        };

        // 5. Fill Header
        // Estimated coordinates based on letter/A4 size and image
        // Invoice No
        draw(invoice.invoice_number || "", 450, height - 165);
        // Date
        const dateStr = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-US') : "";
        draw(dateStr, 450, height - 180);

        // 6. Fill Line Items
        const startY = height - 320; // Approximate start of table
        const rowHeight = 23;
        const unitPrice = 1340.00;

        let currentY = startY;
        let subtotal = 0;

        // Sort incomes by date
        incomeRecords.sort((a, b) => {
            const dateA = a.work_dates?.[0] || "";
            const dateB = b.work_dates?.[0] || "";
            return dateA.localeCompare(dateB);
        });

        for (const income of incomeRecords) {
            // Quantity: Always 1
            draw("1", 60, currentY);

            // Description: "Dr. [Name] [First Date]"
            const firstDate = income.work_dates && income.work_dates.length > 0 
                ? new Date(income.work_dates[0]).toLocaleDateString('en-US') 
                : "";
            const description = `Dr. ${provider.full_name} ${firstDate}`;
            draw(description, 150, currentY);

            // Unit Price: 1340
            draw(unitPrice.toFixed(2), 480, currentY); // Align right roughly? text is left aligned, so careful

            // Line Total: 1340
            draw(unitPrice.toFixed(2), 540, currentY);

            subtotal += unitPrice;
            currentY -= rowHeight;
        }

        // 7. Fill Totals
        // Subtotal
        const totalsX = 540;
        const totalsY = height - 680; // Estimate near bottom
        // Note: The template calculates these? 
        // We are overwriting/filling because it's likely a flat PDF.
        // If it's a form with calc scripts, they might update. 
        // But drawing text on top is safe.
        
        // Actually, based on image, totals are at bottom right.
        // Let's try to hit the boxes.
        // Subtotal
        draw(subtotal.toFixed(2), totalsX, 125); 
        // Tax (assume 0)
        draw("0.00", totalsX, 105);
        // Total
        draw(subtotal.toFixed(2), totalsX, 85);


        // 8. Save Generated PDF
        const pdfBytes = await pdfDoc.save();
        
        // Convert to base64 for upload
        // Deno's btoa implementation
        let binary = '';
        const bytes = new Uint8Array(pdfBytes);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Pdf = btoa(binary);

        // Upload to Private Storage
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
            file: base64Pdf, // Integration often handles base64 if specified or tries to decode
            // Wait, the integration description says "file: string (binary)". 
            // Usually this means base64 in these contexts or multipart.
            // Let's try passing the base64 string.
        });

        // 9. Return URI
        return Response.json({ 
            success: true, 
            file_uri: uploadRes.file_uri,
            message: "PDF Generated Successfully" 
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});