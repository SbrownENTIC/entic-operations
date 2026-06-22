import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import CallLogDashboard from '@/pages/CallLogDashboard';
import { syncCallLogReportData } from '@/lib/callLogCache';

export default function CallLogReportSection({ isTabActive }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('idle');
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!isTabActive || hasSyncedRef.current) return undefined;

    hasSyncedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await syncCallLogReportData(queryClient, {
          onStatus: (nextStatus) => {
            if (!cancelled) setStatus(nextStatus);
          },
        });
      } catch {
        // syncCallLogReportData logs errors; dashboard may still show cached data.
      }
    })();

    return () => {
      cancelled = true;
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
            Call log data could not be loaded. Try Refresh Data or check your connection.
          </AlertDescription>
        </Alert>
      )}

      <CallLogDashboard />
    </div>
  );
}
