import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PricingMetricsTable from "./PricingMetricsTable";

/**
 * Flattens all items from office supply orders into a single list,
 * enriched with order-level fields (order_date, vendor, location).
 * Only includes orders within the provided dateRange.
 */
function buildLineItems(orders, dateRange) {
  const items = [];
  for (const order of orders) {
    if (!order.order_date) continue;
    const orderDate = new Date(order.order_date);
    if (dateRange.start && orderDate < new Date(dateRange.start)) continue;
    if (dateRange.end && orderDate > new Date(dateRange.end)) continue;

    for (const item of (order.items || [])) {
      items.push({
        item_number:  item.item_number  || "(no item #)",
        supply_name:  item.supply_name  || item.item_number || "(unknown)",
        quantity:     Number(item.quantity   || 0),
        unit_price:   Number(item.unit_price || 0),
        line_total:   Number(item.line_total || (item.quantity * item.unit_price) || 0),
        order_date:   order.order_date,
        vendor:       order.vendor || "(unknown)",
        location:     order.location || "(unknown)",
        order_id:     order.id,
        order_number: order.order_number || order.id,
      });
    }
  }
  return items;
}

/** Group line items by item_number, returning a sorted array of aggregated rows. */
function groupByItemNumber(lineItems) {
  const map = {};
  for (const li of lineItems) {
    const key = li.item_number;
    if (!map[key]) {
      map[key] = {
        item_number: key,
        supply_name: li.supply_name,
        totalSpend: 0,
        totalQty: 0,
        orderCount: 0,
        vendors: new Set(),
        vendorPrices: {},
        minPrice: null,
        maxPrice: null,
        minPriceDate: null,
        maxPriceDate: null,
      };
    }
    const g = map[key];
    g.totalSpend += li.line_total;
    g.totalQty   += li.quantity;
    g.orderCount += 1;
    g.vendors.add(li.vendor);
    if (!g.vendorPrices[li.vendor]) g.vendorPrices[li.vendor] = [];
    g.vendorPrices[li.vendor].push(li.unit_price);

    // Track min/max unit price with dates (skip $0 prices)
    if (li.unit_price > 0) {
      if (g.minPrice === null || li.unit_price < g.minPrice) {
        g.minPrice = li.unit_price;
        g.minPriceDate = li.order_date;
      }
      if (g.maxPrice === null || li.unit_price > g.maxPrice) {
        g.maxPrice = li.unit_price;
        g.maxPriceDate = li.order_date;
      }
    }
  }

  return Object.values(map).map(g => {
    const priceVariance = (g.minPrice !== null && g.maxPrice !== null && g.minPrice > 0)
      ? ((g.maxPrice - g.minPrice) / g.minPrice) * 100
      : null;
    return {
      ...g,
      avgUnitCost: g.totalQty > 0 ? g.totalSpend / g.totalQty : 0,
      vendors: [...g.vendors],
      priceVariance,
    };
  });
}

/** Group line items by month (YYYY-MM) returning sorted chart data. */
function groupByMonth(lineItems) {
  const map = {};
  for (const li of lineItems) {
    const month = li.order_date.substring(0, 7); // YYYY-MM
    if (!map[month]) map[month] = { month, spend: 0 };
    map[month].spend += li.line_total;
  }
  return Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => ({ ...r, label: format(parseISO(r.month + "-01"), "MMM yy") }));
}

const fmt = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function exportCSV(rows, filename) {
  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? "");
      return s.includes(",") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
}

