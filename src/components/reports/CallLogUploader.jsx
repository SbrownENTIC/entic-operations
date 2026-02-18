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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fileName, setFileName] = useState('');
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

  const parseFilenameDate = (name) => {
    // Look for patterns like MM.DD.YY_MM.DD.YY or similar
    // Regex for MM.DD.YY
    const regex = /(\d{2})\.(\d{2})\.(\d{2})_(\d{2})\.(\d{2})\.(\d{2})/;
    const match = name.match(regex);
    
    if (match) {
        const [_, m1, d1, y1, m2, d2, y2] = match;
        // Assume 20xx for year
        const start = `20${y1}-${m1}-${d1}`;
        const end = `20${y2}-${m2}-${d2}`;
        return { start, end };
    }
    return null;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setFileName(file.name);
    const dates = parseFilenameDate(file.name);
    
    if (dates) {
        setStartDate(dates.start);
        setEndDate(dates.end);
        toast({
            title: "Dates Detected",
            description: `Reporting period detected: ${dates.start} to ${dates.end}`
        });
    }
    
    // Store file for upload step
    setFileToUpload(file);
  };

  const [fileToUpload, setFileToUpload] = useState(null);

  const handleUpload = async () => {
    if (!fileToUpload) return;

    if (!startDate || !endDate) {
        toast({
            variant: "destructive",
            title: "Dates Required",
            description: "Please specify the reporting period start and end dates."
        });
        return;
    }

    setIsUploading(true);
    setResults(null);

    try {
        // 1. Upload the file
        const { file_url } = await base44.integrations.Core.UploadFile({ file: fileToUpload });

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
        const records = rawData.map(row => ({
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
        })).filter(r => r.user && r.user !== 'User');

        // 4. Determine if dates were auto-detected
        const detectionType = fileName ? 
          (parseFilenameDate(fileName) ? 'auto' : 'manual') : 'manual';

        // 5. Send to backend
        const response = await base44.functions.invoke('importCallLogs', { 
            records,
            startDate,
            endDate,
            fileName: fileToUpload.name,
            detectionType
        });
        
        const data = response.data;
        setResults(data);
        
        if (data.imported > 0) {
            toast({
                title: "Import Successful",
                description: `Imported: ${data.imported} records. Detection: ${detectionType}`
            });
            if (onUploadSuccess) onUploadSuccess();
            // Reset
            setFileToUpload(null);
            setFileName('');
            setStartDate('');
            setEndDate('');
        } else {
            toast({
                title: "Import Complete",
                description: `No new records imported. Skipped: ${data.skipped}`,
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
          
          {!fileToUpload ? (
            <div className="flex items-center gap-4 p-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex-1 text-center">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  id="file-upload"
                  className="hidden"
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileUp className="w-10 h-10 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    Click to select Call Log file
                  </span>
                  <span className="text-xs text-slate-500">
                    Supported: .xlsx, .xls, .csv
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-md">
                <div className="flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-sm text-blue-900">{fileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFileToUpload(null); setStartDate(''); setEndDate(''); }}>
                    Change
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Start Date</label>
                    <input 
                        type="date"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">End Date</label>
                    <input 
                        type="date"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
              </div>

              <Button 
                onClick={handleUpload} 
                disabled={isUploading || !startDate || !endDate}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Data
                    </>
                )}
              </Button>
            </div>
          )}

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