'use client';

/**
 * components/pbv/MultiFileDropZone.tsx
 *
 * Drag-and-drop multi-file upload zone with slot assignment.
 * F2 of PRD-41.
 */

import { useState, useRef, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import DedupApplyDialog from './DedupApplyDialog';

interface MissingSlot {
  id: string;
  doc_type: string;
  label: string;
  category: string | null;
  person_slot: number | null;
}

interface PendingFile {
  id: string;
  file: File;
  assignedSlotId: string | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

interface MultiFileDropZoneProps {
  token: string;
  language: 'en' | 'es' | 'pt';
  missingSlots: MissingSlot[];
  onUploadsComplete: () => void;
}

interface DedupResult {
  sourceDocId: string;
  filename: string;
  compatibleSlots: Array<{ id: string; doc_type: string; label: string; category: string | null; person_slot: number | null }>;
}

const copy = {
  en: {
    dropzoneText: 'Drop files here or click to select multiple',
    dropzoneSubtext: 'Accepted: JPEG, PNG, PDF, HEIC. Max 25MB each.',
    pendingFiles: 'Pending files',
    assignSlot: 'Assign to document...',
    uploadAll: (n: number) => `Upload all (${n})`,
    remove: 'Remove',
    uploading: 'Uploading...',
    error: 'Error',
    fileTooLarge: 'File too large (max 25MB)',
    invalidFileType: 'Invalid file type',
    slotConflict: 'Another file is already assigned to this slot',
    allSlotsAssigned: 'All files assigned',
    selectSlotFirst: 'Assign all files to slots before uploading',
    uploadComplete: 'Upload complete',
  },
  es: {
    dropzoneText: 'Arrastre archivos aquí o haga clic para seleccionar varios',
    dropzoneSubtext: 'Aceptados: JPEG, PNG, PDF, HEIC. Máx 25MB cada uno.',
    pendingFiles: 'Archivos pendientes',
    assignSlot: 'Asignar a documento...',
    uploadAll: (n: number) => `Subir todos (${n})`,
    remove: 'Eliminar',
    uploading: 'Subiendo...',
    error: 'Error',
    fileTooLarge: 'Archivo demasiado grande (máx 25MB)',
    invalidFileType: 'Tipo de archivo inválido',
    slotConflict: 'Otro archivo ya está asignado a este documento',
    allSlotsAssigned: 'Todos los archivos asignados',
    selectSlotFirst: 'Asigne todos los archivos antes de subir',
    uploadComplete: 'Subida completa',
  },
  pt: {
    dropzoneText: 'Arraste arquivos aqui ou clique para selecionar vários',
    dropzoneSubtext: 'Aceitos: JPEG, PNG, PDF, HEIC. Máx 25MB cada.',
    pendingFiles: 'Arquivos pendentes',
    assignSlot: 'Atribuir ao documento...',
    uploadAll: (n: number) => `Enviar todos (${n})`,
    remove: 'Remover',
    uploading: 'Enviando...',
    error: 'Erro',
    fileTooLarge: 'Arquivo muito grande (máx 25MB)',
    invalidFileType: 'Tipo de arquivo inválido',
    slotConflict: 'Outro arquivo já está atribuído a este documento',
    allSlotsAssigned: 'Todos os arquivos atribuídos',
    selectSlotFirst: 'Atribua todos os arquivos antes de enviar',
    uploadComplete: 'Envio completo',
  },
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic', 'image/heif'];
const CONCURRENT_UPLOADS = 4;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File): string {
  if (file.type === 'application/pdf') return '📄';
  if (file.type.startsWith('image/')) return '🖼️';
  return '📎';
}

// Simple filename-to-slot matching heuristic
function suggestSlot(filename: string, slots: MissingSlot[]): string | null {
  const lower = filename.toLowerCase();
  
  // Paystub patterns
  if (lower.includes('pay') || lower.includes('paystub') || lower.includes('paycheck')) {
    const paystubSlot = slots.find((s) => s.doc_type === 'paystubs');
    if (paystubSlot) return paystubSlot.id;
  }
  
  // Bank statement patterns
  if (lower.includes('bank')) {
    if (lower.includes('check')) {
      const checkingSlot = slots.find((s) => s.doc_type === 'bank_statement_checking');
      if (checkingSlot) return checkingSlot.id;
    }
    if (lower.includes('saving')) {
      const savingsSlot = slots.find((s) => s.doc_type === 'bank_statement_savings');
      if (savingsSlot) return savingsSlot.id;
    }
  }
  
  // SSI patterns
  if (lower.includes('ssi') || lower.includes('social security')) {
    const ssiSlot = slots.find((s) => s.doc_type === 'ssi_award_letter');
    if (ssiSlot) return ssiSlot.id;
  }
  
  // ID patterns
  if (lower.includes('id') || lower.includes('license') || lower.includes('passport')) {
    const idSlot = slots.find((s) => s.doc_type.includes('id_') || s.doc_type.includes('license') || s.doc_type.includes('passport'));
    if (idSlot) return idSlot.id;
  }
  
  return null;
}

export default function MultiFileDropZone({
  token,
  language,
  missingSlots,
  onUploadsComplete,
}: MultiFileDropZoneProps) {
  const c = copy[language] ?? copy.en;
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dedup dialog state for batch dedup
  const [dedupQueue, setDedupQueue] = useState<DedupResult[]>([]);
  const [currentDedupIndex, setCurrentDedupIndex] = useState(0);

  const allSlotsAssigned = pendingFiles.length > 0 && pendingFiles.every((f) => f.assignedSlotId);

  // Group slots by category
  const slotsByCategory = missingSlots.reduce<Record<string, MissingSlot[]>>((acc, slot) => {
    const cat = slot.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(slot);
    return acc;
  }, {});

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return c.fileTooLarge;
    if (!ALLOWED_TYPES.includes(file.type)) return c.invalidFileType;
    return null;
  };

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newFiles: PendingFile[] = [];
      
      Array.from(files).forEach((file) => {
        const error = validateFile(file);
        const suggestedSlotId = suggestSlot(file.name, missingSlots);
        
        newFiles.push({
          id: generateId(),
          file,
          assignedSlotId: suggestedSlotId,
          status: error ? 'error' : 'pending',
          errorMessage: error || undefined,
        });
      });

      setPendingFiles((prev) => [...prev, ...newFiles]);
    },
    [missingSlots, c.fileTooLarge, c.invalidFileType]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = ''; // Reset for re-selection
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const assignSlot = (fileId: string, slotId: string | null) => {
    setPendingFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, assignedSlotId: slotId } : f))
    );
  };

  // Check if another pending file is already assigned to this slot
  const getSlotConflict = (slotId: string | null, excludeFileId: string): string | null => {
    if (!slotId) return null;
    const conflict = pendingFiles.find((f) => f.id !== excludeFileId && f.assignedSlotId === slotId);
    return conflict ? c.slotConflict : null;
  };

  const uploadFile = async (pendingFile: PendingFile): Promise<{ success: boolean; docId?: string; filename?: string; compatibleSlots?: DedupResult['compatibleSlots'] }> => {
    if (!pendingFile.assignedSlotId || pendingFile.status === 'error') {
      return { success: false };
    }

    setPendingFiles((prev) =>
      prev.map((f) => (f.id === pendingFile.id ? { ...f, status: 'uploading' } : f))
    );

    try {
      const formData = new FormData();
      formData.append('file', pendingFile.file);

      const response = await tenantFetch(
        `/api/t/${token}/pbv-full-app/documents/${pendingFile.assignedSlotId}/upload`,
        { method: 'POST', body: formData }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Upload failed');
      }

      setPendingFiles((prev) =>
        prev.map((f) => (f.id === pendingFile.id ? { ...f, status: 'done' } : f))
      );

      // Check for dedup
      const byHashRes = await tenantFetch(
        `/api/t/${token}/pbv-full-app/documents/by-hash?hash=pending&exclude_doc_id=${pendingFile.assignedSlotId}`,
        { method: 'GET' }
      );

      let compatibleSlots: DedupResult['compatibleSlots'] = [];
      if (byHashRes.ok) {
        const byHashResult = await byHashRes.json();
        if (byHashResult.success) {
          compatibleSlots = byHashResult.data?.compatible_missing_slots ?? [];
        }
      }

      return {
        success: true,
        docId: pendingFile.assignedSlotId,
        filename: pendingFile.file.name,
        compatibleSlots,
      };
    } catch (err: any) {
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === pendingFile.id ? { ...f, status: 'error', errorMessage: err.message } : f
        )
      );
      return { success: false };
    }
  };

  const handleUploadAll = async () => {
    if (!allSlotsAssigned || isUploading) return;

    setIsUploading(true);

    const filesToUpload = pendingFiles.filter(
      (f) => f.assignedSlotId && f.status !== 'error' && f.status !== 'done'
    );

    // Process uploads with concurrency limit
    const queue = [...filesToUpload];
    const results: DedupResult[] = [];
    const activePromises: Promise<void>[] = [];

    const processNext = async () => {
      const file = queue.shift();
      if (!file) return;

      const result = await uploadFile(file);
      if (result.success && result.compatibleSlots && result.compatibleSlots.length > 0) {
        results.push({
          sourceDocId: result.docId!,
          filename: result.filename!,
          compatibleSlots: result.compatibleSlots,
        });
      }

      if (queue.length > 0) {
        await processNext();
      }
    };

    // Start initial batch of concurrent uploads
    for (let i = 0; i < Math.min(CONCURRENT_UPLOADS, queue.length); i++) {
      activePromises.push(processNext());
    }

    await Promise.all(activePromises);

    setIsUploading(false);

    // Handle batch dedup dialog
    if (results.length > 0) {
      setDedupQueue(results);
      setCurrentDedupIndex(0);
    } else {
      // All done - refresh parent
      onUploadsComplete();
      setPendingFiles([]);
    }
  };

  const handleDedupApply = async (selectedIds: string[]) => {
    const currentDedup = dedupQueue[currentDedupIndex];
    if (!currentDedup) return;

    if (selectedIds.length > 0) {
      try {
        await tenantFetch(`/api/t/${token}/pbv-full-app/documents/bulk-apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_doc_id: currentDedup.sourceDocId,
            target_doc_ids: selectedIds,
          }),
        });
      } catch (err) {
        console.error('[MultiFileDropZone] Bulk apply failed:', err);
      }
    }

    // Move to next dedup or finish
    if (currentDedupIndex < dedupQueue.length - 1) {
      setCurrentDedupIndex((prev) => prev + 1);
    } else {
      // All dedups handled
      setDedupQueue([]);
      setCurrentDedupIndex(0);
      onUploadsComplete();
      setPendingFiles([]);
    }
  };

  const handleDedupClose = () => {
    // Skip remaining dedups
    setDedupQueue([]);
    setCurrentDedupIndex(0);
    onUploadsComplete();
    setPendingFiles([]);
  };

  // Don't render if no missing slots
  if (missingSlots.length === 0) return null;

  const currentDedup = dedupQueue[currentDedupIndex];

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-[var(--primary)] bg-blue-50' : 'border-[var(--border)] bg-white'}
          hover:border-[var(--primary)] hover:bg-gray-50
        `}
      >
        <p className="text-base font-medium text-[var(--body)] mb-1">{c.dropzoneText}</p>
        <p className="text-sm text-[var(--muted)]">{c.dropzoneSubtext}</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/*,.heic,.heif"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Pending Files Panel */}
      {pendingFiles.length > 0 && (
        <div className="bg-white border border-[var(--border)] p-4">
          <h4 className="text-sm font-semibold text-[var(--body)] mb-3">{c.pendingFiles}</h4>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pendingFiles.map((pf) => {
              const conflict = pf.assignedSlotId
                ? getSlotConflict(pf.assignedSlotId, pf.id)
                : null;

              return (
                <div
                  key={pf.id}
                  className={`flex items-center gap-3 p-3 border ${
                    pf.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : pf.status === 'done'
                      ? 'border-green-200 bg-green-50'
                      : pf.status === 'uploading'
                      ? 'border-yellow-200 bg-yellow-50'
                      : conflict
                      ? 'border-red-200 bg-red-50'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {/* Icon */}
                  <span className="text-xl flex-shrink-0">{getFileIcon(pf.file)}</span>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pf.file.name}</p>
                    <p className="text-xs text-[var(--muted)]">{formatFileSize(pf.file.size)}</p>
                    {pf.errorMessage && (
                      <p className="text-xs text-red-600">{pf.errorMessage}</p>
                    )}
                    {conflict && <p className="text-xs text-red-600">{conflict}</p>}
                    {pf.status === 'uploading' && (
                      <p className="text-xs text-yellow-600">{c.uploading}</p>
                    )}
                  </div>

                  {/* Slot assignment dropdown */}
                  <select
                    value={pf.assignedSlotId || ''}
                    onChange={(e) => assignSlot(pf.id, e.target.value || null)}
                    disabled={pf.status === 'uploading' || pf.status === 'done'}
                    className="text-sm border border-[var(--border)] rounded-none px-2 py-1 bg-white flex-shrink-0"
                  >
                    <option value="">{c.assignSlot}</option>
                    {Object.entries(slotsByCategory).map(([category, slots]) => (
                      <optgroup key={category} label={category}>
                        {slots.map((slot) => {
                          const isAssigned = pendingFiles.some(
                            (f) => f.id !== pf.id && f.assignedSlotId === slot.id
                          );
                          return (
                            <option key={slot.id} value={slot.id} disabled={isAssigned}>
                              {slot.label}
                              {slot.person_slot ? ` (Person ${slot.person_slot})` : ''}
                              {isAssigned ? ' ✓' : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    ))}
                  </select>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFile(pf.id)}
                    disabled={pf.status === 'uploading'}
                    className="text-sm text-[var(--muted)] hover:text-red-600 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* Upload All button */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">
              {allSlotsAssigned ? c.allSlotsAssigned : c.selectSlotFirst}
            </p>
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={!allSlotsAssigned || isUploading}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isUploading ? c.uploading : c.uploadAll(pendingFiles.filter((f) => f.status !== 'done').length)}
            </button>
          </div>
        </div>
      )}

      {/* Batch Dedup Dialog */}
      {currentDedup && (
        <DedupApplyDialog
          isOpen={true}
          filename={currentDedup.filename}
          compatibleSlots={currentDedup.compatibleSlots}
          language={language}
          onClose={handleDedupClose}
          onApply={handleDedupApply}
        />
      )}
    </div>
  );
}
