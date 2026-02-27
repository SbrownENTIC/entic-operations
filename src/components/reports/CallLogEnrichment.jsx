import React from "react";

export function useCdrMap(cdrUserStats) {
  return React.useMemo(() => {
    const m = {};
    cdrUserStats.forEach(s => {
      if (s.user_name) {
        const normalized = s.user_name.trim().toLowerCase().replace(/\s+/g, " ");
        m[normalized] = {
          inboundCalls: Number(s.inbound_calls || 0),
          inboundAnswered: Number(s.inbound_answered || 0)
        };
      }
    });
    return m;
  }, [cdrUserStats]);
}

export function useEnrichedSummaries(userSummaries, cdrMap) {
  return React.useMemo(() => {
    const enriched = userSummaries.map(summaryUser => {
      const normalizedName = (summaryUser.user || "").trim().toLowerCase().replace(/\s+/g, " ");
      const cdrData = cdrMap[normalizedName];
      const answerRate = cdrData && cdrData.inboundCalls > 0
        ? (cdrData.inboundAnswered / cdrData.inboundCalls) * 100
        : null;
      return { ...summaryUser, inbound_answer_rate_cdr: answerRate };
    });
    console.log("ENRICHED_SUMMARY_COUNT", enriched.length, "SOURCE_SUMMARY_COUNT", userSummaries.length);
    return enriched;
  }, [userSummaries, cdrMap]);
}