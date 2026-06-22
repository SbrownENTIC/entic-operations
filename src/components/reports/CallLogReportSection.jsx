import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import CallLogDashboard from '@/pages/CallLogDashboard';
import {
  persistCallLogCacheFromQueries,
  syncCallLogReportData,
} from '@/lib/callLogCache';

export default function CallLogReportSection({ isTabActive }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle');
  const persistTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isTabActive) return undefined;

    let cancelled = false;

    (async () => {
      await syncCallLogReportData(queryClient, {
        onStatus: (nextStatus) => {
          if (!cancelled) setStatus(nextStatus);
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isTabActive, queryClient]);

  useEffect(() => {
    if (!isTabActive) return undefined;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;

      const queryKey = event.query.queryKey[0];
      if (queryKey !== 'inbound-calls' && queryKey !== 'outbound-calls') return;
      if (event.query.state.fetchStatus !== 'idle' || event.query.state.status !== 'success') return;

      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }

      persistTimeoutRef.current = setTimeout(() => {
        persistCallLogCacheFromQueries(queryClient);
      }, 500);
    });

    return () => {
      unsubscribe();
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [isTabActive, queryClient]);

  if (!isTabActive) {
    return null;
  }

  return (
    <div className="relative">
      {status === 'loading' && (
        <Alert className="mx-4 mt-4 mb-0 border-blue-200 bg-blue-50">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
          <AlertDescription className="text-blue-900">
            Loading call log data…
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert className="mx-4 mt-4 mb-0 border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-900">
            Cached call log data could not be refreshed. Loading directly from the server…
          </AlertDescription>
        </Alert>
      )}

      {status === 'refreshing' && (
        <>
          <Alert className="mx-4 mt-4 mb-0 border-blue-200 bg-blue-50">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            <AlertDescription className="text-blue-900">
              Updating Call Log report with newly imported data…
            </AlertDescription>
          </Alert>
          <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-1 text-xs font-medium text-blue-800 shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating…
          </div>
        </>
      )}

      <CallLogDashboard />
    </div>
  );
}
