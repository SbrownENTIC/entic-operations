import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const AIRTABLE_BASE_ID = 'appwLeODexurgpElt';
const ON_CALL_PERIOD_TABLE_ID = 'tbl3o3gNR7ca4rcTW';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action, schedule_id, airtable_record_id } = payload;

    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    if (!airtableApiKey) {
      return Response.json({ error: 'AIRTABLE_API_KEY not configured' }, { status: 500 });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'delete') {
      if (!airtable_record_id) {
        return Response.json({ message: 'No Airtable ID provided for deletion, skipping sync' });
      }
      
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}/${airtable_record_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${airtableApiKey}`
          }
        }
      );
      
      if (!response.ok) {
        const err = await response.text();
        return Response.json({ error: `Airtable Delete Error: ${err}` }, { status: 500 });
      }
      
      return Response.json({ success: true, action: 'deleted' });
    }

    // For Create/Update
    const schedule = await base44.entities.OnCallSchedule.get(schedule_id);
    if (!schedule) return Response.json({ error: 'Schedule not found' }, { status: 404 });

    const provider = await base44.entities.Provider.get(schedule.provider_id);
    const providerName = provider ? provider.full_name : 'Unknown Provider';

    const fields = {
      'Provider': providerName,
      'Start Date': schedule.start_date,
      'End Date': schedule.end_date,
      'Location': schedule.location,
      'Notes': schedule.notes,
      // Add a field to indicate the source or last update
      // 'Last Updated By': user.email 
      // (Only if such field exists, but safe to omit if strict schema isn't enforced or if we guess wrong)
    };

    if (action === 'create') {
      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${airtableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields, typecast: true })
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return Response.json({ error: `Airtable Create Error: ${err}` }, { status: 500 });
      }

      const data = await response.json();
      
      // Save Airtable ID back to Base44
      await base44.entities.OnCallSchedule.update(schedule_id, {
        airtable_record_id: data.id
      });

      return Response.json({ success: true, action: 'created', airtable_id: data.id });
    }

    if (action === 'update') {
      const recordId = schedule.airtable_record_id;
      if (!recordId) {
        // If no ID exists, treat as create
        return Response.json({ message: 'No Airtable ID found on record, consider creating new.' });
        // Or recursively call create logic? Let's just create it.
        // Actually, better to error or handle gracefully.
        // Let's create it.
        const createResponse = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ fields, typecast: true })
            }
          );
    
          if (!createResponse.ok) {
            const err = await createResponse.text();
            return Response.json({ error: `Airtable Create (Fallback) Error: ${err}` }, { status: 500 });
          }
    
          const data = await createResponse.json();
          await base44.entities.OnCallSchedule.update(schedule_id, {
            airtable_record_id: data.id
          });
          
          return Response.json({ success: true, action: 'created_fallback', airtable_id: data.id });
      }

      const response = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}/${recordId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${airtableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields, typecast: true })
        }
      );

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 404) {
            // Record deleted in Airtable? Re-create.
             const createResponse = await fetch(
                `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ON_CALL_PERIOD_TABLE_ID}`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${airtableApiKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ fields, typecast: true })
                }
              );
              if (createResponse.ok) {
                  const data = await createResponse.json();
                  await base44.entities.OnCallSchedule.update(schedule_id, { airtable_record_id: data.id });
                  return Response.json({ success: true, action: 'recreated' });
              }
        }
        return Response.json({ error: `Airtable Update Error: ${err}` }, { status: 500 });
      }

      return Response.json({ success: true, action: 'updated' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});