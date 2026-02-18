import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import CallLogDashboard from '@/components/reports/CallLogDashboard';
import { Loader2 } from 'lucide-react';

export default function CallLogReportsPage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CallLogDashboard user={user} />
    </div>
  );
}