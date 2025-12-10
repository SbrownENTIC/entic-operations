import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch most recent Henry Schein invoice for debugging
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 50);
        const target = invoices.find(inv => (inv.vendor_name || '').toLowerCase().includes('henry'));

        if (!target) {
            return Response.json({ error: "No Henry Schein invoice found" }, { status: 404 });
        }
        
        const targetUrl = target.document_url;
        if (!targetUrl) return Response.json({ error: "No document URL" }, { status: 400 });

        // Download PDF
        const pdfResponse = await fetch(targetUrl);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const allPages = pdfDoc.getPages();

        // Debug Settings: Red Box, 18% height, NO blue lines
        const bottomPct = 0.18;

        for (const page of allPages) {
            const { width, height } = page.getSize();
            const rotation = page.getRotation().angle;
            
            let x = 0, y = 0, w = 0, h = 0;

            if (rotation === 0) {
                x = 0; y = 0; w = width; h = height * bottomPct;
            } else if (rotation === 90) {
                x = width * (1 - bottomPct); y = 0; w = width * bottomPct; h = height;
            } else if (rotation === 180) {
                x = 0; y = height * (1 - bottomPct); w = width; h = height * bottomPct;
            } else if (rotation === 270 || rotation === -90) {
                x = 0; y = 0; w = width * bottomPct; h = height;
            } else {
                x = 0; y = 0; w = width; h = height * bottomPct;
            }

            // Draw RED rectangle (Transparent-ish to see what's covered?) 
            // No, user wants to see the box. Opaque Red.
            page.drawRectangle({
                x, y, width: w, height: h,
                color: rgb(1, 0, 0), // RED
                opacity: 0.5, // 50% opacity so they can see what is being covered
            });
        }

        // Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `DEBUG_REDACT_${target.invoice_number}_${Date.now()}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const newUrl = uploadRes.file_url;

        return Response.json({ 
            status: "success", 
            original_url: targetUrl, 
            new_url: newUrl,
            cutoff_percentage: bottomPct
        });

    } catch (error) {
        console.error("Debug Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});