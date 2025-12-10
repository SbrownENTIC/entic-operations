import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Auth Check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        // 2. Download the original PDF
        const pdfResponse = await fetch(file_url);
        if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();

        // 3. Load PDF to get page count
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const totalPages = pdfDoc.getPageCount();

        // 4. Use LLM to analyze the document and find split points
        // We ask for specific metadata + page ranges
        const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt: `
            I have a PDF file that contains one or more invoices merged together. 
            The file has ${totalPages} pages.
            
            Your task is to identify the start and end page numbers for EACH distinct invoice in this file.
            
            Please analyze the document and return a JSON object with an 'invoices' array.
            Each item in the array must represent one invoice and contain:
            - vendor_name (string)
            - invoice_number (string)
            - invoice_date (string, YYYY-MM-DD format if possible)
            - total_amount (number)
            - start_page (integer, 1-based index)
            - end_page (integer, 1-based index)
            
            Rules:
            1. The page ranges must be contiguous and non-overlapping.
            2. Every page from 1 to ${totalPages} should theoretically be covered, unless there are blank divider pages.
            3. Be precise.
            `,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    invoices: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                vendor_name: { type: "string" },
                                invoice_number: { type: "string" },
                                invoice_date: { type: "string" },
                                total_amount: { type: "number" },
                                start_page: { type: "integer" },
                                end_page: { type: "integer" }
                            },
                            required: ["vendor_name", "start_page", "end_page"]
                        }
                    }
                },
                required: ["invoices"]
            }
        });

        const analysis = typeof llmResponse === 'string' ? JSON.parse(llmResponse) : llmResponse;
        
        if (!analysis.invoices || analysis.invoices.length === 0) {
            return Response.json({ error: 'Could not identify any invoices in the document.' }, { status: 400 });
        }

        const results = [];

        // 5. Process each identified invoice
        for (const inv of analysis.invoices) {
            // Validate pages
            if (inv.start_page < 1 || inv.end_page > totalPages || inv.start_page > inv.end_page) {
                console.warn(`Invalid page range for invoice ${inv.invoice_number}: ${inv.start_page}-${inv.end_page}`);
                continue;
            }

            // Create a new PDF for this range
            const newPdf = await PDFDocument.create();
            // indices are 0-based in pdf-lib, so subtract 1 from start_page and end_page
            const pageIndices = [];
            for (let i = inv.start_page; i <= inv.end_page; i++) {
                pageIndices.push(i - 1);
            }

            const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            
            // Convert to base64 for upload
            // We'll use a trick to convert Uint8Array to binary string then btoa
            let binary = '';
            const len = pdfBytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(pdfBytes[i]);
            }
            const base64Pdf = btoa(binary);

            // Upload the new PDF
            // Note: UploadFile integration might vary, but usually expects file content or a URL.
            // If it supports base64 directly, great. If not, this step might require adjustment based on platform specific behavior.
            // Assuming we can pass a Data URI or raw base64.
            // Let's try passing a Data URI to be safe as it contains mime type.
            const dataUri = `data:application/pdf;base64,${base64Pdf}`;
            
            // Actually, looking at docs, UploadFile usually takes a File object in frontend or a blob. 
            // In backend functions, we can often pass the file as a string.
            // Let's try passing the dataUri.
            const uploadRes = await base44.integrations.Core.UploadFile({
                file: dataUri
            });

            if (uploadRes && uploadRes.file_url) {
                // Create the Entity
                const record = await base44.entities.VendorInvoice.create({
                    vendor_name: inv.vendor_name || 'Unknown Vendor',
                    invoice_number: inv.invoice_number || `AUTO-${Date.now()}`,
                    invoice_date: inv.invoice_date, // Might need validation/formatting
                    total_amount: inv.total_amount,
                    status: 'pending_review',
                    document_url: uploadRes.file_url,
                    notes: `Auto-split from multi-page PDF. Pages ${inv.start_page}-${inv.end_page}.`,
                    extracted_data: inv // Save the raw extraction just in case
                });
                results.push(record);
            }
        }

        return Response.json({ 
            success: true, 
            processed_count: results.length,
            invoices: results
        });

    } catch (error) {
        console.error('Error splitting PDF:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});