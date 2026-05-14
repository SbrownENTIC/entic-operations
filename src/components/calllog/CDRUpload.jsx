import React, { useRef, useState, useEffect } from 'react';
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
  const [importJobId, setImportJobId] = useState(null);
  const pollIntervalRef = useRef(null);

  // Poll import job progress
  useEffect(() => {
    if (!importJobId) return;

    const pollJob = async () => {
      try {
        const response = await base44.functions.invoke('getImportJobStatus', {
          importJobId: importJobId
        });
        
        const job = response.data;
        if (!job) return;

        const percentComplete = Math.round((job.processed_rows / job.total_rows) * 100);
        setProgress({
          totalRows: job.total_rows,
          processedRows: job.processed_rows,
          percentComplete,
          status: job.status
        });

        // Stop polling when complete or error
        if (job.status === 'complete' || job.status === 'error') {
          clearInterval(pollIntervalRef.current);
          setUploading(false);
          setImportJobId(null);

          if (job.status === 'complete') {
            setMessage({
              type: 'success',
              text: `Import Complete - ${job.processed_rows.toLocaleString()} rows processed`
            });
            if (onUploadSuccess) {
              onUploadSuccess();
            }
          } else {
            setMessage({
              type: 'error',
              text: `Import failed: ${job.error_message}`
            });
          }
        }
      } catch (error) {
        console.error('Error polling import job:', error);
      }
    };

    pollJob();
    pollIntervalRef.current = setInterval(pollJob, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [importJobId, onUploadSuccess]);

  const handleFileSelect = async (file, type) => {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Only CSV files are supported' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setProgress(null);

    try {
      // Read file as text
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          
          // Call backend function to create ImportJob
          const response = await base44.functions.invoke('importCallLogData', {
            file: fileContent,
            type: type
          });

          // Store job ID to poll
          setImportJobId(response.data.importJobId);
          setProgress({
            totalRows: response.data.totalRows,
            processedRows: 0,
            percentComplete: 0,
            status: 'processing'
          });

          // Reset input
          if (type === 'inbound' && inboundInputRef.current) {
            inboundInputRef.current.value = '';
          } else if (type === 'outbound' && outboundInputRef.current) {
            outboundInputRef.current.value = '';
          }
        } catch (error) {
          setUploading(false);
          setMessage({
            type: 'error',
            text: `Import failed: ${error.message}`
          });
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setUploading(false);
      setMessage({
        type: 'error',
        text: `File reading failed: ${error.message}`
      });
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

      {/* Progress Tracking */}
      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-semibold text-blue-900">
              <span>Import Progress</span>
              <span>{progress.percentComplete}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
            
            {/* Progress Details */}
            <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
              <p>Rows Processed: {progress.processedRows.toLocaleString()} / {progress.totalRows.toLocaleString()}</p>
              <p>Status: {progress.status === 'complete' ? '✓ Complete' : '⏳ ' + progress.status}</p>
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