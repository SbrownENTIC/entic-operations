import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Normalizes item_number values across Supply catalog and SupplyOrder line items.
 * - Detects catalog items whose item_number, when parsed as an integer, matches
 *   a canonical item_number in the same catalog (i.e. "41302" vs "041302").
 * - Fixes all affected SupplyOrder line items.
 * - dry_run=true reports what would change without writing.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run = body.dry_run !== false; // default to dry_run=true for safety

    // ── 1. Load the full office catalog ────────────────────────────────────
    const allSupplies = await base44.asServiceRole.entities.Supply.filter({ category: 'office' });

    // Build a map: normalized (trimmed) item_number → supply record
    // We use the canonical form = the item_number that starts with a leading zero
    // (or whichever is the "correct" form as stored in the catalog).
    // Strategy: for each pair where parseInt(a) === parseInt(b), the one with more
    // digits / leading zeros is canonical.
    const byIntValue = {}; // int value → array of supply records
    for (const s of allSupplies) {
      if (!s.item_number) continue;
      const trimmed = String(s.item_number).trim();
      const asInt = parseInt(trimmed, 10);
      if (isNaN(asInt)) continue; // non-numeric item numbers are fine as-is
      if (!byIntValue[asInt]) byIntValue[asInt] = [];
      byIntValue[asInt].push({ ...s, item_number: trimmed });
    }

    // Find groups with >1 distinct string representation
    const catalogFixes = []; // { from, to, supply_id }
    const canonicalMap = {}; // from_item_number → canonical_item_number

    for (const [, group] of Object.entries(byIntValue)) {
      if (group.length < 2) continue;
      // Canonical = longest string (most leading zeros preserved)
      const sorted = [...group].sort((a, b) => b.item_number.length - a.item_number.length);
      const canonical = sorted[0].item_number;
      for (const s of sorted.slice(1)) {
        if (s.item_number !== canonical) {
          catalogFixes.push({ supply_id: s.id, from: s.item_number, to: canonical, product_name: s.product_name });
          canonicalMap[s.item_number] = canonical;
        }
      }
    }

    // Also catch single-record items whose number could be a stripped version
    // of an existing canonical (e.g. "41302" when "041302" exists but they're separate records)
    // — build a simpler map: stripped int → canonical from the above pass
    // then check ALL supplies against it
    for (const s of allSupplies) {
      if (!s.item_number) continue;
      const trimmed = String(s.item_number).trim();
      const canonical = canonicalMap[trimmed];
      // already handled above
      if (!canonical && byIntValue[parseInt(trimmed, 10)]?.length === 1) continue;
    }

    // ── 2. Load all office supply orders ───────────────────────────────────
    const allOrders = await base44.asServiceRole.entities.SupplyOrder.filter({ category: 'office' });

    const orderFixes = []; // { order_id, order_number, items_fixed: [{index, from, to}] }

    for (const order of allOrders) {
      const items = order.items || [];
      const fixes = [];
      const newItems = items.map((item, idx) => {
        if (!item.item_number) return item;
        const canonical = canonicalMap[String(item.item_number).trim()];
        if (canonical && canonical !== item.item_number) {
          fixes.push({ index: idx, from: item.item_number, to: canonical, supply_name: item.supply_name });
          return { ...item, item_number: canonical };
        }
        return item;
      });

      if (fixes.length > 0) {
        orderFixes.push({ order_id: order.id, order_number: order.order_number, items_fixed: fixes });
        if (!dry_run) {
          await base44.asServiceRole.entities.SupplyOrder.update(order.id, { items: newItems });
        }
      }
    }

    // ── 3. Fix Supply catalog records ──────────────────────────────────────
    if (!dry_run) {
      for (const fix of catalogFixes) {
        await base44.asServiceRole.entities.Supply.update(fix.supply_id, { item_number: fix.to });
      }
    }

    return Response.json({
      success: true,
      dry_run,
      catalog_fixes: catalogFixes.length,
      order_fixes: orderFixes.length,
      line_items_fixed: orderFixes.reduce((sum, o) => sum + o.items_fixed.length, 0),
      canonical_mappings: canonicalMap,
      catalog_details: catalogFixes,
      order_details: orderFixes,
      message: dry_run
        ? `DRY RUN: Would normalize ${catalogFixes.length} catalog records and fix ${orderFixes.reduce((s,o)=>s+o.items_fixed.length,0)} order line items.`
        : `Normalized ${catalogFixes.length} catalog records and fixed ${orderFixes.reduce((s,o)=>s+o.items_fixed.length,0)} order line items.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});