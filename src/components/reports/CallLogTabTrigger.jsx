import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';

export default function CallLogTabTrigger() {
  const { data: inbound = [] } = useQuery({
    queryKey: ['call-log-tab-inbound-calls'],
    queryFn: () => base44.entities.InboundCallRaw.list(),
  });

  const { data: outbound = [] } = useQuery({
    queryKey: ['call-log-tab-outbound-calls'],
    queryFn: () => base44.entities.OutboundCallRaw.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['call-log-tab-user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  const unmappedCount = useMemo(() => {
    const mappedExts = new Set();
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          mappedExts.add(ext);
        });
      }
    });

    const unmapped = new Set();

    inbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        unmapped.add(call.extension);
      }
    });

    outbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        unmapped.add(call.extension);
      }
    });

    return unmapped.size;
  }, [inbound, outbound, users]);

  return (
    <TabsTrigger value="call-log" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm relative">
      <BarChart3 className="w-5 h-5 shrink-0" />
      <span className="text-xs font-medium">Call Log</span>
      {unmappedCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {unmappedCount > 99 ? '99+' : unmappedCount}
        </div>
      )}
    </TabsTrigger>
  );
}