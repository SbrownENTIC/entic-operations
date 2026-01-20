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
                invoice_number: { type: "string", description: "The unique invoice number. For 'Reliant Compounded Solutions', use the 'Order #' as the invoice number." },
                invoice_date: { type: "string", format: "date", description: "YYYY-MM-DD format" },
                due_date: { type: "string", format: "date", description: "YYYY-MM-DD format" },
                packlist_number: { type: "string", description: "Packlist No. from the invoice (specifically for Grace Medical)" },
                order_number: { type: "string", description: "Order No. from the invoice (specifically for Grace Medical or Reliant Compounded Solutions)" },
                location: { type: "string", enum: ["Glastonbury", "Manchester", "Bloomfield", "Farmington"], description: "The location/office name found in the Ship To address. Look for keywords: Glastonbury, Manchester, Bloomfield, Farmington. Default to Glastonbury if not found." },
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
                            total_price: { type: "number" },
                            lot_number: { type: "string", description: "Lot No. or Batch number if available" }
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

        let billedTo = 'ENTIC';
        if (normalizedVendorName.toLowerCase().includes('oaktree')) {
            billedTo = 'The Hearing Institute';
        }
        
        // Grace Medical specific logic
        if (normalizedVendorName.toLowerCase().includes('grace medical')) {
            billedTo = 'ENTIC';
        }

        // Reliant Compounded Solutions specific logic
        if (normalizedVendorName.toLowerCase().includes('reliant') || normalizedVendorName.toLowerCase().includes('compounded solutions')) {
            billedTo = 'ENTIC';
            // Ensure vendor name is consistent
            if (!normalizedVendorName.toLowerCase().includes('reliant compounded solutions')) {
                 // If it captures just 'Reliant' or similar, try to normalize if confident, 
                 // or rely on the extracted name if it's close enough.
            }
        }

        // 3. Create the VendorInvoice record
        const invoiceData = {
            vendor_name: normalizedVendorName,
            location: data.location,
            invoice_number: data.invoice_number,
            invoice_date: data.invoice_date,
            due_date: data.due_date,
            total_amount: data.total_amount || 0,
            billed_to: billedTo,
            status: 'approved', // Auto-approve as requested
            document_url: file_url,
            extracted_data: data, // Store full extraction including line items
            folder_id: folder_id || null
        };

        if (data.packlist_number) invoiceData.packlist_number = data.packlist_number;
        if (data.order_number) invoiceData.order_number = data.order_number;

        const invoice = await base44.asServiceRole.entities.VendorInvoice.create(invoiceData);

        // 4. Auto-Link to Supply Order
        // Always attempt to link/create supply orders
        try {
            let matchedOrder = null;

            // Determine Category and Target Entity
            let TargetEntity = base44.asServiceRole.entities.SupplyOrder;
            let category = 'office'; // Default
            
            const OFFICE_VENDORS = ['staples', 'amazon', 'wb mason', 'u-line', 'uline', 'quill'];
            const normalizedVendorLower = normalizedVendorName.toLowerCase();

            if (normalizedVendorLower.includes('oaktree')) {
                TargetEntity = base44.asServiceRole.entities.AudiologySupplyOrder;
                category = 'audiology';
            } else if (OFFICE_VENDORS.some(v => normalizedVendorLower.includes(v))) {
                category = 'office';
            } else {
                category = 'clinical';
            }

            // 0. Ensure Items exist in Catalog (for Clinical and Audiology)
            if ((category === 'clinical' || category === 'audiology') && data.line_items && data.line_items.length > 0) {
                try {
                    for (const item of data.line_items) {
                        if (!item.description) continue; // Description is required, item_code is optional

                        // Try to find by item_number first if available, otherwise by name
                        let existingItems = [];
                        if (item.item_code) {
                            existingItems = await base44.asServiceRole.entities.Supply.filter({
                                item_number: item.item_code,
                                category: category
                            });
                        }
                        
                        // Fallback to name check if no code match or no code provided
                        if (existingItems.length === 0) {
                            existingItems = await base44.asServiceRole.entities.Supply.filter({
                                product_name: item.description,
                                category: category
                            });
                        }

                        if (existingItems.length === 0) {
                            console.log(`Auto-adding new ${category} supply: ${item.description}`);
                            await base44.asServiceRole.entities.Supply.create({
                                item_number: item.item_code || '',
                                product_name: item.description,
                                unit_price: item.unit_price || 0,
                                vendor: normalizedVendorName,
                                category: category,
                                units: 'each'
                            });
                        } else {
                            // Update price if different
                            const existingItem = existingItems[0];
                            if (item.unit_price > 0 && Math.abs(item.unit_price - (existingItem.unit_price || 0)) > 0.01) {
                                await base44.asServiceRole.entities.Supply.update(existingItem.id, {
                                    unit_price: item.unit_price
                                });
                            }
                            // Update item_number if missing in catalog but present in invoice
                            if (item.item_code && !existingItem.item_number) {
                                await base44.asServiceRole.entities.Supply.update(existingItem.id, {
                                    item_number: item.item_code
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error auto-adding supplies:", err);
                    // Don't block flow
                }
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
                
                // B. Create new Supply Order
                const supplyOrderItems = (data.line_items || []).map(item => ({
                    supply_name: item.description || 'Unknown Item',
                    item_number: item.item_code || '',
                    quantity: item.quantity || 0,
                    unit_price: item.unit_price || 0,
                    line_total: item.total_price || 0,
                    received: true,
                    lot_number: item.lot_number || null
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
                if (category !== 'audiology') {
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