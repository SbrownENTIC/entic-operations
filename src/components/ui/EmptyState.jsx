import React from "react";
import { FileX2 } from "lucide-react";

export default function EmptyState({ 
  icon: Icon = FileX2, 
  title = "No data found", 
  description = "No records match your criteria.", 
  action 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
      <div className="bg-slate-100 p-4 rounded-full mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        {description}
      </p>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}