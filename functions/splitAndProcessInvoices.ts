import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Auth Check - SKIPPED for public app
        // We will use service role for operations since there are no logged-in users.
        // const user = await base44.auth.me();

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
        // We ask for specific metadata + page ranges + line items
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `
            I have a PDF file that contains one or more invoices merged together. 
            The file has ${totalPages} pages.
            
            Your task is to identify the start and end page numbers for EACH distinct invoice in this file, AND extract detailed line items for each invoice.
            
            Please analyze the document and return a JSON object with an 'invoices' array.
            Each item in the array must represent one invoice and contain:
            - vendor_name (string)
            - invoice_number (string)
            - invoice_date (string, YYYY-MM-DD format if possible)
            - total_amount (number)
            - start_page (integer, 1-based index)
            - end_page (integer, 1-based index)
            - line_items (array of objects):
              - description (string)
              - item_code (string, if visible)
              - quantity (number)
              - unit_price (number)
              - total_price (number)
            
            Rules:
            1. The page ranges must be contiguous and non-overlapping.
            2. Every page from 1 to ${totalPages} should theoretically be covered, unless there are blank divider pages.
            3. Be precise with page ranges.
            4. Extract line items as accurately as possible.
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
                                end_page: { type: "integer" },
                                location_name: { type: "string", enum: ["Glastonbury", "Manchester", "Bloomfield", "Farmington"], description: "The location address/name found on the invoice (shipping address)" },
                                line_items: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            description: { type: "string" },
                                            item_code: { type: "string" },
                                            quantity: { type: "number" },
                                            unit_price: { type: "number" },
                                            total_price: { type: "number" }
                                        }
                                    }
                                }
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
            
            // Create a File object from the bytes
            // Deno supports standard Web API File objects
            const fileName = `split_invoice_${inv.invoice_number || 'unknown'}_${Date.now()}.pdf`;
            const fileObj = new File([pdfBytes], fileName, { type: 'application/pdf' });

            const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
                file: fileObj
            });

            if (uploadRes && uploadRes.file_url) {
                // Check for duplicates
                let isDuplicate = false;
                if (inv.invoice_number) {
                    const existing = await base44.asServiceRole.entities.VendorInvoice.filter({ invoice_number: inv.invoice_number });
                    // Simple check: if any existing invoice has this number and similar vendor name
                    if (existing && existing.length > 0) {
                         const normalizedNewVendor = (inv.vendor_name || '').toLowerCase();
                         const duplicateMatch = existing.find(ex => 
                             (ex.vendor_name || '').toLowerCase().includes(normalizedNewVendor) || 
                             normalizedNewVendor.includes((ex.vendor_name || '').toLowerCase())
                         );
                         
                         if (duplicateMatch) {
                             console.log(`Skipping duplicate invoice: ${inv.invoice_number}`);
                             isDuplicate = true;
                         }
                    }
                }

                if (!isDuplicate) {
                    // Create the Entity
                    const isHenrySchein = (inv.vendor_name?.toLowerCase().includes('henry schein') || inv.vendor_name?.toLowerCase().includes('henry shrine'));
                    const status = isHenrySchein ? 'approved' : 'pending_review';

                    const invoiceData = {
                        vendor_name: inv.vendor_name || 'Unknown Vendor',
                        invoice_number: inv.invoice_number || `AUTO-${Date.now()}`,
                        invoice_date: inv.invoice_date, // Might need validation/formatting
                        total_amount: inv.total_amount,
                        status: status,
                        location: inv.location_name, // Extracted location
                        document_url: uploadRes.file_url,
                        notes: `Auto-split from multi-page PDF. Pages ${inv.start_page}-${inv.end_page}.`,
                        extracted_data: inv
                    };

                    const record = await base44.asServiceRole.entities.VendorInvoice.create(invoiceData);
                    
                    // If Henry Schein, auto-create a Clinical Supply Order
                    if (isHenrySchein && record) {
                        try {
                            const supplyOrderItems = (inv.line_items || []).map(item => ({
                                supply_name: item.description || 'Unknown Item',
                                item_number: item.item_code || '',
                                quantity: item.quantity || 0,
                                unit_price: item.unit_price || 0,
                                line_total: item.total_price || 0,
                                received: true // Auto-mark received since it's an invoice
                            }));

                            // If we have items, create the order
                            if (supplyOrderItems.length > 0) {
                                const supplyOrderData = {
                                    order_number: inv.invoice_number || `AUTO-CLINICAL-${Date.now()}`,
                                    vendor: inv.vendor_name || 'Henry Schein',
                                    location: inv.location_name || 'Glastonbury', // Default if missing, but hopefully extracted
                                    order_date: inv.invoice_date || new Date().toISOString().split('T')[0],
                                    status: 'received',
                                    category: 'clinical',
                                    items: supplyOrderItems,
                                    total_amount: inv.total_amount || 0,
                                    notes: `Auto-created from Vendor Invoice #${inv.invoice_number}`
                                };

                                const createdOrder = await base44.asServiceRole.entities.SupplyOrder.create(supplyOrderData);
                                
                                // Link back to invoice
                                if (createdOrder) {
                                    await base44.asServiceRole.entities.VendorInvoice.update(record.id, {
                                        linked_supply_order_ids: [createdOrder.id]
                                    });
                                }
                            }
                        } catch (err) {
                            console.error("Failed to auto-create clinical supply order:", err);
                            // Don't fail the whole process, just log it
                        }
                    }

                    results.push(record);
                }
            }
        }

        return Response.json({ 
            success: true, 
            processed_count: results.length,
            invoices: results
        });

    } catch (error) {
        console.error('Error splitting PDF:', error);
        const status = error.status || 500;
        return Response.json({ error: error.message }, { status });
    }
});