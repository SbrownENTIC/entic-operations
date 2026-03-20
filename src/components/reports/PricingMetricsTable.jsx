import React, { useState, useMemo, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, X, ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

const fmt = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? format(parseISO(d), "MM/dd/yy") : "—";

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

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-slate-400 inline" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600 inline" />
    : <ChevronDown className="w-3 h-3 ml-1 text-blue-600 inline" />;
}

function SortableTh({ col, label, right, sortKey, sortDir, onSort }) {
  return (
    <th
      className={`p-3 text-sm font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-200 transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}

/** Modal showing all line-item orders for a given item # */
function OrderDrillDownModal({ item, lineItems, onClose }) {
  if (!item) return null;

  const orders = lineItems
    .filter(li => li.item_number === item.item_number)
    .sort((a, b) => b.order_date.localeCompare(a.order_date));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            Orders for: <span className="font-mono text-sm text-slate-600">{item.item_number}</span>
            <span className="ml-2 text-slate-500 font-normal">— {item.supply_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Order #</th>
                <th className="p-3 text-left font-semibold text-slate-700">Vendor</th>
                <th className="p-3 text-left font-semibold text-slate-700">Order Date</th>
                <th className="p-3 text-right font-semibold text-slate-700">Qty</th>
                <th className="p-3 text-right font-semibold text-slate-700">Unit Price</th>
                <th className="p-3 text-right font-semibold text-slate-700">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((li, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                  <td className="p-3">
                    {li.order_id ? (
                      <Link
                        to={`/SupplyOrderDetail?id=${li.order_id}`}
                        className="text-blue-600 hover:underline font-mono text-xs flex items-center gap-1"
                        onClick={onClose}
                      >
                        {li.order_number || li.order_id}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-slate-500">{li.order_number || "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-700">{li.vendor}</td>
                  <td className="p-3 text-slate-600">{li.order_date ? format(parseISO(li.order_date), "MM/dd/yyyy") : "—"}</td>
                  <td className="p-3 text-right text-slate-700">{li.quantity}</td>
                  <td className="p-3 text-right font-semibold text-slate-800">{fmt(li.unit_price)}</td>
                  <td className="p-3 text-right text-green-700">{fmt(li.line_total)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">{orders.length} order line{orders.length !== 1 ? "s" : ""} found</p>
      </DialogContent>
    </Dialog>
  );
}

export default function PricingMetricsTable({ grouped, lineItems, onExport }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("priceVariance");
  const [sortDir, setSortDir] = useState("desc");
  const [drillItem, setDrillItem] = useState(null);

  const handleSort = useCallback((col) => {
    setSortKey(prev => {
      if (prev === col) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return col;
      }
      setSortDir("desc");
      return col;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grouped;
    return grouped.filter(g =>
      g.item_number.toLowerCase().includes(q) ||
      g.supply_name.toLowerCase().includes(q) ||
      g.vendors.some(v => v.toLowerCase().includes(q))
    );
  }, [grouped, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal, bVal;
      switch (sortKey) {
        case "item_number": aVal = a.item_number; bVal = b.item_number; break;
        case "supply_name": aVal = a.supply_name; bVal = b.supply_name; break;
        case "totalQty":    aVal = a.totalQty;    bVal = b.totalQty;    break;
        case "avgUnitCost": aVal = a.avgUnitCost; bVal = b.avgUnitCost; break;
        case "minPrice":    aVal = a.minPrice ?? -1; bVal = b.minPrice ?? -1; break;
        case "maxPrice":    aVal = a.maxPrice ?? -1; bVal = b.maxPrice ?? -1; break;
        case "priceVariance": aVal = a.priceVariance ?? -1; bVal = b.priceVariance ?? -1; break;
        default: aVal = 0; bVal = 0;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filtered, sortKey, sortDir]);

  const sortProps = { sortKey, sortDir, onSort: handleSort };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900">
          Pricing Metrics by Item # ({sorted.length}{filtered.length !== grouped.length ? ` of ${grouped.length}` : ""} items)
        </h3>
        <Button size="sm" variant="outline" className="gap-2" onClick={onExport}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Price Variance % = (Max − Min) ÷ Min × 100. Items with a single observed price show N/A. Click a column header to sort. Click Item # to view orders.
      </p>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by Item #, product, or vendor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-8 text-sm"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[520px] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
            <tr>
              <SortableTh col="item_number"   label="Item #"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableTh col="supply_name"   label="Product"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableTh col="totalQty"      label="Total Qty"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
              <SortableTh col="avgUnitCost"   label="Avg Cost"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
              <SortableTh col="minPrice"      label="Min Price"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
              <th className="p-3 text-right text-sm font-semibold text-slate-700">Min Date</th>
              <SortableTh col="maxPrice"      label="Max Price"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
              <th className="p-3 text-right text-sm font-semibold text-slate-700">Max Date</th>
              <SortableTh col="priceVariance" label="Variance %" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} right />
              <th className="p-3 text-right text-sm font-semibold text-slate-700">Orders</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((g, i) => {
              const variance = g.priceVariance;
              const varColor = variance === null ? "text-slate-400"
                : variance >= 20 ? "text-red-600 font-semibold"
                : variance >= 10 ? "text-orange-600 font-semibold"
                : "text-green-700";
              return (
                <tr key={g.item_number} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                  <td className="p-3">
                    <button
                      onClick={() => setDrillItem(g)}
                      className="font-mono text-xs text-blue-600 hover:underline text-left"
                    >
                      {g.item_number}
                    </button>
                  </td>
                  <td className="p-3 text-slate-900">{g.supply_name}</td>
                  <td className="p-3 text-right text-slate-700">{g.totalQty.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-600">{fmt(g.avgUnitCost)}</td>
                  <td className="p-3 text-right text-green-700">{g.minPrice !== null ? fmt(g.minPrice) : "—"}</td>
                  <td className="p-3 text-right text-slate-500 text-xs">{fmtDate(g.minPriceDate)}</td>
                  <td className="p-3 text-right text-red-600">{g.maxPrice !== null ? fmt(g.maxPrice) : "—"}</td>
                  <td className="p-3 text-right text-slate-500 text-xs">{fmtDate(g.maxPriceDate)}</td>
                  <td className={`p-3 text-right ${varColor}`}>
                    {variance !== null ? variance.toFixed(1) + "%" : "N/A"}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setDrillItem(g)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400">
                  {search ? `No items match "${search}".` : "No data in selected date range."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drill-down modal */}
      {drillItem && (
        <OrderDrillDownModal
          item={drillItem}
          lineItems={lineItems}
          onClose={() => setDrillItem(null)}
        />
      )}
    </div>
  );
}