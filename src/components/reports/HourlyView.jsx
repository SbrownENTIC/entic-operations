import React, { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";

// ── Daily goals per location / desk type ──────────────────────────────────
const DAILY_GOALS = {
  Bloomfield:  { check_in: 34, check_out: 35 },
  Manchester:  { check_in: 28, check_out: 30 },
  Glastonbury: { check_in: 22, check_out: 25 },
  Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
};

// ── Operating hours per location (used as divisor for hourly target) ───────
const OPERATING_HOURS = {
  Bloomfield:  7.5,
  Manchester:  7.5,
  Glastonbury: 7.5,
  Farmington:  7.5,
};

export const DISPLAY_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16]; // 8AM–4PM (last slot = 4PM–5PM)

const LOCATIONS = ["Bloomfield", "Manchester", "Glastonbury", "Farmington"];

/** Determine desk type from name */
export function getDeskType(name) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("check out") || lower.includes("checkout")) return "check_out";
  if (lower.includes("phone")) return "phone_only";
  return "check_in";
}

/** Get hourly target for a desk */
export function getHourlyTarget(location, deskName) {
  const targets = HOURLY_TARGETS[location];
  if (!targets) return 0;
  const type = getDeskType(deskName);
  return targets[type] ?? targets["check_in"] ?? 0;
}

