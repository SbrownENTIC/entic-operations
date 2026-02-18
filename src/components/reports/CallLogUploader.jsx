import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function CallLogUploader({ onUploadSuccess }) {
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const { toast } = useToast();

  const parseDuration = (duration) => {
    if (!duration) return 0;
    // Handle "HH:MM:SS" string
    if (typeof duration === 'string') {
      const parts = duration.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 3600 + parts[1] * 60; // Assume HH:MM
      }
    }
    // Handle number (Excel sometimes exports time as fraction of day)
    if (typeof duration === 'number') {
      return Math.round(duration * 24 * 3600); // Convert days to seconds
    }
    return 0;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!selectedMonth) {
        toast({
            variant: "destructive",
            title: "Month Required",
            description: "Please select the reporting month before uploading."
        });
        return;
    }

    setIsUploading(true);
    setResults(null);

    try {
        // 1. Upload the file
        const { file_url } = await base44.integrations.Core.UploadFile({ file: file });

        // 2. Extract data
        const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
                type: "object",
                properties: {
                    "User": { type: "string" },
                    "Ext(s)": { type: ["string", "number"] },
                    "Total Calls": { type: "number" },
                    "Total Call Duration": { type: ["string", "number"] },
                    "Inbound Calls": { type: "number" },
                    "Inbound Call Duration": { type: ["string", "number"] },
                    "Outbound Calls": { type: "number" },
                    "Outbound Call Duration": { type: ["string", "number"] },
                    "Missed Calls": { type: "number" },
                    "Answered Calls": { type: "number" },
                    "Voicemail Calls": { type: "number" }
                }
            }
        });

        if (extractionResult.status === "error") {
            throw new Error(extractionResult.details || "Failed to extract data");
        }

        const rawData = extractionResult.output;
        if (!rawData || !Array.isArray(rawData)) {
            throw new Error("No data found in file or invalid format");
        }

        // 3. Transform data
        const monthDate = new Date(selectedMonth + "-01");
        const monthStr = monthDate.toISOString().split('T')[0];

        const records = rawData.map(row => ({
            month: monthStr,
            user: row["User"],
            extension: String(row["Ext(s)"] || ""),
            total_calls: Number(row["Total Calls"]) || 0,
            inbound_calls: Number(row["Inbound Calls"]) || 0,
            outbound_calls: Number(row["Outbound Calls"]) || 0,
            missed_calls: Number(row["Missed Calls"]) || 0,
            answered_calls: Number(row["Answered Calls"]) || 0,
            voicemail_calls: Number(row["Voicemail Calls"]) || 0,
            total_duration_seconds: parseDuration(row["Total Call Duration"]),
            inbound_duration_seconds: parseDuration(row["Inbound Call Duration"]),
            outbound_duration_seconds: parseDuration(row["Outbound Call Duration"]),
        })).filter(r => r.user && r.user !== 'User'); // Filter out empty or header rows if any

        // 4. Send to backend
        const response = await base44.functions.invoke('importCallLogs', { 
            records,
            month: monthStr
        });
        
        const data = response.data;
        setResults(data);
        
        if (data.imported > 0 || data.updated > 0) {
            toast({
                title: "Import Successful",
                description: `Imported: ${data.imported}, Updated: ${data.updated}, Skipped: ${data.skipped}`
            });
            if (onUploadSuccess) onUploadSuccess();
        } else {
            toast({
                title: "Import Complete",
                description: "No records were changed.",
                variant: "warning"
            });
        }

    } catch (error) {
        console.error("Upload error:", error);
        toast({
            variant: "destructive",
            title: "Upload Failed",
            description: error.message || "Failed to process file."
        });
    } finally {
        setIsUploading(false);
        event.target.value = '';
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Call Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Select Report Period</label>
            <input 
                type="month" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex-1 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                id="file-upload"
                className="hidden"
              />
              <label 
                htmlFor="file-upload" 
                className={`cursor-pointer flex flex-col items-center justify-center gap-2 ${isUploading ? 'opacity-50' : ''}`}
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                ) : (
                  <FileUp className="w-8 h-8 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {isUploading ? "Uploading..." : "Click to select Excel/CSV file"}
                </span>
                <span className="text-xs text-slate-500">
                  Supported: .xlsx, .xls, .csv
                </span>
              </label>
            </div>
          </div>

          {results && (
            <div className="space-y-2">
              <Alert variant={results.errors && results.errors.length > 0 ? "destructive" : "default"} className={(results.imported > 0 || results.updated > 0) ? "bg-green-50 border-green-200" : ""}>
                 {(results.imported > 0 || results.updated > 0) ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>
                    {(results.imported > 0 || results.updated > 0) ? "Import Complete" : "Import Status"}
                </AlertTitle>
                <AlertDescription>
                  Imported: {results.imported} | Updated: {results.updated} | Skipped: {results.skipped}
                  {results.errors && results.errors.length > 0 && (
                    <div className="mt-2 text-xs opacity-90 max-h-24 overflow-auto">
                      <strong>Errors:</strong>
                      <ul className="list-disc pl-4">
                        {results.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}