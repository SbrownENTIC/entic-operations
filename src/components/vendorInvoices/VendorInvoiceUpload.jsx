import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Upload, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VendorInvoiceUpload({ onClose, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2. Process with AI extraction
      await base44.functions.invoke('processVendorInvoice', { file_url });

      onUploadComplete();
    } catch (error) {
      console.error("Upload failed:", error);
      // In a real app, show error toast here
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-blue-900">Upload New Invoice</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="invoice-file">Invoice Document (PDF or Image)</Label>
            <Input id="invoice-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={isUploading} />
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={!file || isUploading} className="bg-blue-600 hover:bg-blue-700">
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Invoice
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}