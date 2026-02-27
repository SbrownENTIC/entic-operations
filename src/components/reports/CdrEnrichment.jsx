import React from 'react';

export function getCdrQueryFilter(selectedPeriod) {
  // CRITICAL FIX: Use monthly_key (YYYY-MM) NOT entity id for CDR queries
  const key = selectedPeriod?.monthly_key;
  console.log("[CDR_QUERY] Query filter - using reporting_period_key:", key, "(NOT id:", selectedPeriod?.id + ")");
  return { reporting_period_key: key };
}

// Extract CDR enrichment logic into separate file to debug fetch & mapping
export function useCdrEnrichment(cdrUserStats, userSummaries) {
  // Log raw fetch result immediately
  React.useEffect(() => {
    console.log("[CDR_DEBUG] cdrUserStats received:", cdrUserStats);
    console.log("[CDR_DEBUG] length:", cdrUserStats?.length);
    console.log("[CDR_DEBUG] sample first:", cdrUserStats?.[0]);
  }, [cdrUserStats]);

  // Normalized CDR map
  const cdrMap = React.useMemo(() => {
    console.log("[CDR_MAP_BUILD] input stats length:", cdrUserStats?.length);
    const m = {};
    if (!cdrUserStats || !Array.isArray(cdrUserStats)) {
      console.log("[CDR_MAP_BUILD] cdrUserStats is not array:", cdrUserStats);
      return m;
    }
    cdrUserStats.forEach((s, idx) => {
      const userName = s?.user_name;
      console.log(`[CDR_MAP_BUILD] row ${idx}: user_name="${userName}" inbound_calls=${s?.inbound_calls} inbound_answered=${s?.inbound_answered}`);
      if (userName) {
        const n = userName.trim().toLowerCase().replace(/\s+/g, " ");
        m[n] = { t: Number(s.inbound_calls || 0), a: Number(s.inbound_answered || 0) };
      }
    });
    console.log("[CDR_MAP_FINAL] Normalized keys:", Object.keys(m).slice(0, 10), "total:", Object.keys(m).length);
    return m;
  }, [cdrUserStats]);

  // Merge CDR with normalized matching
  const enrichedSummaries = React.useMemo(() => {
    return userSummaries.map(u => {
      const n = u.user?.trim().toLowerCase().replace(/\s+/g, " ");
      const c = cdrMap[n];
      const rate = c && c.t > 0 ? (c.a / c.t) * 100 : null;
      console.log(`[ENRICH] "${u.user}" -> norm:"${n}" -> match:${!!c}`, c);
      return { ...u, inbound_answer_rate_cdr: rate };
    });
  }, [userSummaries, cdrMap]);

  return enrichedSummaries;
}