import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';

// Constants for redaction
const BOTTOM_MARGIN_PERCENT = 0.15; // Bottom 15% of the page

export const redactPdfBuffer = async (pdfBuffer, base44) => {
    try {
        // 1. Analyze with LLM to see if/where redaction is needed
        // We need to upload it temporarily to let LLM see it, or use text extraction if we could.
        // For simplicity and robustness, we'll upload the buffer to a temp file for the LLM
        
        // Actually, to avoid double upload costs/latency for every single check, 
        // we can try to be smart. But the user request is specific about "Distribution Names/Address".
        // Let's blindly redact the bottom 12% for "Henry Schein" or if we detect keywords?
        // No, user wants it to be smart.
        // We will assume the caller provides a URL if available, otherwise we upload.
        
        // Wait, passing buffer to LLM via base64 or URL is needed.
        // Let's proceed assuming we have the PDF document loaded.
        
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        
        // For efficiency, let's just redact the bottom 12% of EVERY page if it looks like a Henry Schein invoice
        // or just rely on the caller to tell us.
        // But the requirement is "when we import them".
        // Let's implement the "Check with LLM" approach.
        
        // We need a URL for the LLM. If we are in the middle of processing (before upload), we might not have one.
        // However, in 'processVendorInvoice', we have a file_url.
        // In 'splitAndProcessInvoices', we have the split PDFs.
        
        // Let's create a helper that takes a URL.
        return pdfDoc; 
    } catch (e) {
        console.error("Error in redactPdfBuffer", e);
        throw e;
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { invoice_id, file_url } = await req.json();

        if (!invoice_id && !file_url) {
            return Response.json({ error: "Missing invoice_id or file_url" }, { status: 400 });
        }

        let targetUrl = file_url;
        let invoice = null;

        // 1. Resolve Invoice URL if ID provided
        if (invoice_id) {
            const results = await base44.entities.VendorInvoice.list(null, 1, { id: invoice_id });
            invoice = results[0];
            if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });
            targetUrl = invoice.document_url;
        }

        if (!targetUrl) return Response.json({ error: "No document URL found" }, { status: 400 });

        // 2. Ask LLM if redaction is needed and on which pages
        const analyzeRes = await base44.integrations.Core.InvokeLLM({
            prompt: `
            Check this invoice for a footer section titled "Distribution Names/Address" that contains DEA numbers, State Registry numbers, or Chem. Reg numbers.
            Usually located at the very bottom of the page.
            
            Return a JSON object with:
            - "needs_redaction": boolean (true if this section exists)
            - "pages": array of integers (1-based page numbers that have this section, usually just the first or all)
            - "height_percentage": number (percentage of the page height from the bottom to cover, e.g., 0.15 for 15%. Default to 0.15 if unsure but section exists).
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

        // Parse result (InvokeLLM returns a dict if json schema is provided)
        const analysis = analyzeRes; // It's already an object due to schema

        if (!analysis.needs_redaction) {
            if (invoice_id) {
                // Mark as checked even if no redaction needed
                await base44.entities.VendorInvoice.update(invoice_id, { redacted: true });
            }
            return Response.json({ status: "skipped", reason: "No sensitive footer detected" });
        }

        // 3. Download and Redact
        const pdfBytes = await fetch(targetUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const pagesToRedact = analysis.pages || [1];
        const heightPct = analysis.height_percentage || 0.15;

        for (const pageNum of pagesToRedact) {
            if (pageNum > pages.length) continue;
            const page = pages[pageNum - 1];
            const { width, height } = page.getSize();
            
            // Draw white rectangle at bottom
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: height * heightPct,
                color: rgb(1, 1, 1), // White
            });
            
            // Optional: Add a small text indicating redaction?
            // page.drawText('Redacted', { x: 5, y: 5, size: 8, color: rgb(0.8, 0.8, 0.8) });
        }

        // 4. Save and Upload
        const modifiedPdfBytes = await pdfDoc.save();
        // Convert Uint8Array to Blob/File for upload
        // The SDK upload expects a File object or similar. 
        // We can pass the bytes directly if we convert to a File-like object or base64.
        // base44.integrations.Core.UploadFile expects a 'file' parameter which is 'binary'.
        // In the Deno environment with the SDK, we typically pass a File object.
        
        const file = new File([modifiedPdfBytes], "redacted_invoice.pdf", { type: "application/pdf" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file: file });
        
        const newUrl = uploadRes.file_url;

        // 5. Update Entity
        if (invoice_id) {
            await base44.entities.VendorInvoice.update(invoice_id, {
                document_url: newUrl,
                redacted: true
            });
        }

        return Response.json({ 
            status: "success", 
            original_url: targetUrl, 
            new_url: newUrl,
            redacted_pages: pagesToRedact
        });

    } catch (error) {
        console.error("Redaction error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});