import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Find the most recent Henry Schein invoice
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 50);
        const targetInvoice = invoices.find(inv => {
            const name = (inv.vendor_name || '').toLowerCase();
            return name.includes('henry') || name.includes('schein');
        });

        if (!targetInvoice) {
            return Response.json({ error: "No Henry Schein invoice found to test." }, { status: 404 });
        }

        console.log(`Testing redaction on Invoice: ${targetInvoice.invoice_number} (${targetInvoice.id})`);

        // 2. Download
        const pdfResponse = await fetch(targetInvoice.document_url);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        // 3. Draw Debug Boxes
        for (const page of pages) {
            const { width, height } = page.getSize();
            const rotation = page.getRotation().angle;

            // Normalize coordinates based on rotation
            // We want to cover the VISUAL bottom 30%
            let x=0, y=0, w=0, h=0;
            const pct = 0.30; // Bottom 30%

            if (rotation === 0) {
                x = 0; y = 0; w = width; h = height * pct;
            } else if (rotation === 90) {
                x = width * (1-pct); y = 0; w = width * pct; h = height;
            } else if (rotation === 180) {
                x = 0; y = height * (1-pct); w = width; h = height * pct;
            } else if (rotation === 270) {
                x = 0; y = 0; w = width * pct; h = height;
            } else {
                // Default
                x = 0; y = 0; w = width; h = height * pct;
            }

            // Draw RED Box (Solid)
            page.drawRectangle({
                x, y, width: w, height: h,
                color: rgb(1, 0, 0),
                opacity: 1, // 100% opacity
            });

            // Draw BLUE X across the page to prove we edited it
            page.drawLine({
                start: { x: 0, y: 0 },
                end: { x: width, y: height },
                color: rgb(0, 0, 1),
                thickness: 5,
            });
        }

        // 4. Save & Upload
        const modifiedPdfBytes = await pdfDoc.save();
        const fileName = `DEBUG_REDACT_${targetInvoice.invoice_number}_${Date.now()}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });

        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        
        // 5. Update Entity
        await base44.asServiceRole.entities.VendorInvoice.update(targetInvoice.id, {
            document_url: uploadRes.file_url,
            redacted: true
        });

        return Response.json({
            success: true,
            invoice_number: targetInvoice.invoice_number,
            old_url: targetInvoice.document_url,
            new_url: uploadRes.file_url
        });

    } catch (error) {
        console.error("Debug Redact Error:", error);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});