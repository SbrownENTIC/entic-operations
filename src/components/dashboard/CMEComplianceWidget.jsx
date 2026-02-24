import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, GraduationCap, CheckCircle2 } from "lucide-react";

export default function CMEComplianceWidget({ 
  doctors, 
  cmeByProvider, 
  doctorsCompliant, 
  doctorsNonCompliant, 
  exportCMECompliance,
  createCMEWaiverMutation
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">CME Non-Compliance - Doctors Requiring Attention</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Doctors must earn 3+ CME credits</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={exportCMECompliance}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <GraduationCap className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="text-xl font-bold text-slate-900">
            {doctorsCompliant} / {doctors.length}
          </div>
          <p className="text-xs text-slate-600">Doctors compliant</p>
        </div>
        {doctorsNonCompliant.length > 0 ? (
          <div className="space-y-2">
            {doctorsNonCompliant.map(doctor => {
              const credits = cmeByProvider[doctor.id] || 0;
              return (
                <div key={doctor.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-red-100 to-red-50 rounded-lg border-2 border-red-400 shadow-md hover:shadow-lg transition-all duration-200">
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 text-sm">{doctor.full_name}</p>
                    <p className="text-xs text-slate-700 font-medium">{credits} / 3 CME credits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createCMEWaiverMutation.mutate({
                        provider_id: doctor.id,
                        year: new Date().getFullYear()
                      })}
                      className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 bg-white/50"
                    >
                      Not Required
                    </Button>
                    <Badge className="bg-red-600 text-white border-0 font-bold text-xs">
                      Non-compliant
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium">All doctors are CME compliant!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}