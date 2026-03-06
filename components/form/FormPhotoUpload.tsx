'use client';

import { useState, useRef, useCallback } from 'react';

interface FormPhotoUploadProps {
  maxPhotos: number;
  label: string;
  helperText?: string;
  required?: boolean;
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
}

export default function FormPhotoUpload({
  maxPhotos,
  label,
  helperText,
  required = false,
  photos,
  onPhotosChange,
  accept = 'image/jpeg,image/jpg,image/png,image/heic',
  maxSizeMB = 5,
}: FormPhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      setError(`File ${file.name} is too large. Maximum size is ${maxSizeMB}MB.`);
      return false;
    }

    const acceptedTypes = accept.split(',').map(t => t.trim());
    if (!acceptedTypes.some(type => file.type === type || file.name.toLowerCase().endsWith(type.replace('image/', '.')))) {
      setError(`File ${file.name} is not an accepted format.`);
      return false;
    }

    return true;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    setError('');
    const filesArray = Array.from(newFiles);
    const validFiles = filesArray.filter(validateFile);

    if (validFiles.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    if (validFiles.length > remainingSlots) {
      setError(`You can only upload ${remainingSlots} more photo(s). Maximum is ${maxPhotos}.`);
      const filesToAdd = validFiles.slice(0, remainingSlots);
      onPhotosChange([...photos, ...filesToAdd]);
    } else {
      onPhotosChange([...photos, ...validFiles]);
    }
  }, [photos, maxPhotos, onPhotosChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
    setError('');
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--ink)]">
          {label}
          {required && <span className="text-[var(--error)]"> *</span>}
        </label>
        <span className="text-xs text-[var(--muted)]">
          {photos.length} / {maxPhotos} photos
        </span>
      </div>

      {helperText && (
        <p className="text-xs text-[var(--muted)]">{helperText}</p>
      )}

      {/* Upload Area */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            mt-1 border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors
            ${isDragging 
              ? 'border-[var(--primary)] bg-[var(--primary)]/5' 
              : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-section)]'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-sm">
              <span className="text-[var(--primary)] font-medium">Click to upload</span>
              <span className="text-[var(--muted)]"> or drag and drop</span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              JPG, PNG, HEIC up to {maxSizeMB}MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Photo Previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-sm overflow-hidden border border-[var(--border)] bg-[var(--bg-section)]">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-xs text-[var(--muted)] mt-1 truncate">{photo.name}</p>
              <p className="text-xs text-[var(--muted)]">{(photo.size / 1024).toFixed(0)} KB</p>
            </div>
          ))}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-center text-[var(--muted)] mt-2">
          Maximum number of photos reached
        </p>
      )}
    </div>
  );
}
