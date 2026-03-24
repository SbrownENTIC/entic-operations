import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Admin-only: Comprehensive catalog alignment + backfill.
 *
 * Pass { dry_run: true } to audit without writing.
 * Pass { dry_run: false } (default) to apply all fixes.
 *
 * Resolution order for a blank item_number:
 *   1. Hard-coded corrections table (handles known historical name variants)
 *   2. Exact supply_id catalog lookup
 *   3. Exact product_name match (case-insensitive, trimmed)
 *   4. Stripped-suffix match  (strips trailing " (CODE)" from catalog names)
 *   5. Keyword match: order name starts with stripped catalog name (≥ 10 chars)
 */

// ─── Hard-coded corrections ────────────────────────────────────────────────
// Each entry: { match: fn(nameLower) => bool, item_number, canonical_name? }
// Add new entries here whenever a historical name variant is identified.
const CORRECTIONS = [
  // Sharpie
  {
    match: n => n.includes("sharpie retractable permanent marker") && n.includes("ultra fine"),
    item_number: "271674",
  },
  // Staples Standard Staples
  {
    match: n => n.includes("staples standard staples") && (n.includes("1/4") || n.includes("5000")),
    item_number: "24418183",
  },
  // Bounty Essentials Select-A-Size (various name lengths in old orders)
  {
    match: n => n.includes("bounty essentials select-a-size") || n.includes("bounty essentials select a size"),
    item_number: "24413085",
  },
  // Softsoap Fresh Citrus 6/Carton (different from 11.25oz single)
  {
    match: n => n.includes("softsoap") && n.includes("fresh citrus") && (n.includes("6/carton") || n.includes("6 carton")),
    item_number: "24567949",
  },
  // BIC Round Stic Xtra-Life 60/Pack
  {
    match: n => n.includes("bic round stic") && (n.includes("60/pack") || n.includes("60 pack") || n.includes("xtra-life") || n.includes("xtra life")),
    item_number: "24440955",
  },
  // Angel Soft Compact Recycled Coreless 36 Rolls
  {
    match: n => n.includes("angel soft") && n.includes("compact") && n.includes("recycled") && n.includes("750"),
    item_number: "24515195",
  },
  // Coastwide Recycled Toilet Paper 48 Rolls
  {
    match: n => n.includes("coastwide") && n.includes("recycled toilet paper") && (n.includes("48 rolls") || n.includes("48/case") || n.includes("360 sheets")),
    item_number: "24463153",
  },
  // Scotch Magic Tape
  {
    match: n => n.includes("scotch") && n.includes("magic tape") && !n.includes("12"),
    item_number: "24347031",
  },
  // Post-it Notes 3x3 yellow
  {
    match: n => n.includes("post-it") && n.includes("3") && n.includes("yellow") && !n.includes("super sticky"),
    item_number: "508315",
  },
  // Kleenex Professional 12 Boxes
  {
    match: n => n.includes("kleenex") && n.includes("professional") && (n.includes("12 boxes") || n.includes("12/carton") || n.includes("125 tissues")),
    item_number: "24347486",
  },
  // Arm & Hammer Air Freshener
  {
    match: n => n.includes("arm & hammer") && n.includes("air freshener"),
    item_number: "24412599",
  },
  // LYSOL Disinfectant Spray Crisp Linen
  {
    match: n => n.includes("lysol") && n.includes("disinfectant spray") && n.includes("crisp linen"),
    item_number: "24430820",
  },
  // Coastwide Recycled 550 sheets 80 rolls
  {
    match: n => n.includes("coastwide") && n.includes("recycled toilet paper") && (n.includes("80 rolls") || n.includes("550 sheets")),
    item_number: "24463154",
  },
  // Scott Essential JRT
  {
    match: n => n.includes("scott essential") && n.includes("jrt"),
    item_number: "24463155",
  },
  // Staples Jumbo Paper Clips 1000
  {
    match: n => n.includes("staples jumbo paper clips") && (n.includes("1000") || n.includes("10/pack")),
    item_number: "24347031",
  },
  // Staples 2-Pocket Plastic Folder
  {
    match: n => n.includes("staples 2-pocket plastic presentation folder") || (n.includes("staples") && n.includes("2-pocket") && n.includes("plastic")),
    item_number: "24362525",
  },
  // Staples Comfort Grip Tape Dispenser
  {
    match: n => n.includes("comfort grip tape dispenser"),
    item_number: "24421765",
  },
  // Staples Washable Glue Sticks 18/Pack
  {
    match: n => n.includes("staples washable glue sticks") && n.includes("18"),
    item_number: "24362524",
  },
  // Softsoap Fresh Citrus 6/Carton (variant)
  {
    match: n => n.includes("softsoap") && n.includes("fresh citrus") && n.includes("6/carton"),
    item_number: "24397022",
  },
  // Swingline SF4 staples
  {
    match: n => n.includes("swingline") && n.includes("s.f. 4") && (n.includes("1/4") || n.includes("5000")),
    item_number: "35464",
  },
];

