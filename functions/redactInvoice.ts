import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { invoice_id } = await req.json();

        if (!invoice_id) {
            return Response.json({ error: "Missing invoice_id" }, { status: 400 });
        }

        // 1. Fetch Invoice
        const results = await base44.asServiceRole.entities.VendorInvoice.list(null, 1, { id: invoice_id });
        const invoice = results[0];
        if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
        
        const targetUrl = invoice.document_url;
        if (!targetUrl) return Response.json({ error: "No document URL found" }, { status: 400 });

        // 2. Determine Redaction Strategy
        const vendorName = (invoice.vendor_name || '').toLowerCase();
        
        // Default values
        let shouldRedact = false;
        let topPct = 1.0; 
        let pagesToRedact = [];

        // Download PDF
        const pdfResponse = await fetch(targetUrl);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const allPages = pdfDoc.getPages();

        if (vendorName.includes('henry') || vendorName.includes('schein')) {
            // STRATEGY A: Force Redaction for Henry Schein (No LLM)
            shouldRedact = true;
            topPct = 0.70; // KEEP top 70%, REDACT bottom 30% (Aggressive)
            pagesToRedact = allPages.map((_, i) => i + 1); // Redact all pages
        } else {
            // STRATEGY B: Use LLM for other vendors
            const analyzeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `
                Analyze this invoice PDF page(s).
                I need to redact everything located BELOW the summary strip to hide the footer containing sensitive distribution info.
                
                Detection Rules:
                1. "Ship To#" / "Bill To#" Row: This is the primary marker. Start redaction IMMEDIATELY ABOVE this row (approx 75% down).
                2. "Code Status Key": Redact everything above and below it.
                3. "Distribution Names/Address": Redact well above it.
                
                Return JSON:
                {
                    "needs_redaction": boolean,
                    "pages": [integer],
                    "redaction_start_y_percentage": number (0.0 to 1.0, e.g. 0.75)
                }
                
                Action:
                - If found, set "redaction_start_y_percentage" to 0.75.
                - Default to 0.85 (15% cut) if unsure.
                `,
                file_urls: [targetUrl],
                response_json_schema: {
                    type: "object",
                    properties: {
                        needs_redaction: { type: "boolean" },
                        pages: { type: "array", items: { type: "integer" } },
                        redaction_start_y_percentage: { type: "number" }
                    }
                }
            });

            const analysis = typeof analyzeRes === 'string' ? JSON.parse(analyzeRes) : analyzeRes;
            shouldRedact = analysis.needs_redaction;
            topPct = analysis.redaction_start_y_percentage || 0.75; 
            pagesToRedact = analysis.pages || [1];
        }

        if (!shouldRedact) {
            await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, { redacted: true });
            return Response.json({ status: "skipped", reason: "No target section detected" });
        }
        
        // 3. Apply Redaction with Rotation Support
        for (const pageNum of pagesToRedact) {
            if (pageNum < 1 || pageNum > allPages.length) continue;
            const page = allPages[pageNum - 1];
            const { width, height } = page.getSize();
            const rotation = page.getRotation().angle;
            
            // Calculate coordinates based on rotation to always cover VISUAL BOTTOM
            let x = 0, y = 0, w = 0, h = 0;

            if (rotation === 0) {
                // Standard: Bottom is y=0
                // Redact from y=0 to y=height*(1-topPct)
                x = 0;
                y = 0;
                w = width;
                h = height * (1 - topPct);
            } else if (rotation === 90) {
                // 90 deg clockwise: Visual Bottom is Physical Right (x=width)
                // Redact strip on the Right side
                // From x = width*topPct to x = width
                x = width * topPct;
                y = 0;
                w = width * (1 - topPct);
                h = height;
            } else if (rotation === 180) {
                // 180 deg: Visual Bottom is Physical Top (y=height)
                // Redact strip at Top
                // From y = height*topPct to y = height
                x = 0;
                y = height * topPct;
                w = width;
                h = height * (1 - topPct);
            } else if (rotation === 270 || rotation === -90) {
                // 270 deg clockwise: Visual Bottom is Physical Left (x=0)
                // Redact strip on the Left
                // From x = 0 to x = width*(1-topPct)
                x = 0;
                y = 0;
                w = width * (1 - topPct);
                h = height;
            } else {
                // Fallback for weird rotations (e.g. 45), treat as 0
                 x = 0;
                y = 0;
                w = width;
                h = height * (1 - topPct);
            }

            // Draw white rectangle
            // Add a small buffer (5 units) to overlap cleanly
            if (rotation === 0) h += 5;
            if (rotation === 90) x -= 5; w += 5;
            if (rotation === 180) y -= 5; h += 5;
            if (rotation === 270) w += 5;

            page.drawRectangle({
                x, y, width: w, height: h,
                color: rgb(1, 1, 1),
            });
        }

        // 4. Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        const fileName = `redacted_${invoice.invoice_number || 'doc'}_${Date.now()}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: file });
        const newUrl = uploadRes.file_url;

        // 5. Update Entity
        await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, {
            document_url: newUrl,
            redacted: true
        });

        return Response.json({ 
            status: "success", 
            original_url: targetUrl, 
            new_url: newUrl,
            cutoff_percentage: topPct,
            rotation_handled: true
        });

    } catch (error) {
        console.error("Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});