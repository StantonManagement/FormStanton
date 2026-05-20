'use client';

import { useState, useRef } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';

interface UploadSignedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  signatureLabel: string;
}

export default function UploadSignedDialog({
  isOpen,
  onClose,
  onUpload,
  signatureLabel,
}: UploadSignedDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--ink)]">Upload Signed PDF</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-[var(--muted)] mb-4">
            Document: <span className="text-[var(--ink)] font-medium">{signatureLabel}</span>
          </p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border)] p-8 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
          >
            <Upload className="h-8 w-8 text-[var(--muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--ink)] mb-1">
              {selectedFile ? selectedFile.name : 'Click to select PDF file'}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Maximum file size: 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] hover:bg-[var(--paper)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
