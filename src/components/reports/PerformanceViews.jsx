import React from "react";

// ---- Shared goal logic (mirrors Excel export) ----
const LOCATION_GOALS = {
  Bloomfield:  { check_in: 34, check_out: 35 },
  Manchester:  { check_in: 28, check_out: 30 },
  Glastonbury: { check_in: 22, check_out: 25 },
  Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
};
const WORK_DAYS_PER_WEEK = 5;

const coerceBool = (val) => {
  if (typeof val === "boolean") return val;
  if (val === null || val === undefined) return false;
  return ["true", "yes", "1", "x", "✓", "checked"].includes(String(val).toLowerCase().trim());
};

const isFrontDeskBenchmark = (userName, userConfigMap) => {
  const cfg = userConfigMap[userName];
  if (!cfg) return false;
  const includeInBench = coerceBool(cfg.include_in_benchmark);
  const isActive = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
  return cfg.benchmark_group === "Front Desk" && includeInBench && isActive;
};

const isNPBenchmark = (userName, userConfigMap) => {
  const cfg = userConfigMap[userName];
  if (!cfg) return false;
  const isActive = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
  return cfg.benchmark_group === "NP" && isActive;
};

const getUserLocation = (userName, userConfigMap) => {
  const cfg = userConfigMap[userName];
  if (!cfg || !cfg.location || cfg.location === "N/A") return "";
  return cfg.location;
};

const getDeskGoal = (userName, userConfigMap) => {
  const location = getUserLocation(userName, userConfigMap);
  const goals = LOCATION_GOALS[location];
  if (!goals) return 0;
  const nameLower = (userName || "").toLowerCase();
  let deskType = "check_in";
  if (nameLower.includes("check out") || nameLower.includes("checkout")) deskType = "check_out";
  else if (nameLower.includes("phone")) deskType = "phone_only";
  const dailyRate = goals[deskType] ?? goals["check_in"] ?? 0;
  return dailyRate * WORK_DAYS_PER_WEEK;
};

