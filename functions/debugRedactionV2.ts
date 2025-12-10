import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch most recent Henry Schein invoice for debugging
        const invoices = await base44.asServiceRole.entities.VendorInvoice.list('-created_date', 50);
        
        // Find a "clean" invoice (not already debugged/redacted)
        const target = invoices.find(inv => {
            const name = (inv.vendor_name || '').toLowerCase();
            const url = (inv.document_url || '').toLowerCase();
            return name.includes('henry') && !url.includes('debug') && !url.includes('redacted');
        });

        if (!target) {
            // Fallback: If all are dirty, just take the first Henry one, but warn in console
            const fallback = invoices.find(inv => (inv.vendor_name || '').toLowerCase().includes('henry'));
            if (!fallback) return Response.json({ error: "No Henry Schein invoice found" }, { status: 404 });
            console.log("Warning: Using a potentially dirty invoice as no clean ones were found.");
            // We'll proceed with fallback, but the user might see previous redactions.
            // Let's try to get the fallback, but maybe we can upload a clean version if we had the original... impossible.
            // We will proceed with the fallback.
            var activeTarget = fallback;
        } else {
            var activeTarget = target;
        }
        
        const targetUrl = activeTarget.document_url;
        
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

            // Draw RED rectangle (Semi-transparent to see text behind)
            page.drawRectangle({
                x, y, width: w, height: h,
                color: rgb(1, 0, 0), // RED
                opacity: 0.5,
            });
            
            // Draw a GREEN border to prove this is V2
            page.drawRectangle({
                x, y, width: w, height: h,
                borderColor: rgb(0, 1, 0), // GREEN
                borderWidth: 2,
                opacity: 0, // Transparent fill
            });
        }

        // Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `DEBUG_V2_${target.invoice_number}_${Date.now()}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const newUrl = uploadRes.file_url;

        return Response.json({ 
            status: "success", 
            original_url: targetUrl, 
            new_url: newUrl,
            cutoff_percentage: bottomPct,
            version: "V2"
        });

    } catch (error) {
        console.error("Debug Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});