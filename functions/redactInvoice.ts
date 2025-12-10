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

        // 2. Ask LLM to find the "Cut-off Line"
        // We look for the "Code Status Key" / "Invoice Total" strip.
        const analyzeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `
            Analyze this invoice PDF page(s).
            I need to redact everything located BELOW the summary strip to hide the footer containing sensitive distribution info.
            
            I need to redact the footer section that contains sensitive distribution information.
            
            1. Look for a horizontal strip containing "Code Status Key" OR "Invoice Total".
            2. Look for "Distribution Names" or "Distribution Address".
            3. Look for ANY content at the very bottom that looks like internal routing codes or a list of names/addresses.
            
            Return a JSON object:
            - "needs_redaction": boolean (true if you found any footer content to redact, or if you are unsure but it looks like a standard invoice with a footer)
            - "pages": array of integers (1-based page numbers to redact, usually all pages have this footer)
            - "redaction_start_y_percentage": number (The Y-coordinate where the sensitive footer BEGINS, as a percentage from the TOP of the page (0.0 to 1.0). e.g. 0.75 means the footer starts at 75% down the page.)
            
            CRITICAL: The user wants to cut MORE off the bottom.
            1. Look for "Distribution Names" or "Distribution Address" or "Please remit payments to". If found, start redaction WELL ABOVE these lines.
            2. Look for the row of boxes containing "Ship To#" / "Bill To#" / "Invoice#". If found, start redaction AT THE TOP EDGE of this row (usually around 70% down).
            3. If you see "Code Status Key", start redaction ABOVE that line.
            4. If unsure, default to 0.70 (redact the entire bottom 30% of the page to be safe).
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

        // Parse result
        const analysis = typeof analyzeRes === 'string' ? JSON.parse(analyzeRes) : analyzeRes;

        if (!analysis.needs_redaction) {
            await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, { redacted: true });
            return Response.json({ status: "skipped", reason: "No target section detected" });
        }

        // 3. Download and Redact
        const pdfResponse = await fetch(targetUrl);
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const pagesToRedact = analysis.pages || [1];
        
        // Y-coordinate logic in pdf-lib is from BOTTOM (0,0 is bottom-left)
        // LLM gives us percentage from TOP (0.0 is top, 1.0 is bottom).
        // So "redaction_start_y_percentage" of 0.85 means 85% down from top.
        // In pdf-lib Y terms: height * (1 - 0.85) = height * 0.15 is the Y coordinate of the line.
        // We want to cover everything BELOW that line. So from y=0 to y=height * (1 - pct).
        
        const topPct = analysis.redaction_start_y_percentage || 0.70;

        for (const pageNum of pagesToRedact) {
            if (pageNum < 1 || pageNum > pages.length) continue;
            const page = pages[pageNum - 1];
            const { width, height } = page.getSize();
            
            const cutoffY = height * (1 - topPct); // Convert top-down % to bottom-up Y coordinate
            
            // Draw white rectangle from bottom (0) up to the cutoff line
            // Adding a small buffer (5 points) to ensure clean cut
            page.drawRectangle({
                x: 0,
                y: 0, // Start at bottom
                width: width,
                height: cutoffY + 5, // Cover up to the line
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