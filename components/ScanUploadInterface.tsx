'use client';

import { useState } from 'react';
import AlertDialog from '@/components/kit/AlertDialog';

interface ScanBatch {
  id: string;
  created_at: string;
  uploaded_by: string;
  total_pages: number;
  status: string;
  notes: string | null;
}

interface ScanUploadInterfaceProps {
  onBatchCreated: (batchId: string) => void;
  batches: ScanBatch[];
  onRefresh: () => void;
  onReviewBatch: (batchId: string) => void;
}

export default function ScanUploadInterface({ onBatchCreated, batches, onRefresh, onReviewBatch }: ScanUploadInterfaceProps) {
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress('Uploading file...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', 'admin');

      const response = await fetch('/api/admin/scan-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadProgress(`Uploaded ${result.totalPages} page(s) successfully!`);
        onBatchCreated(result.batchId);
        onRefresh();
        
        // Auto-start extraction
        setTimeout(() => {
          handleExtract(result.batchId);
        }, 1000);
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Upload Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Upload Failed',
        message: 'Upload failed',
        variant: 'error'
      });
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleExtract = async (batchId: string) => {
    setExtracting(batchId);
    setUploadProgress('Extracting data with AI...');

    try {
      const response = await fetch('/api/admin/extract-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadProgress(`Extracted ${result.processedCount} page(s)! Ready for review.`);
        onRefresh();
        
        // Auto-open review interface
        setTimeout(() => {
          onReviewBatch(batchId);
          setUploadProgress('');
        }, 2000);
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Extraction Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Extraction Failed',
        message: 'Extraction failed',
        variant: 'error'
      });
    } finally {
      setExtracting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      uploaded: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Uploaded' },
      processing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Processing' },
      ready_for_review: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Ready for Review' },
      imported: { bg: 'bg-green-100', text: 'text-green-800', label: 'Imported' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    
    return (
      <span className={`px-2 py-1 rounded text-xs ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Upload Scanned Forms</h3>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  {uploading ? 'Uploading...' : 'Click to upload PDF or images'}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  PDF, PNG, or JPG files
                </span>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {uploadProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              {uploadProgress}
            </div>
          )}

          <div className="bg-gray-50 rounded p-4 text-sm text-gray-700">
            <h4 className="font-medium mb-2">How it works:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Upload your scanned forms (PDF or images)</li>
              <li>AI automatically extracts data from each page</li>
              <li>Review and correct extracted data</li>
              <li>Import verified submissions to database</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Batches List */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Scan Batches</h3>
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>

        {batches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No scan batches yet. Upload your first batch above!</p>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => (
              <div key={batch.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {batch.total_pages} page{batch.total_pages !== 1 ? 's' : ''}
                      </span>
                      {getStatusBadge(batch.status)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Uploaded {new Date(batch.created_at).toLocaleString()}
                      {batch.uploaded_by && ` by ${batch.uploaded_by}`}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {batch.status === 'uploaded' && (
                      <button
                        onClick={() => handleExtract(batch.id)}
                        disabled={extracting === batch.id}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {extracting === batch.id ? 'Extracting...' : 'Extract Data'}
                      </button>
                    )}
                    
                    {batch.status === 'ready_for_review' && (
                      <button
                        onClick={() => onReviewBatch(batch.id)}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Review & Import
                      </button>
                    )}

                    {batch.status === 'imported' && (
                      <span className="px-3 py-1 text-sm text-green-600">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        variant={alertDialog.variant}
      />
    </div>
  );
}
