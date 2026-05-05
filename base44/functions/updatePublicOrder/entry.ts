import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { id, data } = await req.json();
        
        if (!id || !data) {
            return Response.json({ error: "Missing id or data" }, { status: 400 });
        }

        const order = await base44.asServiceRole.entities.SupplyOrder.get(id);
        
        if (!order) {
            return Response.json({ error: "Order not found" }, { status: 404 });
        }

        // Only "open" orders can be updated via the public form
        if (order.status !== 'open') {
            return Response.json({ error: "Only open draft orders can be edited" }, { status: 403 });
        }

        const updated = await base44.asServiceRole.entities.SupplyOrder.update(id, data);

        // If transitioning to pending_review, send notification email
        if (data.status === 'pending_review') {
            const items = data.items || order.items || [];
            const location = data.location || order.location;
            const notes = data.notes || order.notes || '';
            const hasFlags = (data.review_flags || order.review_flags || []).length > 0;

            const recipientEmail = Deno.env.get('APPROVAL_EMAIL') || 'hollyjo@enticmd.com';
            const itemList = items.map(item =>
                `<li>${item.supply_name}${item.item_number ? ` (Item# ${item.item_number})` : ''} — Qty: ${item.quantity}</li>`
            ).join('');

            const emailBody = `
                <h2>New Supply Request Submitted — ${location}</h2>
                ${hasFlags ? '<p><strong style="color:orange;">⚠ This order has been flagged for review.</strong></p>' : ''}
                <h3>Items:</h3>
                <ul>${itemList}</ul>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                <p>Please review this request in the ENTIC Operations Center.</p>
            `;

            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: recipientEmail,
                    subject: `Supply Request Submitted — ${location}`,
                    body: emailBody
                });
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
            }
        }
        
        return Response.json(updated);
    } catch (error) {
        console.error('Error updating public order:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});