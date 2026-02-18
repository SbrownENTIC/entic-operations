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

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = text.split('\n');
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]+/g, ''));
        
        const records = [];
        
        // Basic CSV parsing (not handling embedded commas in quotes for simplicity, as per requirements/time)
        // A more robust solution would use a library if needed.
        
        for (let i = 1; i < rows.length; i++) {
          if (!rows[i].trim()) continue;
          
          const values = rows[i].split(',').map(v => v.trim().replace(/['"]+/g, ''));
          const record = {};
          
          headers.forEach((header, index) => {
            // Map common CSV headers to entity fields
            let field = header;
            if (header.includes('week') && header.includes('ending')) field = 'week_ending';
            if (header.includes('total') && header.includes('duration')) field = 'total_duration_minutes';
            // ... add other mappings as necessary or rely on user matching CSV headers to schema
            
            // Simple direct mapping fallback
            record[field] = values[index];
          });
          
          // Basic cleanup/validation logic
          if (record.week_ending) {
             // Ensure date format YYYY-MM-DD
             const d = new Date(record.week_ending);
             if (!isNaN(d.getTime())) {
                 record.week_ending = d.toISOString().split('T')[0];
                 // Calculate month (1st of month)
                 const m = new Date(d.getFullYear(), d.getMonth(), 1);
                 record.month = m.toISOString().split('T')[0];
             }
          }

          records.push(record);
        }

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
          description: error.message || "Failed to parse or upload file."
        });
      } finally {
        setIsUploading(false);
        // Reset file input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
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
                accept=".csv"
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
                  {isUploading ? "Uploading..." : "Click to select CSV file"}
                </span>
                <span className="text-xs text-slate-500">
                  Headers must match: user, week_ending, total_calls, etc.
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