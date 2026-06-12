import React from 'react';
import { TabsTrigger } from '@/components/ui/tabs';
import { BarChart3 } from 'lucide-react';

export default function CallLogTabTrigger() {
  return (
    <TabsTrigger value="call-log" className="flex flex-col items-center justify-center gap-2 py-4 h-full whitespace-normal text-center bg-slate-50 border border-slate-200 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm relative">
      <BarChart3 className="w-5 h-5 shrink-0" />
      <span className="text-xs font-medium">Call Log</span>
    </TabsTrigger>
  );
}
