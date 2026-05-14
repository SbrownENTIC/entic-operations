import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CDRUpload({ onUploadSuccess }) {
  const inboundInputRef = useRef(null);
  const outboundInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleFileSelect = async (file, type) => {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Only CSV files are supported' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          
          // Call backend function
          const response = await base44.functions.invoke('importCallLogData', {
            file: fileContent,
            type: type
          });

          // Show success message
          const typeLabel = type === 'inbound' ? 'Inbound' : 'Outbound';
          const result = response.data;
          setMessage({
            type: 'success',
            text: `${typeLabel} CDR Imported Successfully - ${result.totalRowsInserted} of ${result.totalRowsParsed} records created in ${result.durationSeconds}s`
          });

          // Show progress summary
          setProgress({
            totalRowsParsed: result.totalRowsParsed,
            totalRowsInserted: result.totalRowsInserted,
            totalBatches: result.totalBatches,
            durationSeconds: result.durationSeconds,
            completed: true
          });

          // Trigger refresh
          if (onUploadSuccess) {
            onUploadSuccess();
          }

          // Reset input
          if (type === 'inbound' && inboundInputRef.current) {
            inboundInputRef.current.value = '';
          } else if (type === 'outbound' && outboundInputRef.current) {
            outboundInputRef.current.value = '';
          }
        } catch (error) {
          setMessage({
            type: 'error',
            text: `Import failed: ${error.message}`
          });
        } finally {
          setUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `File reading failed: ${error.message}`
      });
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Message Alert */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-600" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Progress Summary */}
      {progress && progress.completed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-blue-900">Import Summary</p>
            <div className="grid grid-cols-2 gap-2 text-blue-800">
              <p>Total Rows Parsed: {progress.totalRowsParsed.toLocaleString()}</p>
              <p>Rows Inserted: {progress.totalRowsInserted.toLocaleString()}</p>
              <p>Total Batches: {progress.totalBatches}</p>
              <p>Duration: {progress.durationSeconds}s</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Buttons */}
      <div className="flex gap-3">
        <div>
          <input
            ref={inboundInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0], 'inbound')}
            disabled={uploading}
          />
          <Button
            onClick={() => inboundInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Inbound CDR
          </Button>
        </div>

        <div>
          <input
            ref={outboundInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0], 'outbound')}
            disabled={uploading}
          />
          <Button
            onClick={() => outboundInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Outbound CDR
          </Button>
        </div>
      </div>
    </div>
  );
}