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

        // Download PDF to get page count
        const pdfResponse = await fetch(targetUrl);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const allPages = pdfDoc.getPages();

        if (vendorName.includes('henry') || vendorName.includes('schein')) {
            // STRATEGY A: Force Redaction for Henry Schein (No LLM)
            // Cut bottom 25% (keep top 75%)
            shouldRedact = true;
            topPct = 0.75; 
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
        
        // 3. Apply Redaction
        // pdf-lib coords: (0,0) is bottom-left.
        // topPct is from top (0.0). 
        // cutoffY = height * (1 - topPct)
        
        for (const pageNum of pagesToRedact) {
            if (pageNum < 1 || pageNum > allPages.length) continue;
            const page = allPages[pageNum - 1];
            const { width, height } = page.getSize();
            
            const cutoffY = height * (1 - topPct); 
            
            // Draw white rectangle from bottom up
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: cutoffY + 5, // Small buffer
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
            cutoff_percentage: topPct
        });

    } catch (error) {
        console.error("Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});