import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BellRing, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

const STAGES = ["30 Day", "14 Day", "7 Day"];

const STATUS_COLORS = {
  "Not Queued": "bg-gray-100 text-gray-700",
  "Queued": "bg-blue-100 text-blue-800",
  "Sent": "bg-green-100 text-green-800",
  "Failed": "bg-red-100 text-red-800",
  "Cancelled": "bg-slate-100 text-slate-700"
};

function getStageRecord(queue, license, stage) {
  return queue.find(record =>
    record.notification_type === "License Expiration Reminder" &&
    record.related_entity === "License" &&
    record.related_record_id === license.id &&
    record.reminder_stage === stage &&
    record.expiration_date === license.expiration_date
  );
}

function getLabel(record) {
  if (!record) return "Not Queued";
  if (record.status === "Ready to Send") return "Queued";
  return record.status || "Not Queued";
}

export default function LicenseReminderStatus({ license, notificationQueue, onQueue, isQueueing, isAdmin }) {
  const sentDates = STAGES
    .map(stage => getStageRecord(notificationQueue, license, stage)?.sent_date)
    .filter(Boolean)
    .sort();
  const lastSentDate = sentDates.length ? sentDates[sentDates.length - 1] : null;

  return (
    <div className="space-y-1 text-xs">
      {STAGES.map(stage => {
        const record = getStageRecord(notificationQueue, license, stage);
        const label = getLabel(record);
        const shortStage = stage === "30 Day" ? "30d" : stage === "14 Day" ? "14d" : "7d";
        return (
          <div key={stage} className="flex items-center justify-between gap-2">
            <span className="text-slate-600">{shortStage}:</span>
            <Badge className={`${STATUS_COLORS[label]} text-xs px-1.5 py-0.5`}>{label}</Badge>
          </div>
        );
      })}
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQueue(license)}
          disabled={isQueueing}
          className="w-full gap-1 h-7 text-xs mt-1"
        >
          {isQueueing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BellRing className="w-2.5 h-2.5" />}
          Queue
        </Button>
      )}
    </div>
  );
}