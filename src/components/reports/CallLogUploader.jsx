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
  const { toast } = useToast();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setResults(null);

    try {
      // 1. Upload file to Base44 storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // 2. Extract data from Excel/CSV
      const extractionSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            user: { type: "string", description: "Name of the user or agent" },
            week_ending: { type: "string", description: "Date of week ending (YYYY-MM-DD)" },
            extension: { type: "string" },
            total_calls: { type: "number" },
            inbound_calls: { type: "number" },
            outbound_calls: { type: "number" },
            answered_calls: { type: "number" },
            missed_calls: { type: "number" },
            voicemail_calls: { type: "number" },
            total_duration_minutes: { type: "number" },
            inbound_duration_minutes: { type: "number" },
            outbound_duration_minutes: { type: "number" }
          },
          required: ["user"]
        }
      };

      const { output } = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (!output || !Array.isArray(output)) {
        throw new Error("Failed to extract data from file. Please ensure columns match the expected format.");
      }

      // 3. Process records (calculate month, ensure numeric values)
      const records = output.map(record => {
        const cleanRecord = { ...record };
        
        // Handle week_ending date parsing
        if (cleanRecord.week_ending) {
           const d = new Date(cleanRecord.week_ending);
           if (!isNaN(d.getTime())) {
               cleanRecord.week_ending = d.toISOString().split('T')[0];
               // Calculate month (1st of month) based on week ending
               const m = new Date(d.getFullYear(), d.getMonth(), 1);
               cleanRecord.month = m.toISOString().split('T')[0];
           }
        }

        return cleanRecord;
      });

      // 4. Import to database
      const response = await base44.functions.invoke('importCallLogs', { records });
      setResults(response.data);
      
      if (response.data.imported > 0) {
        toast({
          title: "Import Successful",
          description: `Imported ${response.data.imported} records. Skipped ${response.data.skipped} duplicates.`
        });
        if (onUploadSuccess) onUploadSuccess();
      } else if (response.data.skipped > 0) {
           toast({
          title: "Import Complete",
          description: `Skipped ${response.data.skipped} duplicates. No new records imported.`,
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
          <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex-1 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
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
                  {isUploading ? "Processing..." : "Click to select Excel or CSV file"}
                </span>
                <span className="text-xs text-slate-500">
                  Supports .xlsx, .xls, and .csv formats
                </span>
              </label>
            </div>
          </div>

          {results && (
            <div className="space-y-2">
              <Alert variant={results.errors && results.errors.length > 0 ? "destructive" : "default"} className={results.imported > 0 ? "bg-green-50 border-green-200" : ""}>
                 {results.imported > 0 ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>
                    {results.imported > 0 ? "Import Complete" : "Import Status"}
                </AlertTitle>
                <AlertDescription>
                  Imported: {results.imported} | Skipped: {results.skipped}
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