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

        console.log(`Analyzing invoice ${invoice_id} for redaction...`);

        // 2. Ask LLM if redaction is needed
        // Use a conservative prompt to avoid false negatives
        const analyzeRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `
            Check this invoice specifically for a footer section titled "Distribution Names/Address" or similar that contains DEA numbers, State Registry numbers, or Chem. Reg numbers.
            This is usually at the bottom of the page.
            
            Return a JSON object:
            - "needs_redaction": boolean
            - "pages": array of integers (1-based page numbers to redact)
            - "height_percentage": number (decimal 0.0-1.0, e.g. 0.15 for bottom 15%)
            
            If you are unsure but see DEA numbers at the bottom, say yes.
            `,
            file_urls: [targetUrl],
            response_json_schema: {
                type: "object",
                properties: {
                    needs_redaction: { type: "boolean" },
                    pages: { type: "array", items: { type: "integer" } },
                    height_percentage: { type: "number" }
                }
            }
        });

        // Parse result
        const analysis = typeof analyzeRes === 'string' ? JSON.parse(analyzeRes) : analyzeRes;

        if (!analysis.needs_redaction) {
            // Mark as checked
            await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, { redacted: true });
            return Response.json({ status: "skipped", reason: "No sensitive footer detected" });
        }

        console.log(`Redacting invoice ${invoice_id}:`, analysis);

        // 3. Download and Redact
        const pdfResponse = await fetch(targetUrl);
        if (!pdfResponse.ok) throw new Error("Failed to download PDF");
        
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const pagesToRedact = analysis.pages || [1];
        const heightPct = analysis.height_percentage || 0.15;

        for (const pageNum of pagesToRedact) {
            if (pageNum < 1 || pageNum > pages.length) continue;
            const page = pages[pageNum - 1];
            const { width, height } = page.getSize();
            
            // Draw white rectangle at bottom
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: height * heightPct,
                color: rgb(1, 1, 1),
            });
        }

        // 4. Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        const fileName = `redacted_${invoice.invoice_number || 'doc'}_${Date.now()}.pdf`;
        const file = new File([modifiedPdfBytes], fileName, { type: "application/pdf" });
        
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: file });
        
        if (!uploadRes || !uploadRes.file_url) {
            throw new Error("Failed to upload redacted PDF");
        }
        
        const newUrl = uploadRes.file_url;

        // 5. Update Entity (SAFE UPDATE)
        // Ensure we only update specific fields
        await base44.asServiceRole.entities.VendorInvoice.update(invoice_id, {
            document_url: newUrl,
            redacted: true
        });

        return Response.json({ 
            status: "success", 
            original_url: targetUrl, 
            new_url: newUrl
        });

    } catch (error) {
        console.error("Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});