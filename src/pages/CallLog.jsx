import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import CallLogDashboard from "../pages/CallLogDashboard";

export default function CallLog() {
  return <CallLogDashboard />;
}