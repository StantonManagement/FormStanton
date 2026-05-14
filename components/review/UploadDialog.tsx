'use client';

import { useRef, useState } from 'react';

interface Document {
  id: string;
  label: string;
  doc_type: string;
  status: string;
}

interface UploadDialogProps {
  uploadUrl: string;
  doc: Document;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadDialog({
  uploadUrl,
  doc,
  onClose,
  onSuccess,
}: UploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('document_id', doc.id);
      if (note.trim()) {
        fd.append('staff_upload_note', note.trim());
      }

      const res = await fetch(
        uploadUrl,
        { method: 'POST', body: fd }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Upload failed');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-[var(--border)] w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold font-serif text-[var(--ink)]">
            Upload Document on Behalf of Tenant
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Slot: <span className="font-medium text-[var(--ink)]">{doc.label}</span>
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[var(--ink)] uppercase tracking-wide">
            File <span className="text-[var(--error)]">*</span>
          </label>
          <div
            className="border border-dashed border-[var(--border)] p-4 text-center cursor-pointer hover:border-[var(--primary)] transition-colors duration-200"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <p className="text-sm text-[var(--ink)] font-medium truncate">{selectedFile.name}</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">Click to choose file — JPEG, PNG, WebP, PDF · max 20 MB</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[var(--ink)] uppercase tracking-wide">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Scanned from paper document delivered at office"
            rows={3}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none bg-white"
          />
        </div>

        {error && (
          <p className="text-xs text-[var(--error)]">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-2 px-4 border border-[var(--border)] text-sm text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="flex-1 py-2 px-4 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity duration-200 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