function fmtHour(h) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function fmtDate(str) {
  if (!str) return "";
  const [, m, d] = str.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtPct(pct) {
  if (pct === null || pct === undefined) return "—";
  return (pct * 100).toFixed(1) + "%";
}

function fmtAHT(totalSec, count) {
  if (!count) return "—";
  const avg = totalSec / count;
  const m = Math.floor(avg / 60);
  const s = Math.round(avg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Color class for a cell given answered vs hourly target */
function heatColor(answered, target) {
  if (!target || answered === null || answered === undefined) return "bg-slate-100 text-slate-400";
  const pct = answered / target;
  if (pct >= 1.0) return "bg-green-100 text-green-800";
  if (pct >= 0.8) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-700";
}

/** Service-level flag: answer rate < 90% OR missed > 10% of inbound */
function hasServiceFlag(row) {
  if (!row.total_inbound) return false;
  const ar = row.answered / row.total_inbound;
  const missedPct = row.missed / row.total_inbound;
  return ar < 0.9 || missedPct > 0.1;
}

// ── Heatmap View ──────────────────────────────────────────────────────────
function HeatmapView({ rows }) {
  // Build: { hour -> { location -> { answered, target } } }
  const matrix = useMemo(() => {
    const m = {};
    for (const h of DISPLAY_HOURS) {
      m[h] = {};
      for (const loc of LOCATIONS) {
        m[h][loc] = { answered: 0, target: 0, count: 0 };
      }
    }
    for (const row of rows) {
      if (!DISPLAY_HOURS.includes(row.hour)) continue;
      if (!isWeekday(row.date)) continue;
      const loc = row.location;
      if (!LOCATIONS.includes(loc)) continue;
      m[row.hour][loc].answered += row.answered || 0;
      m[row.hour][loc].target   += row.hourly_target || 0;
      m[row.hour][loc].count    += 1;
    }
    return m;
  }, [rows]);

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2.5 text-xs font-semibold text-slate-600 text-left border-b border-r border-slate-200 min-w-[72px]">
              Hour
            </th>
            {LOCATIONS.map(loc => (
              <th key={loc} className="px-3 py-2.5 text-xs font-semibold text-slate-600 text-center border-b border-slate-200 min-w-[110px]">
                {loc}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DISPLAY_HOURS.map(h => (
            <tr key={h} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white z-10 px-3 py-2 text-xs font-medium text-slate-500 border-r border-slate-100 whitespace-nowrap">
                {fmtHour(h)}
              </td>
              {LOCATIONS.map(loc => {
                const cell = matrix[h][loc];
                const noData = cell.count === 0;
                return (
                  <td key={loc} className="px-2 py-1.5 text-center">
                    {noData ? (
                      <span className="text-slate-200 text-xs">—</span>
                    ) : (
                      <span className={`inline-block w-full rounded px-2 py-1 text-xs font-semibold ${heatColor(cell.answered, cell.target)}`}>
                        {cell.answered}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-400 mt-2 px-1">
        Cell = total answered calls (duration ≥ 90s). Color: <span className="text-green-700 font-medium">green ≥ 100%</span>, <span className="text-yellow-700 font-medium">yellow 80–99%</span>, <span className="text-red-600 font-medium">red &lt; 80%</span> of hourly target.
      </p>
    </div>
  );
}

// ── Detail Table ──────────────────────────────────────────────────────────
function isWeekday(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  return day !== 0 && day !== 6;
}

const COLUMNS = [
  { key: "date",          label: "Date",           numeric: false },
  { key: "hour",          label: "Hour",           numeric: true  },
  { key: "location",      label: "Location",       numeric: false },
  { key: "desk",          label: "Desk",           numeric: false },
  { key: "total_inbound", label: "Total Inbound",  numeric: true  },
  { key: "answered",      label: "Answered ≥90s",  numeric: true  },
  { key: "missed",        label: "Missed",         numeric: true  },
  { key: "_ar",           label: "Answer Rate",    numeric: true  },
  { key: "hourly_target", label: "Hourly Target",  numeric: true  },
  { key: "_pct",          label: "% of Target",    numeric: true  },
];

function SortIcon({ dir }) {
  if (!dir) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

function DetailTable({ rows }) {
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("asc");

  const filtered = useMemo(() =>
    [...rows].filter(r => r.hourly_target > 0 && DISPLAY_HOURS.includes(r.hour) && isWeekday(r.date)),
    [rows]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const getVal = (row, key) => {
        if (key === "_ar") return row.total_inbound ? row.answered / row.total_inbound : -1;
        if (key === "_pct") return row.hourly_target ? row.answered / row.hourly_target : -1;
        return row[key] ?? "";
      };
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (!sorted.length) {
    return <p className="text-sm text-slate-400 text-center py-10">No hourly detail data.</p>;
  }

  return (
    <div className="overflow-auto max-h-[440px]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap text-left border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100"
              >
                {col.label}
                <SortIcon dir={sortKey === col.key ? sortDir : null} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const ar = row.total_inbound ? row.answered / row.total_inbound : null;
            const pctOfTarget = row.hourly_target ? row.answered / row.hourly_target : null;
            const flag = hasServiceFlag(row);
            return (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtHour(row.hour)}</td>
                <td className="px-3 py-2 text-slate-700">{row.location || "—"}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.desk}</td>
                <td className="px-3 py-2 text-right text-slate-700">{(row.total_inbound || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-700 font-medium">{(row.answered || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600">{(row.missed || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  {flag && ar !== null && (
                    <AlertTriangle className="inline w-3 h-3 text-orange-500 mr-1 -mt-0.5" />
                  )}
                  {ar !== null ? (
                    <span className={ar >= 0.9 ? "text-green-700 font-medium" : ar >= 0.8 ? "text-yellow-700 font-medium" : "text-red-600 font-semibold"}>
                      {fmtPct(ar)}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-400">{row.hourly_target ? row.hourly_target.toFixed(1) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  {pctOfTarget !== null ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      pctOfTarget >= 1.0 ? "bg-green-100 text-green-800" :
                      pctOfTarget >= 0.8 ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {fmtPct(pctOfTarget)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────
export default function HourlyView({ hourlySnapshot }) {
  const [subView, setSubView] = useState("heatmap");

  if (!hourlySnapshot || hourlySnapshot.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-sm font-medium text-slate-600">No hourly CDR data uploaded for this period.</p>
        <p className="text-xs text-slate-400">Use the "Upload CDR File" button above to add call-level data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-toggle */}
      <div className="flex items-center gap-1.5">
        {[
          { key: "heatmap", label: "Heatmap by Location" },
          { key: "detail",  label: "Hourly Detail" },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setSubView(v.key)}
            className={`px-3 py-1 rounded text-xs font-medium border transition-all ${
              subView === v.key
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
            }`}
          >
            {v.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{hourlySnapshot.length.toLocaleString()} hourly records</span>
      </div>

      {subView === "heatmap" && <HeatmapView rows={hourlySnapshot} />}
      {subView === "detail"  && <DetailTable rows={hourlySnapshot} />}
    </div>
  );
}