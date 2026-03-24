import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY");
const BASE_ID = "appwLeODexurgpElt";
const TABLE_NAME = "Staff";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // check auth
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { provider_ids } = await req.json();

        if (!provider_ids || !Array.isArray(provider_ids) || provider_ids.length === 0) {
            return Response.json({ error: "No provider IDs provided" }, { status: 400 });
        }

        const results = {
            success: [],
            failed: [],
            skipped: []
        };

        for (const providerId of provider_ids) {
            try {
                // Fetch provider data
                const provider = await base44.entities.Provider.get(providerId);
                
                if (!provider) {
                    results.failed.push({ id: providerId, reason: "Provider not found" });
                    continue;
                }

                const email = provider.email;
                const status = provider.status;

                if (!email) {
                    results.failed.push({ id: providerId, name: provider.full_name, reason: "No email" });
                    continue;
                }

                // 1. Find the record in Airtable by Work Email
                const filterFormula = `LOWER({Work Email}) = '${email.toLowerCase()}'`;
                const listUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}`;

                const listRes = await fetch(listUrl, {
                    headers: {
                        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!listRes.ok) {
                    throw new Error(`Failed to list Airtable records: ${await listRes.text()}`);
                }

                const listData = await listRes.json();

                if (listData.records.length === 0) {
                    results.skipped.push({ id: providerId, name: provider.full_name, reason: "No matching Airtable record found for email" });
                    continue;
                }

                const recordId = listData.records[0].id;
                
                // 2. Update the record's Status field
                // Capitalize first letter (e.g. "active" -> "Active")
                const airtableStatus = status.charAt(0).toUpperCase() + status.slice(1); 

                const updateUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;
                const updateBody = {
                    fields: {
                        "Status": airtableStatus
                    }
                };

                const updateRes = await fetch(updateUrl, {
                    method: "PATCH",
                    headers: {
                        "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(updateBody)
                });

                if (!updateRes.ok) {
                    throw new Error(`Failed to update Airtable record: ${await updateRes.text()}`);
                }

                results.success.push({ id: providerId, name: provider.full_name, status: airtableStatus });

            } catch (err) {
                console.error(`Error syncing provider ${providerId}:`, err);
                results.failed.push({ id: providerId, reason: err.message });
            }
        }

        return Response.json(results);

    } catch (error) {
        console.error("Error in manualSyncProvidersToAirtable:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});