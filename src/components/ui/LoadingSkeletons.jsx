import React from "react";
import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

export function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Skeleton className="h-[300px] w-full rounded-lg" />
           <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex gap-2">
             <Skeleton className="h-10 w-24" />
             <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-4 hidden md:grid">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-1 w-full">
                      <Skeleton className="h-4 w-[80%]" />
                      <Skeleton className="h-3 w-[50%]" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full hidden md:block" />
                  <Skeleton className="h-4 w-full hidden md:block" />
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}