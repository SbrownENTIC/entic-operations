import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CALL_LOG_QUERY_OPTIONS } from '@/lib/callLogCache';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UnmappedExtensionsDrawer from './UnmappedExtensionsDrawer';

export default function UnmappedExtensionsAlert({ inbound: inboundProp, outbound: outboundProp }) {
  const [showDrawer, setShowDrawer] = useState(false);

  const { data: inboundFromQuery = [] } = useQuery({
    queryKey: ['inbound-calls'],
    ...CALL_LOG_QUERY_OPTIONS,
    enabled: false,
  });

  const { data: outboundFromQuery = [] } = useQuery({
    queryKey: ['outbound-calls'],
    ...CALL_LOG_QUERY_OPTIONS,
    enabled: false,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['user-directory'],
    ...CALL_LOG_QUERY_OPTIONS,
    enabled: false,
  });

  const inbound = inboundProp ?? inboundFromQuery;
  const outbound = outboundProp ?? outboundFromQuery;

  const unmappedData = useMemo(() => {
    const mappedExts = new Set();
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          mappedExts.add(ext);
        });
      }
    });

    const unmapped = {};

    inbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        if (!unmapped[call.extension]) {
          unmapped[call.extension] = {
            extension: call.extension,
            inbound: 0,
            outbound: 0,
            firstSeen: call.call_date,
            lastSeen: call.call_date,
          };
        }
        unmapped[call.extension].inbound++;
        if (call.call_date < unmapped[call.extension].firstSeen) {
          unmapped[call.extension].firstSeen = call.call_date;
        }
        if (call.call_date > unmapped[call.extension].lastSeen) {
          unmapped[call.extension].lastSeen = call.call_date;
        }
      }
    });

    outbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        if (!unmapped[call.extension]) {
          unmapped[call.extension] = {
            extension: call.extension,
            inbound: 0,
            outbound: 0,
            firstSeen: call.call_date,
            lastSeen: call.call_date,
          };
        }
        unmapped[call.extension].outbound++;
        if (call.call_date < unmapped[call.extension].firstSeen) {
          unmapped[call.extension].firstSeen = call.call_date;
        }
        if (call.call_date > unmapped[call.extension].lastSeen) {
          unmapped[call.extension].lastSeen = call.call_date;
        }
      }
    });

    return Object.values(unmapped).sort((a, b) => b.inbound - a.inbound);
  }, [inbound, outbound, users]);

  if (unmappedData.length === 0) {
    return null;
  }

  return (
    <>
      <Alert variant="warning" className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <AlertDescription className="m-0">
            <div>
              <strong>Unmapped Extensions Detected</strong>
              <p className="text-sm text-slate-600 mt-1">
                {unmappedData.length.toLocaleString()} extension{unmappedData.length !== 1 ? 's' : ''} require{unmappedData.length !== 1 ? '' : 's'} mapping.
              </p>
            </div>
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowDrawer(true)}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            View Details
          </Button>
        </div>
      </Alert>

      {showDrawer && (
        <UnmappedExtensionsDrawer
          unmappedData={unmappedData}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </>
  );
}
