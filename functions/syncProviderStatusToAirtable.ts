import { createClientFromRequest } from 'npm:@base44/sdk@0.8.3';

const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY");
const BASE_ID = "appwLeODexurgpElt";
const TABLE_NAME = "Staff";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        
        // This function is intended to be triggered by an entity automation
        // Payload structure: { event: { type, entity_name, entity_id }, data: { ... }, old_data: { ... } }

        const { data, old_data, event } = payload;

        // Only proceed if it's an update and status has changed
        if (event?.type !== 'update' || !data || !old_data) {
            return Response.json({ message: "Not an update event or missing data, skipping." });
        }

        if (data.status === old_data.status) {
            return Response.json({ message: "Status did not change, skipping Airtable sync." });
        }

        const email = data.email;
        const newStatus = data.status;

        if (!email) {
            return Response.json({ error: "Provider has no email, cannot sync." }, { status: 400 });
        }

        console.log(`Syncing status change for ${email} to '${newStatus}' in Airtable...`);

        // 1. Find the record in Airtable by Work Email
        // Airtable API filterByFormula: {Work Email} = 'email'
        const filterFormula = `{Work Email} = '${email}'`;
        const listUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}`;

        const listRes = await fetch(listUrl, {
            headers: {
                "Authorization": `Bearer ${AIRTABLE_API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!listRes.ok) {
            const err = await listRes.text();
            throw new Error(`Failed to list Airtable records: ${err}`);
        }

        const listData = await listRes.json();

        if (listData.records.length === 0) {
            console.log(`No Airtable record found for email: ${email}`);
            return Response.json({ message: "No matching Airtable record found." });
        }

        const recordId = listData.records[0].id;
        console.log(`Found Airtable record ${recordId} for ${email}. Updating status...`);

        // 2. Update the record's Status field
        // Note: Airtable Select fields are case-sensitive. Assuming 'Status' in Airtable matches app values
        // or we might need to map them. App: 'active', 'inactive', 'pending'.
        // Capitalizing first letter to match common Airtable conventions if needed, 
        // but user said "Status" is the field. Often Airtable select options are capitalized.
        // Let's try sending it as is first, or maybe Title Case. 
        // "Active", "Inactive", "Pending" are common. App uses lowercase.
        
        // Simple mapping to Title Case just in case
        const airtableStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1); 

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
            const err = await updateRes.text();
            throw new Error(`Failed to update Airtable record: ${err}`);
        }

        const updateData = await updateRes.json();

        return Response.json({ 
            success: true, 
            message: `Successfully updated Airtable record ${recordId} status to ${airtableStatus}`,
            airtable_record: updateData 
        });

    } catch (error) {
        console.error("Error syncing to Airtable:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});