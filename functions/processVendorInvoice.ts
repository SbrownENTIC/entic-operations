import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Define schema for extraction
        const extractionSchema = {
            type: "object",
            properties: {
                vendor_name: { type: "string" },
                invoice_number: { type: "string" },
                invoice_date: { type: "string", format: "date", description: "YYYY-MM-DD format" },
                due_date: { type: "string", format: "date", description: "YYYY-MM-DD format" },
                location: { type: "string", enum: ["Glastonbury", "Manchester", "Bloomfield", "Farmington"], description: "The location/office name found in the Ship To address. Look for keywords: Glastonbury, Manchester, Bloomfield, Farmington." },
                ship_to_text: { type: "string", description: "The full raw text of the 'Ship To' address block for debugging" },
                total_amount: { type: "number" },
                line_items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            item_code: { type: "string" },
                            description: { type: "string" },
                            quantity: { type: "number" },
                            unit_price: { type: "number" },
                            total_price: { type: "number" }
                        }
                    }
                }
            },
            required: ["vendor_name", "total_amount"]
        };

        // 2. Extract data using AI
        const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: file_url,
            json_schema: extractionSchema
        });

        if (extractionResult.status === 'error') {
            throw new Error(extractionResult.details || 'Failed to extract data');
        }

        const data = extractionResult.output;

        // Check for duplicates
        if (data.invoice_number) {
            const existing = await base44.entities.VendorInvoice.filter({ invoice_number: data.invoice_number });
            if (existing && existing.length > 0) {
                const normalizedNewVendor = (data.vendor_name || '').toLowerCase();
                const duplicateMatch = existing.find(ex => 
                    (ex.vendor_name || '').toLowerCase().includes(normalizedNewVendor) || 
                    normalizedNewVendor.includes((ex.vendor_name || '').toLowerCase())
                );
                
                if (duplicateMatch) {
                    return Response.json({ error: `Duplicate invoice detected: Invoice #${data.invoice_number} for ${data.vendor_name} already exists.` }, { status: 409 });
                }
            }
        }

        // Helper to Title Case vendor name
        const normalizeVendor = (name) => {
            if (!name) return 'Unknown Vendor';
            return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        const normalizedVendorName = normalizeVendor(data.vendor_name);

        // 3. Create the VendorInvoice record
        const invoice = await base44.entities.VendorInvoice.create({
            vendor_name: normalizedVendorName,
            location: data.location,
            invoice_number: data.invoice_number,
            invoice_date: data.invoice_date,
            due_date: data.due_date,
            total_amount: data.total_amount || 0,
            status: 'order_placed',
            document_url: file_url,
            extracted_data: data // Store full extraction including line items
        });

        return Response.json({ success: true, invoice });

    } catch (error) {
        console.error('Error processing invoice:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});