import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown } from "lucide-react";

function secondsToHHMMSS(seconds) {
  if (!seconds || seconds === 0) return "0:00:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function UserBreakdownTable({
  summaries,
  sortCol,
  sortDir,
  onSortChange,
  userSearch,
  onSearchChange
}) {
  const TABLE_COLS = [
    { key: "user",                  label: "User",                    type: "alpha" },
    { key: "total_calls",           label: "Total Calls",             type: "num"   },
    { key: "inbound",               label: "Inbound",                 type: "num"   },
    { key: "outbound",              label: "Outbound",                type: "num"   },
    { key: "answered",              label: "Connected (All)",         type: "num"   },
    { key: "missed",                label: "Missed",                  type: "num"   },
    { key: "total_duration_seconds",label: "Duration (HH:MM:SS)",     type: "num"   },
    { key: "answer_rate",           label: "Inbound Answer Rate",     type: "num"   },
    { key: "avg_duration_seconds",  label: "Avg Duration (HH:MM:SS)", type: "num"   },
  ];

  const handleSortClick = (colKey) => {
    if (sortCol === colKey) {
      if (sortDir === "asc")  onSortChange(colKey, "desc");
      else if (sortDir === "desc") onSortChange("user", "asc");
      else onSortChange(colKey, "asc");
    } else {
      onSortChange(colKey, "asc");
    }
  };

  const getSortValue = (u, key) => {
    if (key === "answer_rate") {
      const inboundCallsCdr = u.inbound_calls_cdr || 0;
      const inboundAnsweredCdr = u.inbound_answered_cdr || 0;
      return inboundCallsCdr > 0 ? inboundAnsweredCdr / inboundCallsCdr : -1;
    }
    return u[key] ?? 0;
  };

  const activeSummaries = [...summaries.filter(u => (u.total_calls || 0) > 0)]
    .sort((a, b) => {
      const col = TABLE_COLS.find(c => c.key === sortCol);
      if (!col) return 0;
      const dir = sortDir === "desc" ? -1 : 1;
      if (col.type === "alpha") {
        return dir * (a.user || "").trim().toLowerCase().localeCompare((b.user || "").trim().toLowerCase());
      }
      return dir * (getSortValue(a, sortCol) - getSortValue(b, sortCol));
    });

  const searchTerm = userSearch.trim().toLowerCase();
  const filteredSummaries = searchTerm
    ? activeSummaries.filter(u => (u.user || "").trim().toLowerCase().includes(searchTerm))
    : activeSummaries;

  const highlightUser = (name) => {
    if (!searchTerm) return name;
    const idx = (name || "").toLowerCase().indexOf(searchTerm);
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="bg-yellow-200 text-inherit rounded-sm px-0">{name.slice(idx, idx + searchTerm.length)}</mark>
        {name.slice(idx + searchTerm.length)}
      </>
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 py-3 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-semibold text-slate-700">
            User Breakdown — {filteredSummaries.length}{searchTerm ? ` of ${activeSummaries.length}` : ""} users
          </CardTitle>
          <div className="relative">
            <Input
              value={userSearch}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search User…"
              className="h-8 w-48 text-xs pl-3 pr-3"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {TABLE_COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSortClick(col.key)}
                    className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key ? (
                        sortDir === "asc"
                          ? <ChevronUp className="w-3 h-3 text-blue-600" />
                          : <ChevronDown className="w-3 h-3 text-blue-600" />
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map((u, i) => {
                const inbound = u.inbound || 0;
                const connected = u.answered || 0;
                const inboundCallsCdr = u.inbound_calls_cdr || 0;
                const inboundAnsweredCdr = u.inbound_answered_cdr || 0;
                const ar = inboundCallsCdr > 0 ? inboundAnsweredCdr / inboundCallsCdr : null;
                return (
                  <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{highlightUser(u.user)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{(u.total_calls || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-blue-700">{inbound.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-indigo-700">{(u.outbound || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-green-700">{connected.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-600">{(u.missed || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.total_duration_seconds)}</td>
                    <td className="px-4 py-2.5">
                      {ar === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`font-semibold ${ar >= 0.8 ? "text-green-700" : ar >= 0.5 ? "text-yellow-700" : "text-red-600"}`}>
                          {(ar * 100).toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{secondsToHHMMSS(u.avg_duration_seconds)}</td>
                  </tr>
                );
              })}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    {searchTerm ? "No users match your search." : "No user data for this period."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}