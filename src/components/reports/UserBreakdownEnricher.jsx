import React from 'react';

/**
 * Build CDR map for enrichment lookup (keyed by normalized user name)
 * @param {Array} cdrUserStats - CDR user statistics from backend
 * @returns {Object} Map of normalized user names to CDR data
 */
export function useCdrMap(cdrUserStats) {
  return React.useMemo(() => {
    const m = {};
    cdrUserStats.forEach(s => {
      if (s.user_name) {
        const normalized = s.user_name.trim().toLowerCase().replace(/\s+/g, " ");
        m[normalized] = {
          inbound_calls: Number(s.inbound_calls || 0),
          inbound_answered: Number(s.inbound_answered || 0)
        };
      }
    });
    console.log("[USER_BREAKDOWN] CDR map keys:", Object.keys(m));
    return m;
  }, [cdrUserStats]);
}

/**
 * Enrich benchmark users with CDR data.
 * Only iterates userSummaries (benchmark data), enriches with CDR lookup.
 * CDR-only users are NOT included.
 * @param {Array} userSummaries - Benchmark users (CallLogUserSummary rows)
 * @param {Object} cdrMap - CDR data map
 * @returns {Array} Enriched user summaries
 */
export function useEnrichedSummaries(userSummaries, cdrMap) {
  return React.useMemo(() => {
    return userSummaries.map(u => {
      // Normalize for CDR lookup
      const normalized = (u.user || "").trim().toLowerCase().replace(/\s+/g, " ");
      const cdrData = cdrMap[normalized];
      
      // Calculate answer rate from CDR if available, otherwise null
      let answerRate = null;
      if (cdrData && cdrData.inbound_calls > 0) {
        answerRate = (cdrData.inbound_answered / cdrData.inbound_calls) * 100;
      }
      
      console.log(`[USER_BREAKDOWN] User "${u.user}" -> normalized:"${normalized}" -> CDR found: ${!!cdrData}, answer_rate: ${answerRate}`);
      
      return {
        ...u,
        inbound_answer_rate_cdr: answerRate
      };
    });
  }, [userSummaries, cdrMap]);
}