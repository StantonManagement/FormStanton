'use client';

import { useCallback, useState } from 'react';

interface FormDocumentUploadProps {
  maxFiles: number;
  maxSize: number;
  acceptedTypes: string[];
  label: string;
  helperText?: string;
  documents: File[];
  onDocumentsChange: (documents: File[]) => void;
  errorMessages: {
    maxFiles: string;
    fileSize: string;
    fileType: string;
  };
}

export default function FormDocumentUpload({
  maxFiles,
  maxSize,
  acceptedTypes,
  label,
  helperText,
  documents,
  onDocumentsChange,
  errorMessages,
}: FormDocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return errorMessages.fileType;
    }
    if (file.size > maxSize) {
      return errorMessages.fileSize;
    }
    return null;
  }, [acceptedTypes, maxSize, errorMessages]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    setError(null);
    const newFiles = Array.from(files);
    
    // Check total file count
    if (documents.length + newFiles.length > maxFiles) {
      setError(errorMessages.maxFiles);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    for (const file of newFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      validFiles.push(file);
    }

    onDocumentsChange([...documents, ...validFiles]);
  }, [documents, maxFiles, validateFile, onDocumentsChange, errorMessages]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    onDocumentsChange(documents.filter((_, i) => i !== index));
    setError(null);
  }, [documents, onDocumentsChange]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-[var(--ink)]">
        {label}
      </label>
      
      {helperText && (
        <p className="text-xs text-[var(--muted)]">{helperText}</p>
      )}

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-sm p-6 text-center transition-colors
          ${dragActive 
            ? 'border-[var(--primary)] bg-[var(--primary)]/5' 
            : 'border-[var(--border)] hover:border-[var(--primary)]/50'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={documents.length >= maxFiles}
        />
        
        <div className="pointer-events-none">
          <svg
            className="mx-auto h-12 w-12 text-[var(--muted)]"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-[var(--ink)]">
            {documents.length >= maxFiles ? errorMessages.maxFiles : helperText}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {documents.length} of {maxFiles} files uploaded
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* File List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-[var(--bg-section)] border border-[var(--border)] rounded-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--ink)] truncate">
                  {file.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