const formatDate = (str) => {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

const formatPct = (val) => {
  if (val === null || val === undefined || val === "") return "—";
  return (val * 100).toFixed(1) + "%";
};

const pctColor = (pct) => {
  if (pct === null || pct === undefined) return "";
  if (pct >= 1.0) return "bg-green-100 text-green-800";
  if (pct >= 0.9) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-700";
};

// ---- Sub-views ----

function FrontEndView({ sortedWeeks, userConfigMap }) {
  const deskWeekMap = {};
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      if (!isFrontDeskBenchmark(userName, userConfigMap)) return;
      const location = getUserLocation(userName, userConfigMap);
      const weeklyGoal = getDeskGoal(userName, userConfigMap);
      const key = `${week.week_start}||${userName}`;
      if (!deskWeekMap[key]) {
        deskWeekMap[key] = { week_start: week.week_start, desk: userName, location, weeklyGoal, totalAnswered: 0 };
      }
      deskWeekMap[key].totalAnswered += (u.answered || 0);
    });
  });

  const rows = Object.values(deskWeekMap).sort((a, b) => {
    const wc = a.week_start.localeCompare(b.week_start);
    return wc !== 0 ? wc : a.desk.localeCompare(b.desk);
  });

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No front end data found for this period.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            {["Week", "Desk", "Location", "Total Answered", "Weekly Goal", "% of Weekly Goal"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = r.weeklyGoal > 0 ? r.totalAnswered / r.weeklyGoal : null;
            return (
              <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDate(r.week_start)}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">{r.desk}</td>
                <td className="px-3 py-2 text-slate-600">{r.location || "—"}</td>
                <td className="px-3 py-2 text-center font-medium text-slate-800">{r.totalAnswered.toLocaleString()}</td>
                <td className="px-3 py-2 text-center text-slate-600">{r.weeklyGoal > 0 ? r.weeklyGoal.toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-center">
                  {pct !== null ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${pctColor(pct)}`}>
                      {formatPct(pct)}
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

function IndividualView({ sortedWeeks, userConfigMap }) {
  const rows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      const answered = u.answered || 0;
      const location = getUserLocation(userName, userConfigMap);
      const eligible = isFrontDeskBenchmark(userName, userConfigMap);
      const weeklyGoal = eligible ? getDeskGoal(userName, userConfigMap) : null;
      const pct = eligible && weeklyGoal > 0 ? answered / weeklyGoal : null;
      rows.push({ week_start: week.week_start, user: userName, location, answered, weeklyGoal, pct, eligible });
    });
  });

  // Sort: % of Weekly Goal asc (blanks at bottom), then Week Start asc
  rows.sort((a, b) => {
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

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No individual data found for this period.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            {["Week", "User", "Location", "Answered", "Weekly Goal", "% of Weekly Goal"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDate(r.week_start)}</td>
              <td className="px-3 py-2 text-slate-800 font-medium">{r.user}</td>
              <td className="px-3 py-2 text-slate-600">{r.location || "—"}</td>
              <td className="px-3 py-2 text-center font-medium text-slate-800">{r.answered.toLocaleString()}</td>
              <td className="px-3 py-2 text-center text-slate-600">{r.weeklyGoal != null ? r.weeklyGoal.toLocaleString() : "—"}</td>
              <td className="px-3 py-2 text-center">
                {r.pct !== null ? (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${pctColor(r.pct)}`}>
                    {formatPct(r.pct)}
                  </span>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NPTeamView({ sortedWeeks, userConfigMap }) {
  const rows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      if (!isNPBenchmark(userName, userConfigMap)) return;
      const location = getUserLocation(userName, userConfigMap);
      rows.push({
        week_start: week.week_start,
        user: userName,
        location,
        answered: u.answered || 0,
        total_calls: u.total_calls || 0,
      });
    });
  });

  rows.sort((a, b) => {
    const wc = a.week_start.localeCompare(b.week_start);
    return wc !== 0 ? wc : a.user.localeCompare(b.user);
  });

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No NP team members found for this period. Ensure NP users are configured in the User Directory with benchmark_group = "NP".</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b border-slate-200">
            {["Week", "User", "Location", "Total Calls", "Answered", "NP Goal (TBD)"].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/50" : ""}`}>
              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDate(r.week_start)}</td>
              <td className="px-3 py-2 text-slate-800 font-medium">{r.user}</td>
              <td className="px-3 py-2 text-slate-600">{r.location || "—"}</td>
              <td className="px-3 py-2 text-center text-slate-700">{r.total_calls.toLocaleString()}</td>
              <td className="px-3 py-2 text-center font-medium text-slate-800">{r.answered.toLocaleString()}</td>
              <td className="px-3 py-2 text-center">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Coming Soon</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main exported component ----
export default function PerformanceViews({ sortedWeeks, userConfigMap }) {
  const [activeView, setActiveView] = React.useState(null);

  const views = [
    { key: "frontend",    label: "Front End Performance" },
    { key: "individual",  label: "Individual Performance" },
    { key: "np",          label: "NP Team Performance" },
  ];

  const handleToggle = (key) => {
    setActiveView(prev => prev === key ? null : key);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Performance Views</h3>
      <div className="flex flex-wrap gap-2">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => handleToggle(v.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              activeView === v.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView && (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {views.find(v => v.key === activeView)?.label}
            </span>
            <button
              onClick={() => setActiveView(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <div className="p-2 max-h-[520px] overflow-auto">
            {activeView === "frontend"   && <FrontEndView   sortedWeeks={sortedWeeks} userConfigMap={userConfigMap} />}
            {activeView === "individual" && <IndividualView sortedWeeks={sortedWeeks} userConfigMap={userConfigMap} />}
            {activeView === "np"         && <NPTeamView     sortedWeeks={sortedWeeks} userConfigMap={userConfigMap} />}
          </div>
        </div>
      )}
    </div>
  );
}