// ─── Helper: strip trailing "(CODE)" suffix from catalog product names ─────
function stripSuffix(name) {
  return name.replace(/\s*\([^)]+\)\s*$/, "").replace(/™/g, "").trim();
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run === true;

  // ── Build catalog lookup maps ─────────────────────────────────────────────
  const supplies = await base44.asServiceRole.entities.Supply.list();
  const byId = {};
  const byExact = {};
  const byStripped = {};
  const byItemNumber = {};

  for (const s of supplies) {
    if (s.id) byId[s.id] = s;
    if (s.item_number) byItemNumber[s.item_number] = s;
    if (s.product_name) {
      const e = s.product_name.toLowerCase().trim();
      byExact[e] = s;
      const stripped = stripSuffix(s.product_name).toLowerCase().trim();
      if (stripped !== e) byStripped[stripped] = s;
    }
  }

  // ── Iterate all orders ────────────────────────────────────────────────────
  const orders = await base44.asServiceRole.entities.SupplyOrder.list();

  let fixedCount = 0;
  let ordersUpdated = 0;
  const stillMissing = {};  // supply_name → { occurrences, supply_id, example_order }
  const fixLog = [];

  for (const order of orders) {
    if (!order.items?.length) continue;

    let changed = false;
    const updatedItems = order.items.map(item => {
      if (item.item_number?.trim()) return item; // already has one

      const nameLower = (item.supply_name || "").toLowerCase().trim();
      let resolved = null;
      let method = null;

      // 1. Hard-coded corrections
      for (const c of CORRECTIONS) {
        if (c.match(nameLower)) { resolved = c.item_number; method = "hardcoded"; break; }
      }

      // 2. supply_id lookup
      if (!resolved && item.supply_id && byId[item.supply_id]?.item_number) {
        resolved = byId[item.supply_id].item_number;
        method = "supply_id";
      }

      // 3. Exact name match
      if (!resolved && nameLower && byExact[nameLower]?.item_number) {
        resolved = byExact[nameLower].item_number;
        method = "exact_name";
      }

      // 4. Stripped-suffix match
      if (!resolved && nameLower && byStripped[nameLower]?.item_number) {
        resolved = byStripped[nameLower].item_number;
        method = "stripped_name";
      }

      // 5. Keyword prefix match (order name starts with stripped catalog name)
      if (!resolved && nameLower.length >= 10) {
        for (const [stripped, s] of Object.entries(byStripped)) {
          if (s.item_number && stripped.length >= 10 && nameLower.startsWith(stripped)) {
            resolved = s.item_number;
            method = "prefix_match";
            break;
          }
        }
      }

      if (resolved) {
        fixedCount++;
        changed = true;
        fixLog.push({
          order_number: order.order_number || order.id,
          supply_name: item.supply_name,
          item_number: resolved,
          method,
        });
        return { ...item, item_number: resolved };
      }

      // Could not resolve
      const key = item.supply_name || "(blank)";
      if (!stillMissing[key]) {
        stillMissing[key] = { supply_name: key, supply_id: item.supply_id || null, occurrences: 0, example_order: order.order_number || order.id };
      }
      stillMissing[key].occurrences++;
      return item;
    });

    if (changed && !dryRun) {
      ordersUpdated++;
      await base44.asServiceRole.entities.SupplyOrder.update(order.id, { items: updatedItems });
    } else if (changed && dryRun) {
      ordersUpdated++; // count as "would update"
    }
  }

  const missingList = Object.values(stillMissing).sort((a, b) => b.occurrences - a.occurrences);

  return Response.json({
    success: true,
    dry_run: dryRun,
    orders_updated: ordersUpdated,
    line_items_fixed: fixedCount,
    message: dryRun
      ? `DRY RUN: Would fix ${fixedCount} line items across ${ordersUpdated} orders.`
      : `Fixed ${fixedCount} line items across ${ordersUpdated} orders.`,
    still_missing_count: Object.values(stillMissing).reduce((s, v) => s + v.occurrences, 0),
    still_missing: missingList,
    fix_log: dryRun ? fixLog : [],
  });
});