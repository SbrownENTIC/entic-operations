import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Admin-only backfill + audit function.
 *
 * Strategy for resolving blank item_numbers on order line items:
 *   1. Hardcoded known corrections (name-fragment → item_number)
 *   2. Exact supply_id lookup in catalog
 *   3. Exact product_name match (case-insensitive, trimmed)
 *   4. Partial/prefix match: does the order item name start with the catalog name
 *      stripped of any trailing parenthetical suffix like "(TR58090)"?
 *
 * After patching, returns a full audit of any STILL-blank item_numbers so
 * admins can see what remains.
 */

// Hard-coded corrections for cases where name matching is unreliable.
// Key: substring of supply_name (lowercased), Value: item_number to assign
const HARDCODED = [
  {
    match: (n) => n.includes("sharpie retractable permanent marker") && n.includes("ultra fine"),
    item_number: "271674",
  },
  {
    match: (n) => n.includes("staples standard staples") && (n.includes("1/4") || n.includes("5000")),
    item_number: "24418183",
  },
];

/**
 * Strip trailing parenthetical code from a catalog product name, e.g.:
 *   "Staples Standard Staples, 1/4\" Leg Length, 5000/Box (TR58090)" → "Staples Standard Staples, 1/4\" Leg Length, 5000/Box"
 */
function stripCatalogSuffix(name) {
  return name.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  // ------------------------------------------------------------------
  // Build catalog lookup maps
  // ------------------------------------------------------------------
  const supplies = await base44.asServiceRole.entities.Supply.list();
  const byId = {};           // supply.id → supply
  const byExactName = {};    // lower-trimmed product_name → supply
  const byStrippedName = {}; // lower-trimmed stripped product_name → supply

  for (const s of supplies) {
    if (!s.item_number) continue; // catalog entry itself has no item_number — skip
    if (s.id) byId[s.id] = s;
    if (s.product_name) {
      const exact = s.product_name.toLowerCase().trim();
      byExactName[exact] = s;
      const stripped = stripCatalogSuffix(s.product_name).toLowerCase().trim();
      if (stripped !== exact) byStrippedName[stripped] = s;
    }
  }

  // ------------------------------------------------------------------
  // Iterate orders
  // ------------------------------------------------------------------
  const orders = await base44.asServiceRole.entities.SupplyOrder.list();

  let totalFixed = 0;
  let totalOrdersUpdated = 0;
  const stillMissing = []; // items we couldn't resolve

  for (const order of orders) {
    if (!order.items || order.items.length === 0) continue;

    let changed = false;
    const updatedItems = order.items.map(item => {
      // Already has an item_number — skip
      if (item.item_number && item.item_number.trim() !== "") return item;

      const nameLower = (item.supply_name || "").toLowerCase().trim();

      // 1. Hardcoded corrections
      for (const hc of HARDCODED) {
        if (hc.match(nameLower)) {
          totalFixed++;
          changed = true;
          return { ...item, item_number: hc.item_number };
        }
      }

      // 2. supply_id lookup
      if (item.supply_id && byId[item.supply_id]) {
        totalFixed++;
        changed = true;
        return { ...item, item_number: byId[item.supply_id].item_number };
      }

      // 3. Exact name match
      if (nameLower && byExactName[nameLower]) {
        totalFixed++;
        changed = true;
        return { ...item, item_number: byExactName[nameLower].item_number };
      }

      // 4. Stripped-suffix name match
      if (nameLower && byStrippedName[nameLower]) {
        totalFixed++;
        changed = true;
        return { ...item, item_number: byStrippedName[nameLower].item_number };
      }

      // Could not resolve — record for audit
      stillMissing.push({
        order_id: order.id,
        order_number: order.order_number || order.id,
        order_date: order.order_date,
        vendor: order.vendor,
        supply_name: item.supply_name || "(blank)",
        supply_id: item.supply_id || null,
      });
      return item;
    });

    if (changed) {
      totalOrdersUpdated++;
      await base44.asServiceRole.entities.SupplyOrder.update(order.id, { items: updatedItems });
    }
  }

  // Deduplicate stillMissing by supply_name for a clean audit list
  const missingByName = {};
  for (const m of stillMissing) {
    const key = m.supply_name;
    if (!missingByName[key]) missingByName[key] = { ...m, occurrences: 0 };
    missingByName[key].occurrences++;
  }

  return Response.json({
    success: true,
    orders_updated: totalOrdersUpdated,
    line_items_fixed: totalFixed,
    message: `Backfill complete. Fixed ${totalFixed} line items across ${totalOrdersUpdated} orders.`,
    still_missing_item_number: Object.values(missingByName).sort((a, b) => b.occurrences - a.occurrences),
    still_missing_count: stillMissing.length,
  });
});