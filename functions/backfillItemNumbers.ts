import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * One-time admin-only backfill function.
 * For each SupplyOrder, looks up any line item where item_number is blank/null,
 * then fills it from the matching Supply catalog record (matched by supply_id or supply_name).
 * Also applies a specific known correction: Sharpie Retractable Permanent Marker → 271674.
 */

const KNOWN_CORRECTIONS = [
  {
    match: (item) => item.supply_name && item.supply_name.toLowerCase().includes("sharpie retractable permanent marker"),
    item_number: "271674",
  },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  // Load all supply catalog records for lookup
  const supplies = await base44.asServiceRole.entities.Supply.list();
  const supplyById = {};
  const supplyByName = {};
  for (const s of supplies) {
    if (s.id) supplyById[s.id] = s;
    if (s.product_name) supplyByName[s.product_name.toLowerCase().trim()] = s;
  }

  // Load all orders
  const orders = await base44.asServiceRole.entities.SupplyOrder.list();

  let totalFixed = 0;
  let totalOrders = 0;

  for (const order of orders) {
    if (!order.items || order.items.length === 0) continue;

    let changed = false;
    const updatedItems = order.items.map(item => {
      // Skip if item_number already set
      if (item.item_number && item.item_number.trim() !== "") return item;

      // 1. Try known hardcoded corrections first
      for (const correction of KNOWN_CORRECTIONS) {
        if (correction.match(item)) {
          totalFixed++;
          changed = true;
          return { ...item, item_number: correction.item_number };
        }
      }

      // 2. Try supply_id lookup
      if (item.supply_id && supplyById[item.supply_id]?.item_number) {
        totalFixed++;
        changed = true;
        return { ...item, item_number: supplyById[item.supply_id].item_number };
      }

      // 3. Try supply_name lookup
      if (item.supply_name) {
        const catalogMatch = supplyByName[item.supply_name.toLowerCase().trim()];
        if (catalogMatch?.item_number) {
          totalFixed++;
          changed = true;
          return { ...item, item_number: catalogMatch.item_number };
        }
      }

      return item;
    });

    if (changed) {
      totalOrders++;
      await base44.asServiceRole.entities.SupplyOrder.update(order.id, { items: updatedItems });
    }
  }

  return Response.json({
    success: true,
    orders_updated: totalOrders,
    line_items_fixed: totalFixed,
    message: `Backfill complete. Updated ${totalFixed} line items across ${totalOrders} orders.`
  });
});