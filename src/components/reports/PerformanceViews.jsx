import React, { useState, useMemo } from "react";

// ── Shared constants (mirrors Excel export) ────────────────────────────────
const LOCATION_GOALS = {
  Bloomfield:  { check_in: 34, check_out: 35 },
  Manchester:  { check_in: 28, check_out: 30 },
  Glastonbury: { check_in: 22, check_out: 25 },
  Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
};
const WORK_DAYS_PER_WEEK = 5;

// ── Helpers (identical logic to Excel export) ──────────────────────────────
function coerceBool(val) {
  if (typeof val === "boolean") return val;
  if (val === null || val === undefined) return false;
  return ["true", "yes", "1", "x", "✓", "checked"].includes(String(val).toLowerCase().trim());
}

function isFrontDeskEligible(userName, configMap) {
  const cfg = configMap[userName];
  if (!cfg) return false;
  const isActive = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
  return cfg.benchmark_group === "Front Desk" && coerceBool(cfg.include_in_benchmark) && isActive;
}

function isNPUser(userName, configMap) {
  const cfg = configMap[userName];
  if (!cfg) return false;
  const isActive = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
  return cfg.benchmark_group === "NP" && isActive;
}

function getUserLocation(userName, configMap) {
  const cfg = configMap[userName];
  if (!cfg || !cfg.location || cfg.location === "N/A") return "";
  return cfg.location;
}

function getDeskGoal(userName, configMap) {
  const location = getUserLocation(userName, configMap);
  const goals = LOCATION_GOALS[location];
  if (!goals) return 0;
  const lower = (userName || "").toLowerCase();
  let type = "check_in";
  if (lower.includes("check out") || lower.includes("checkout")) type = "check_out";
  else if (lower.includes("phone")) type = "phone_only";
  return (goals[type] ?? goals["check_in"] ?? 0) * WORK_DAYS_PER_WEEK;
}

function fmtDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function fmtPct(pct) {
  if (pct === null || pct === undefined) return "—";
  return (pct * 100).toFixed(1) + "%";
}

// ── Conditional formatting ─────────────────────────────────────────────────
function pctBadge(pct) {
  if (pct === null || pct === undefined)
    return "bg-slate-100 text-slate-400";
  if (pct >= 1.0) return "bg-green-100 text-green-800 font-semibold";
  if (pct >= 0.9) return "bg-yellow-100 text-yellow-800 font-semibold";
  return "bg-red-100 text-red-700 font-semibold";
}

// ── Shared table chrome ────────────────────────────────────────────────────
function TH({ children, right }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap bg-slate-50 border-b border-slate-200 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function TD({ children, right, muted }) {
  return (
    <td className={`px-3 py-2 text-sm ${right ? "text-right" : "text-left"} ${muted ? "text-slate-400" : "text-slate-800"}`}>
      {children}
    </td>
  );
}
function EmptyRow({ cols, msg }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-slate-400">{msg}</td>
    </tr>
  );
}