export default function OfficeSupplyAnalytics({ orders = [], supplies = [], dateRange = {} }) {
  const [activeSection, setActiveSection] = useState("spend");

  // Build a catalog lookup map: item_number → canonical product_name
  const catalogNameMap = useMemo(() => {
    const map = {};
    for (const s of supplies) {
      if (s.item_number && s.product_name) {
        map[String(s.item_number).trim()] = s.product_name;
      }
    }
    return map;
  }, [supplies]);

  const lineItems = useMemo(() => buildLineItems(orders, dateRange), [orders, dateRange]);

  // Override supply_name from catalog where available
  const lineItemsWithCatalogNames = useMemo(() =>
    lineItems.map(li => ({
      ...li,
      supply_name: catalogNameMap[li.item_number] || li.supply_name,
    })),
  [lineItems, catalogNameMap]);

  const grouped   = useMemo(() => groupByItemNumber(lineItemsWithCatalogNames), [lineItemsWithCatalogNames]);
  const byMonth   = useMemo(() => groupByMonth(lineItemsWithCatalogNames), [lineItemsWithCatalogNames]);

  // Sorted views
  const bySpend   = useMemo(() => [...grouped].sort((a, b) => b.totalSpend - a.totalSpend), [grouped]);
  const byQty     = useMemo(() => [...grouped].sort((a, b) => b.totalQty - a.totalQty), [grouped]);
  const byAvgCost = useMemo(() => [...grouped].sort((a, b) => b.avgUnitCost - a.avgUnitCost), [grouped]);
  const top10     = useMemo(() => byQty.slice(0, 10), [byQty]);

  // Vendor comparison: items ordered from >1 vendor
  const multiVendor = useMemo(() =>
    grouped.filter(g => g.vendors.length > 1).sort((a, b) => b.vendors.length - a.vendors.length),
  [grouped]);

  // CSV exports
  const exportSpend = () => {
    const rows = [
      ["Office Supply Analytics — Total Spend by Item"],
      ["Item #", "Product", "Total Spend", "Total Qty", "Avg Unit Cost", "Order Count"],
      ...bySpend.map(g => [g.item_number, g.supply_name, g.totalSpend.toFixed(2), g.totalQty, g.avgUnitCost.toFixed(2), g.orderCount])
    ];
    exportCSV(rows, "office_supply_spend_by_item");
  };

  const exportMonthly = () => {
    const rows = [
      ["Office Supply Analytics — Monthly Spend Trend"],
      ["Month", "Total Spend"],
      ...byMonth.map(r => [r.label, r.spend.toFixed(2)])
    ];
    exportCSV(rows, "office_supply_monthly_trend");
  };

  const exportTop10 = () => {
    const rows = [
      ["Office Supply Analytics — Top 10 Most Ordered Items"],
      ["Rank", "Item #", "Product", "Total Qty", "Total Spend", "Avg Unit Cost"],
      ...top10.map((g, i) => [i + 1, g.item_number, g.supply_name, g.totalQty, g.totalSpend.toFixed(2), g.avgUnitCost.toFixed(2)])
    ];
    exportCSV(rows, "office_supply_top10");
  };

  const exportVendorComparison = () => {
    const rows = [["Office Supply Analytics — Vendor Comparison"], ["Item #", "Product", "Vendor", "Avg Unit Price", "Times Ordered"]];
    for (const g of multiVendor) {
      for (const vendor of g.vendors) {
        const prices = g.vendorPrices[vendor] || [];
        const avg = prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;
        rows.push([g.item_number, g.supply_name, vendor, avg.toFixed(2), prices.length]);
      }
    }
    exportCSV(rows, "office_supply_vendor_comparison");
  };

  const byPriceVariance = useMemo(() =>
    [...grouped].filter(g => g.priceVariance !== null).sort((a, b) => b.priceVariance - a.priceVariance),
  [grouped]);

  const exportPricing = () => {
    const fmtDate = (d) => d ? format(parseISO(d), "MM/dd/yyyy") : "";
    const rows = [
      ["Office Supply Analytics — Pricing Metrics by Item"],
      ["Item #", "Product", "Total Qty", "Total Spend", "Avg Unit Cost", "Min Unit Price", "Min Price Date", "Max Unit Price", "Max Price Date", "Price Variance %"],
      ...grouped.sort((a, b) => (b.priceVariance ?? -1) - (a.priceVariance ?? -1)).map(g => [
        g.item_number, g.supply_name, g.totalQty, g.totalSpend.toFixed(2),
        g.avgUnitCost.toFixed(2),
        g.minPrice !== null ? g.minPrice.toFixed(2) : "",
        fmtDate(g.minPriceDate),
        g.maxPrice !== null ? g.maxPrice.toFixed(2) : "",
        fmtDate(g.maxPriceDate),
        g.priceVariance !== null ? g.priceVariance.toFixed(1) + "%" : "N/A",
      ])
    ];
    exportCSV(rows, "office_supply_pricing_metrics");
  };

  const sections = [
    { key: "spend",   label: "Total Spend by Item" },
    { key: "qty",     label: "Quantity Ordered" },
    { key: "avg",     label: "Avg Unit Cost" },
    { key: "pricing", label: "Pricing Metrics" },
    { key: "trend",   label: "Monthly Trend" },
    { key: "top10",   label: "Top 10 Items" },
    { key: "vendor",  label: "Vendor Comparison" },
  ];

  const TableHeader = ({ cols }) => (
    <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
      <tr>{cols.map(c => <th key={c.key} className={`p-3 text-sm font-semibold text-slate-700 ${c.right ? "text-right" : "text-left"}`}>{c.label}</th>)}</tr>
    </thead>
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle>Office Supply Analytics</CardTitle>
        <p className="text-sm text-slate-500 mt-1">Item-level reporting grouped by Item # — date range applies from the filter above</p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">

        {/* Section nav */}
        <div className="flex flex-wrap gap-2">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                activeSection === s.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 1. Total Spend by Item */}
        {activeSection === "spend" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Total Spend by Item ({grouped.length} items)</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={exportSpend}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            <div className="overflow-auto max-h-[480px] border rounded-lg">
              <table className="w-full text-sm">
                <TableHeader cols={[
                  { key: "num", label: "Item #" },
                  { key: "name", label: "Product" },
                  { key: "spend", label: "Total Spend", right: true },
                  { key: "qty", label: "Qty Ordered", right: true },
                  { key: "avg", label: "Avg Unit Cost", right: true },
                  { key: "cnt", label: "Orders", right: true },
                ]} />
                <tbody>
                  {bySpend.map((g, i) => (
                    <tr key={g.item_number} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                      <td className="p-3 font-mono text-xs text-slate-600">{g.item_number}</td>
                      <td className="p-3 text-slate-900">{g.supply_name}</td>
                      <td className="p-3 text-right font-semibold text-green-700">{fmt(g.totalSpend)}</td>
                      <td className="p-3 text-right text-slate-700">{g.totalQty.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(g.avgUnitCost)}</td>
                      <td className="p-3 text-right text-slate-500">{g.orderCount}</td>
                    </tr>
                  ))}
                  {bySpend.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No data in selected date range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Quantity Ordered */}
        {activeSection === "qty" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Total Quantity Ordered by Item</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                exportCSV([
                  ["Office Supply Analytics — Quantity Ordered by Item"],
                  ["Item #", "Product", "Total Qty", "Total Spend", "Avg Unit Cost"],
                  ...byQty.map(g => [g.item_number, g.supply_name, g.totalQty, g.totalSpend.toFixed(2), g.avgUnitCost.toFixed(2)])
                ], "office_supply_qty_by_item");
              }}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            <div className="overflow-auto max-h-[480px] border rounded-lg">
              <table className="w-full text-sm">
                <TableHeader cols={[
                  { key: "num", label: "Item #" },
                  { key: "name", label: "Product" },
                  { key: "qty", label: "Total Qty", right: true },
                  { key: "spend", label: "Total Spend", right: true },
                  { key: "avg", label: "Avg Unit Cost", right: true },
                ]} />
                <tbody>
                  {byQty.map((g, i) => (
                    <tr key={g.item_number} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                      <td className="p-3 font-mono text-xs text-slate-600">{g.item_number}</td>
                      <td className="p-3 text-slate-900">{g.supply_name}</td>
                      <td className="p-3 text-right font-semibold text-blue-700">{g.totalQty.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(g.totalSpend)}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(g.avgUnitCost)}</td>
                    </tr>
                  ))}
                  {byQty.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No data in selected date range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Avg Unit Cost */}
        {activeSection === "avg" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Average Unit Cost per Item</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                exportCSV([
                  ["Office Supply Analytics — Average Unit Cost by Item"],
                  ["Item #", "Product", "Avg Unit Cost", "Total Qty", "Total Spend"],
                  ...byAvgCost.map(g => [g.item_number, g.supply_name, g.avgUnitCost.toFixed(2), g.totalQty, g.totalSpend.toFixed(2)])
                ], "office_supply_avg_unit_cost");
              }}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            <div className="overflow-auto max-h-[480px] border rounded-lg">
              <table className="w-full text-sm">
                <TableHeader cols={[
                  { key: "num", label: "Item #" },
                  { key: "name", label: "Product" },
                  { key: "avg", label: "Avg Unit Cost", right: true },
                  { key: "qty", label: "Total Qty", right: true },
                  { key: "spend", label: "Total Spend", right: true },
                ]} />
                <tbody>
                  {byAvgCost.map((g, i) => (
                    <tr key={g.item_number} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                      <td className="p-3 font-mono text-xs text-slate-600">{g.item_number}</td>
                      <td className="p-3 text-slate-900">{g.supply_name}</td>
                      <td className="p-3 text-right font-semibold text-purple-700">{fmt(g.avgUnitCost)}</td>
                      <td className="p-3 text-right text-slate-600">{g.totalQty.toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-600">{fmt(g.totalSpend)}</td>
                    </tr>
                  ))}
                  {byAvgCost.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No data in selected date range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Pricing Metrics */}
        {activeSection === "pricing" && (
          <PricingMetricsTable
            grouped={grouped}
            lineItems={lineItems}
            onExport={exportPricing}
          />
        )}

        {/* 5. Monthly Spend Trend */}
        {activeSection === "trend" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Monthly Spend Trend</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={exportMonthly}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            {byMonth.length === 0 ? (
              <p className="text-slate-400 py-8 text-center">No data in selected date range.</p>
            ) : (
              <>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byMonth} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Bar dataKey="spend" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Total Spend" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-auto max-h-64 border rounded-lg">
                  <table className="w-full text-sm">
                    <TableHeader cols={[{ key: "month", label: "Month" }, { key: "spend", label: "Total Spend", right: true }]} />
                    <tbody>
                      {[...byMonth].reverse().map((r, i) => (
                        <tr key={r.month} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                          <td className="p-3 text-slate-700">{r.label}</td>
                          <td className="p-3 text-right font-semibold text-green-700">{fmt(r.spend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* 5. Top 10 */}
        {activeSection === "top10" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Top 10 Most Ordered Items (by Quantity)</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={exportTop10}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            {top10.length === 0 ? (
              <p className="text-slate-400 py-8 text-center">No data in selected date range.</p>
            ) : (
              <>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="item_number" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip formatter={(v, name, props) => [v + " units", props.payload.supply_name]} />
                      <Bar dataKey="totalQty" fill="#6366f1" radius={[0, 3, 3, 0]} name="Qty" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <TableHeader cols={[
                      { key: "rank", label: "#" },
                      { key: "num", label: "Item #" },
                      { key: "name", label: "Product" },
                      { key: "qty", label: "Total Qty", right: true },
                      { key: "spend", label: "Total Spend", right: true },
                      { key: "avg", label: "Avg Unit Cost", right: true },
                    ]} />
                    <tbody>
                      {top10.map((g, i) => (
                        <tr key={g.item_number} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                          <td className="p-3 text-slate-500 font-bold">#{i + 1}</td>
                          <td className="p-3 font-mono text-xs text-slate-600">{g.item_number}</td>
                          <td className="p-3 text-slate-900">{g.supply_name}</td>
                          <td className="p-3 text-right font-semibold text-indigo-700">{g.totalQty.toLocaleString()}</td>
                          <td className="p-3 text-right text-slate-600">{fmt(g.totalSpend)}</td>
                          <td className="p-3 text-right text-slate-600">{fmt(g.avgUnitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* 6. Vendor Comparison */}
        {activeSection === "vendor" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Vendor Comparison — Items Ordered from Multiple Vendors ({multiVendor.length})</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={exportVendorComparison}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            {multiVendor.length === 0 ? (
              <p className="text-slate-400 py-8 text-center">No items found ordered from multiple vendors in the selected date range.</p>
            ) : (
              <div className="overflow-auto max-h-[520px] border rounded-lg">
                <table className="w-full text-sm">
                  <TableHeader cols={[
                    { key: "num", label: "Item #" },
                    { key: "name", label: "Product" },
                    { key: "vendor", label: "Vendor" },
                    { key: "avg", label: "Avg Unit Price", right: true },
                    { key: "cnt", label: "Times Ordered", right: true },
                  ]} />
                  <tbody>
                    {multiVendor.map((g, gi) =>
                      g.vendors.sort().map((vendor, vi) => {
                        const prices = g.vendorPrices[vendor] || [];
                        const avg = prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;
                        const isFirst = vi === 0;
                        return (
                          <tr key={`${g.item_number}-${vendor}`} className={`border-b border-slate-100 ${gi % 2 === 0 ? "" : "bg-slate-50"}`}>
                            {isFirst && (
                              <>
                                <td className="p-3 font-mono text-xs text-slate-600 align-top" rowSpan={g.vendors.length}>{g.item_number}</td>
                                <td className="p-3 text-slate-900 align-top" rowSpan={g.vendors.length}>{g.supply_name}</td>
                              </>
                            )}
                            <td className="p-3 text-slate-700">{vendor}</td>
                            <td className="p-3 text-right font-semibold text-orange-700">{fmt(avg)}</td>
                            <td className="p-3 text-right text-slate-500">{prices.length}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
}