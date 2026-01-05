import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { file_url, folder_id } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        // Auth check removed for public app
        // const user = await base44.auth.me();

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
        const extractionResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
            file_url: file_url,
            json_schema: extractionSchema
        });

        if (extractionResult.status === 'error') {
            console.error("Extraction failed:", extractionResult.details);
            return Response.json({ error: `Extraction failed: ${extractionResult.details || 'Unknown error'}` }, { status: 400 });
        }

        const data = extractionResult.output;

        // Check for duplicates
        if (data.invoice_number) {
            const existing = await base44.asServiceRole.entities.VendorInvoice.filter({ invoice_number: data.invoice_number });
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
        const invoice = await base44.asServiceRole.entities.VendorInvoice.create({
            vendor_name: normalizedVendorName,
            location: data.location,
            invoice_number: data.invoice_number,
            invoice_date: data.invoice_date,
            due_date: data.due_date,
            total_amount: data.total_amount || 0,
            status: 'approved', // Auto-approve as requested
            document_url: file_url,
            extracted_data: data, // Store full extraction including line items
            folder_id: folder_id || null
        });

        // 4. Auto-Link to Supply Order
        // Always attempt to link/create supply orders
        try {
            let matchedOrder = null;

            // Determine Target Entity based on Vendor
            let TargetEntity = base44.asServiceRole.entities.SupplyOrder;
            let isAudiology = false;

            if (normalizedVendorName.toLowerCase().includes('oaktree')) {
                TargetEntity = base44.asServiceRole.entities.AudiologySupplyOrder;
                isAudiology = true;
            }

            // A1. Try direct lookup by order number first (most reliable)
            if (data.invoice_number) {
                const byNumber = await TargetEntity.filter({ order_number: data.invoice_number });
                if (byNumber && byNumber.length > 0) {
                    matchedOrder = byNumber[0];
                }
            }

            // A2. If not found, fall back to recent list scan (fuzzy match)
            if (!matchedOrder) {
                const recentOrders = await TargetEntity.list('-created_date', 200);
                
                matchedOrder = recentOrders.find(order => {
                    const vendorMatch = (order.vendor || '').toLowerCase().includes(normalizedVendorName.toLowerCase()) || 
                                        normalizedVendorName.toLowerCase().includes((order.vendor || '').toLowerCase());
                    
                    if (!vendorMatch) return false;

                    const amountMatch = Math.abs((order.total_amount || 0) - (data.total_amount || 0)) < 0.1;
                    return amountMatch;
                });
            }

            if (matchedOrder) {
                console.log(`Matched existing order ${matchedOrder.order_number} for invoice ${invoice.invoice_number}`);
                
                // Update existing order
                await TargetEntity.update(matchedOrder.id, {
                    status: 'received',
                });

                // Link invoice
                await base44.asServiceRole.entities.VendorInvoice.update(invoice.id, {
                    linked_supply_order_ids: [matchedOrder.id]
                });

            } else {
                console.log(`No match found. Creating new Supply Order for ${invoice.invoice_number}`);
                
                // Determine Category
                const OFFICE_VENDORS = ['staples', 'amazon', 'wb mason', 'u-line', 'uline', 'quill'];
                const isOffice = OFFICE_VENDORS.some(v => normalizedVendorName.toLowerCase().includes(v));
                const category = isOffice ? 'office' : 'clinical';

                // B. Create new Supply Order
                const supplyOrderItems = (data.line_items || []).map(item => ({
                    supply_name: item.description || 'Unknown Item',
                    item_number: item.item_code || '',
                    quantity: item.quantity || 0,
                    unit_price: item.unit_price || 0,
                    line_total: item.total_price || 0,
                    received: true
                }));

                const newOrderData = {
                    order_number: data.invoice_number || `AUTO-${Date.now()}`,
                    vendor: normalizedVendorName,
                    location: data.location || 'Glastonbury', // Default if unknown
                    order_date: data.invoice_date || new Date().toISOString().split('T')[0],
                    status: 'received',
                    order_type: 'order',
                    items: supplyOrderItems,
                    total_amount: data.total_amount || 0,
                    notes: `Auto-generated from Import of Invoice #${data.invoice_number}`
                };

                // Add category only if it's the standard SupplyOrder entity
                if (!isAudiology) {
                    newOrderData.category = category;
                }

                const newOrder = await TargetEntity.create(newOrderData);

                // Link invoice
                await base44.asServiceRole.entities.VendorInvoice.update(invoice.id, {
                    linked_supply_order_ids: [newOrder.id]
                });
            }

        } catch (linkError) {
            console.error("Auto-link error:", linkError);
            // Don't fail the whole request if linking fails
        }

        // Trigger Redaction for single uploads
        try {
            // Await redaction so the user sees the redacted file immediately
            const redactRes = await base44.asServiceRole.functions.invoke('redactInvoice', { invoice_id: invoice.id });
            
            // If redaction returned a new URL, update our local invoice object before returning
            if (redactRes && redactRes.data && redactRes.data.new_url) {
                invoice.document_url = redactRes.data.new_url;
                invoice.redacted = true;
            }
        } catch (err) {
            console.error("Failed to trigger redaction:", err);
        }

        return Response.json({ success: true, invoice });

    } catch (error) {
        console.error('Error processing invoice:', error);
        // Return 400 for known errors to avoid "Internal Server Error"
        return Response.json({ error: error.message }, { status: 400 });
    }
});