// ── Front End Performance ──────────────────────────────────────────────────
function FrontEndView({ sortedWeeks, configMap }) {
  const rows = useMemo(() => {
    const map = {};
    sortedWeeks.forEach(week => {
      (week.user_snapshot || []).forEach(u => {
        const name = u.user || "";
        if (!isFrontDeskEligible(name, configMap)) return;
        const key = `${week.week_start}||${name}`;
        if (!map[key]) {
          map[key] = {
            week_start: week.week_start,
            desk: name,
            location: getUserLocation(name, configMap),
            goal: getDeskGoal(name, configMap),
            answered: 0,
          };
        }
        const inboundAnswered = u.inbound_answered != null ? u.inbound_answered : (u.answered || 0);
        map[key].answered += inboundAnswered;
      });
    });

    return Object.values(map).sort((a, b) => {
      const wc = a.week_start.localeCompare(b.week_start);
      if (wc !== 0) return wc;
      const pa = a.goal > 0 ? a.answered / a.goal : null;
      const pb = b.goal > 0 ? b.answered / b.goal : null;
      if (pa !== null && pb !== null) return pa - pb;
      if (pa !== null) return -1;
      if (pb !== null) return 1;
      return a.desk.localeCompare(b.desk);
    });
  }, [sortedWeeks, configMap]);

  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <TH>Week</TH>
            <TH>Desk</TH>
            <TH>Location</TH>
            <TH right>Total Answered</TH>
            <TH right>Weekly Goal</TH>
            <TH right>% of Weekly Goal</TH>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow cols={6} msg="No Front Desk benchmark data found for this period." />
          ) : rows.map((r, i) => {
            const pct = r.goal > 0 ? r.answered / r.goal : null;
            return (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                <TD muted>{fmtDate(r.week_start)}</TD>
                <TD><span className="font-medium">{r.desk}</span></TD>
                <TD>{r.location || "—"}</TD>
                <TD right>{r.answered.toLocaleString()}</TD>
                <TD right muted>{r.goal > 0 ? r.goal.toLocaleString() : "—"}</TD>
                <td className="px-3 py-2 text-right">
                  {pct !== null ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${pctBadge(pct)}`}>
                      {fmtPct(pct)}
                    </span>
                  ) : <span className="text-slate-300 text-xs">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Individual Performance ─────────────────────────────────────────────────
function IndividualView({ sortedWeeks, configMap }) {
  const rows = useMemo(() => {
    const raw = [];
    sortedWeeks.forEach(week => {
      (week.user_snapshot || []).forEach(u => {
        const name = u.user || "";
        const answered = u.inbound_answered != null ? u.inbound_answered : (u.answered || 0);
        const eligible = isFrontDeskEligible(name, configMap);
        const goal = eligible ? getDeskGoal(name, configMap) : null;
        const pct = eligible && goal > 0 ? answered / goal : null;
        raw.push({
          week_start: week.week_start,
          user: name,
          location: getUserLocation(name, configMap),
          answered,
          goal,
          pct,
        });
      });
    });

    // % asc (blanks at bottom), then week asc
    raw.sort((a, b) => {
      const aHas = a.pct !== null;
      const bHas = b.pct !== null;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (aHas && bHas) {
        const diff = a.pct - b.pct;
        if (diff !== 0) return diff;
      }
      return a.week_start.localeCompare(b.week_start);
    });

    return raw;
  }, [sortedWeeks, configMap]);

  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <TH>Week</TH>
            <TH>User</TH>
            <TH>Location</TH>
            <TH right>Answered</TH>
            <TH right>Weekly Goal</TH>
            <TH right>% of Weekly Goal</TH>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow cols={6} msg="No individual performance data found for this period." />
          ) : rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
              <TD muted>{fmtDate(r.week_start)}</TD>
              <TD><span className="font-medium">{r.user}</span></TD>
              <TD>{r.location || "—"}</TD>
              <TD right>{r.answered.toLocaleString()}</TD>
              <TD right muted>{r.goal != null ? r.goal.toLocaleString() : "—"}</TD>
              <td className="px-3 py-2 text-right">
                {r.pct !== null ? (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${pctBadge(r.pct)}`}>
                    {fmtPct(r.pct)}
                  </span>
                ) : <span className="text-slate-300 text-xs">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── NP Team Performance ────────────────────────────────────────────────────
function NPTeamView({ sortedWeeks, configMap }) {
  const rows = useMemo(() => {
    const raw = [];
    sortedWeeks.forEach(week => {
      (week.user_snapshot || []).forEach(u => {
        const name = u.user || "";
        if (!isNPUser(name, configMap)) return;
        raw.push({
          week_start: week.week_start,
          user: name,
          location: getUserLocation(name, configMap),
          total_calls: u.total_calls || 0,
          answered: u.inbound_answered != null ? u.inbound_answered : (u.answered || 0),
        });
      });
    });

    raw.sort((a, b) => {
      const wc = a.week_start.localeCompare(b.week_start);
      return wc !== 0 ? wc : a.user.localeCompare(b.user);
    });

    return raw;
  }, [sortedWeeks, configMap]);

  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <TH>Week</TH>
            <TH>User</TH>
            <TH>Location</TH>
            <TH right>Total Calls</TH>
            <TH right>Answered</TH>
            <TH right>NP Goal</TH>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow cols={6} msg='No NP team members found. Ensure users have benchmark_group = "NP" in the User Directory.' />
          ) : rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
              <TD muted>{fmtDate(r.week_start)}</TD>
              <TD><span className="font-medium">{r.user}</span></TD>
              <TD>{r.location || "—"}</TD>
              <TD right>{r.total_calls.toLocaleString()}</TD>
              <TD right>{r.answered.toLocaleString()}</TD>
              <td className="px-3 py-2 text-right">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-400">TBD</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
const VIEWS = [
  { key: "frontend",   label: "Front End" },
  { key: "individual", label: "Individual" },
  { key: "np",         label: "NP Team" },
];

export default function PerformanceViews({ sortedWeeks, userConfigMap }) {
  const [active, setActive] = useState(null);

  const toggle = (key) => setActive(prev => prev === key ? null : key);

  return (
    <div className="space-y-3">
      {/* Section title + toggle buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">Performance Analytics</h3>
        <div className="flex items-center gap-1.5">
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => toggle(v.key)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 ${
                active === v.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-700"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active view panel */}
      {active && (
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
              {VIEWS.find(v => v.key === active)?.label} Performance
            </span>
            <button
              onClick={() => setActive(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs leading-none p-1 rounded hover:bg-slate-200"
            >
              ✕
            </button>
          </div>

          {/* Table */}
          {active === "frontend"   && <FrontEndView   sortedWeeks={sortedWeeks} configMap={userConfigMap} />}
          {active === "individual" && <IndividualView sortedWeeks={sortedWeeks} configMap={userConfigMap} />}
          {active === "np"         && <NPTeamView     sortedWeeks={sortedWeeks} configMap={userConfigMap} />}
        </div>
      )}
    </div>
  );
}