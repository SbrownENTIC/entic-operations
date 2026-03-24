import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        const { invoice_id } = await req.json();

        if (!invoice_id) {
            return Response.json({ error: "Missing invoice_id" }, { status: 400 });
        }

        // 1. Fetch Invoice
        const results = await base44.asServiceRole.entities.VendorInvoice.filter({ id: invoice_id });
        const invoice = results[0];
        if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
        
        const targetUrl = invoice.document_url;
        if (!targetUrl) return Response.json({ error: "No document URL found" }, { status: 400 });

        // 2. Determine Redaction Strategy
        const vendorName = (invoice.vendor_name || '').toLowerCase();
        
        // Default values
        let shouldRedact = false;
        let bottomPct = 0.0; // Percentage of bottom to redact (0.0 to 1.0)
        let pagesToRedact = [];

        // Download PDF
        const pdfResponse = await fetch(targetUrl);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const allPages = pdfDoc.getPages();

        if (vendorName.includes('henry') || vendorName.includes('schein')) {
            // STRATEGY A: Force Redaction for Henry Schein
            // FIXED: Redact bottom 10% to cover footer + distribution info
            shouldRedact = true;
            bottomPct = 0.10; 
            pagesToRedact = allPages.map((_, i) => i + 1); 
            console.log("Redacting Henry Schein: Bottom 18%");
        } else {
            // STRATEGY B: Use LLM for other vendors
             const analyzeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `
                Analyze this invoice PDF page(s).
                I need to redact everything located BELOW the summary strip to hide the footer containing sensitive distribution info.
                Return JSON: { "needs_redaction": boolean, "redaction_percentage": number (e.g. 0.15 for bottom 15%) }
                `,
                file_urls: [targetUrl],
                response_json_schema: {
                    type: "object",
                    properties: {
                        needs_redaction: { type: "boolean" },
                        redaction_percentage: { type: "number" }
                    }
                }
            });

            const analysis = typeof analyzeRes === 'string' ? JSON.parse(analyzeRes) : analyzeRes;
            shouldRedact = analysis.needs_redaction;
            bottomPct = analysis.redaction_percentage || 0.15; // Default to 15%
            pagesToRedact = [1]; 
        }

        if (!shouldRedact) {
            await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, { redacted: true });
            return Response.json({ status: "skipped", reason: "No target section detected" });
        }
        
        // 3. Apply Redaction
        for (const pageNum of pagesToRedact) {
            if (pageNum < 1 || pageNum > allPages.length) continue;
            const page = allPages[pageNum - 1];
            const { width, height } = page.getSize();
            const rotation = page.getRotation().angle;
            
            // Calculate coordinates based on rotation to always cover VISUAL BOTTOM
            let x = 0, y = 0, w = 0, h = 0;

            if (rotation === 0) {
                // Standard: Bottom is y=0
                x = 0; y = 0; w = width; h = height * bottomPct;
            } else if (rotation === 90) {
                // 90 deg clockwise: Visual Bottom is Physical Right (x=width)
                x = width * (1 - bottomPct); y = 0; w = width * bottomPct; h = height;
            } else if (rotation === 180) {
                // 180 deg: Visual Bottom is Physical Top (y=height)
                x = 0; y = height * (1 - bottomPct); w = width; h = height * bottomPct;
            } else if (rotation === 270 || rotation === -90) {
                // 270 deg clockwise: Visual Bottom is Physical Left (x=0)
                x = 0; y = 0; w = width * bottomPct; h = height;
            } else {
                // Fallback
                x = 0; y = 0; w = width; h = height * bottomPct;
            }

            // Draw BLACK rectangle (Permanent Redaction)
            page.drawRectangle({
                x, y, width: w, height: h,
                color: rgb(0, 0, 0), // BLACK
                opacity: 1,
            });
        }

        // 4. Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        // Unique filename to bypass cache
        const randomStr = Math.random().toString(36).substring(7);
        const fileName = `redacted_${invoice.invoice_number || 'doc'}_${Date.now()}_${randomStr}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
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
            cutoff_percentage: bottomPct
        });

    } catch (error) {
        console.error("Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});