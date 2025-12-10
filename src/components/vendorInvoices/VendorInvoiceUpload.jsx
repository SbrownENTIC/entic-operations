import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VendorInvoiceUpload({ onClose, onUploadComplete }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;

    setIsUploading(true);
    setProgress({ current: 0, total: files.length });
    
    // Batch size for uploads to avoid browser/network bottlenecks
    const BATCH_SIZE = 5;
    let completed = 0;
    
    try {
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const chunk = files.slice(i, i + BATCH_SIZE);
        
        await Promise.all(chunk.map(async (file) => {
          try {
            // 1. Upload file
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            // 2. Process with AI extraction
            await base44.functions.invoke('processVendorInvoice', { file_url });
          } catch (error) {
             console.error(`Failed to process ${file.name}:`, error);
             // We continue processing other files even if one fails
          } finally {
            completed++;
            setProgress(prev => ({ ...prev, current: completed }));
          }
        }));
      }
      
      onUploadComplete();
    } catch (error) {
      console.error("Batch upload error:", error);
      alert("Some files may have failed to upload. Please check the list.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-blue-900">Upload Invoices (Bulk)</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="invoice-file">Invoice Documents (Select multiple)</Label>
            <Input 
              id="invoice-file" 
              type="file" 
              accept=".pdf,.jpg,.jpeg,.png" 
              onChange={handleFileChange} 
              disabled={isUploading} 
              multiple 
            />
            {files.length > 0 && (
              <p className="text-sm text-blue-700 font-medium">
                {files.length} files selected
              </p>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={files.length === 0 || isUploading} className="bg-blue-600 hover:bg-blue-700">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing {progress.current}/{progress.total}...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {files.length > 0 ? `${files.length} Invoices` : 'Invoices'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}