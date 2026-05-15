'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';

interface IntakePage {
  id: string;
  global_index: number;
  page_index: number;
  source_file_name: string;
  image_path: string;
  ocr_confidence: 'high' | 'medium' | 'low' | 'none' | null;
  suggested_doc_type: string | null;
  suggested_person_slot: number | null;
  staged_assignment: StagedAssignment | null;
}

interface StagedAssignment {
  target: 'doc_row' | 'custom' | 'discard';
  doc_row_id?: string;
  group_id?: string;
  custom_label?: string;
}

interface DocRow {
  id: string;
  doc_type: string;
  label: string;
  person_slot: number;
  status: string;
  required: boolean;
  display_order: number;
}

interface BatchRecord {
  id: string;
  status: string;
  source_label: string | null;
  total_pages: number | null;
  committed_at: string | null;
  committed_document_count: number | null;
  created_at: string;
}

interface AppDetail {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  documents: DocRow[];
}

type Phase = 'upload' | 'classify' | 'commit';

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  low: 'bg-gray-100 text-gray-600 border border-gray-300',
  none: 'bg-gray-50 text-gray-400 border border-gray-200',
};

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium ${CONFIDENCE_BADGE[confidence] ?? CONFIDENCE_BADGE.none}`}>
      {confidence === 'none' ? 'unclassified' : confidence}
    </span>
  );
}

function PageThumbnail({
  page,
  isSelected,
  onToggleSelect,
  onZoom,
}: {
  page: IntakePage;
  isSelected: boolean;
  onToggleSelect: (id: string, shift: boolean) => void;
  onZoom: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: page.id,
    data: { page },
  });

  const assignment = page.staged_assignment;
  const isAssigned = !!assignment;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => onToggleSelect(page.id, e.shiftKey)}
      className={`relative border p-2 cursor-grab select-none transition-all ${
        isDragging ? 'opacity-40' : ''
      } ${
        isSelected
          ? 'border-[var(--primary)] bg-blue-50'
          : isAssigned
          ? 'border-green-300 bg-green-50'
          : 'border-[var(--border)] bg-white hover:border-[var(--primary)]'
      }`}
    >
      <div className="text-xs text-[var(--muted)] mb-1 flex justify-between">
        <span>p.{page.global_index}</span>
        <span className="truncate max-w-[80px]" title={page.source_file_name}>
          {page.source_file_name}
        </span>
      </div>

      <div className="w-full aspect-[3/4] bg-gray-100 flex items-center justify-center mb-1 overflow-hidden relative group">
        <img
          src={`/api/admin/intake/page-image/${page.image_path.replace('/', '/')}`}
          alt={`Page ${page.global_index}`}
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="absolute bottom-0 left-0 text-xs text-gray-400 px-1">pg {page.page_index}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onZoom(`/api/admin/intake/page-image/${page.image_path}`);
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-1.5 py-0.5 leading-none"
          title="View full size"
        >
          &#x26F6;
        </button>
      </div>

      <div className="space-y-1">
        <ConfidenceBadge confidence={page.ocr_confidence} />
        {page.suggested_doc_type && (
          <p className="text-xs text-[var(--muted)] truncate" title={page.suggested_doc_type}>
            {page.suggested_doc_type}
          </p>
        )}
        {assignment && (
          <p className="text-xs text-green-700 font-medium truncate">
            {assignment.target === 'discard'
              ? '🗑 Discard'
              : assignment.target === 'custom'
              ? `✦ ${assignment.custom_label ?? 'Custom'}`
              : '✓ Assigned'}
          </p>
        )}
      </div>
    </div>
  );
}

function DropTarget({
  id,
  label,
  children,
  variant,
}: {
  id: string;
  label: string;
  children?: React.ReactNode;
  variant?: 'discard' | 'custom' | 'normal';
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  const bgClass =
    variant === 'discard'
      ? isOver
        ? 'border-red-400 bg-red-50'
        : 'border-red-200 bg-red-50/50'
      : variant === 'custom'
      ? isOver
        ? 'border-purple-400 bg-purple-50'
        : 'border-purple-200 bg-purple-50/50'
      : isOver
      ? 'border-[var(--primary)] bg-blue-50'
      : 'border-[var(--border)] bg-white';

  return (
    <div ref={setNodeRef} className={`border p-3 min-h-[52px] transition-colors ${bgClass}`}>
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}

function CommitModal({
  pages,
  docRows,
  onConfirm,
  onCancel,
  committing,
}: {
  pages: IntakePage[];
  docRows: DocRow[];
  onConfirm: () => void;
  onCancel: () => void;
  committing: boolean;
}) {
  const docRowMap = new Map(docRows.map((d) => [d.id, d]));
  const templateAssigned = pages.filter(
    (p) => p.staged_assignment?.target === 'doc_row'
  );
  const customAssigned = pages.filter((p) => p.staged_assignment?.target === 'custom');
  const discarded = pages.filter((p) => p.staged_assignment?.target === 'discard');

  const uniqueTemplateDocs = new Set(
    templateAssigned.map((p) => p.staged_assignment?.doc_row_id).filter(Boolean)
  );
  const uniqueCustomDocs = new Set(
    customAssigned.map((p) => p.staged_assignment?.custom_label ?? 'custom')
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border border-[var(--border)] max-w-md w-full mx-4 p-6 space-y-4">
        <h2 className="text-lg font-bold font-serif text-[var(--primary)]">Commit Packet</h2>
        <p className="text-sm text-[var(--muted)]">
          This will permanently create document records for all assigned pages.
        </p>
        <div className="space-y-2 text-sm border border-[var(--border)] p-3">
          <div className="flex justify-between">
            <span>Total pages</span>
            <span className="font-semibold">{pages.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Template documents</span>
            <span className="font-semibold">{uniqueTemplateDocs.size}</span>
          </div>
          <div className="flex justify-between">
            <span>Custom documents</span>
            <span className="font-semibold">{uniqueCustomDocs.size}</span>
          </div>
          <div className="flex justify-between">
            <span>Pages discarded</span>
            <span className="font-semibold">{discarded.length}</span>
          </div>
        </div>
        {templateAssigned.length > 0 && (
          <div className="text-xs text-[var(--muted)] max-h-32 overflow-y-auto space-y-0.5">
            {Array.from(uniqueTemplateDocs).map((rowId) => {
              const doc = docRowMap.get(rowId as string);
              if (!doc) return null;
              const count = templateAssigned.filter(
                (p) => p.staged_assignment?.doc_row_id === rowId
              ).length;
              return (
                <div key={rowId as string}>
                  {doc.label} {doc.person_slot > 0 ? `(slot ${doc.person_slot})` : ''} — {count} page{count !== 1 ? 's' : ''}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={committing}
            className="flex-1 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {committing ? 'Committing…' : 'Confirm Commit'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={committing}
            className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--bg-section)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PacketIntakePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchIdParam = searchParams.get('batch');

  const [phase, setPhase] = useState<Phase>(batchIdParam ? 'classify' : 'upload');
  const [app, setApp] = useState<AppDetail | null>(null);
  const [batchId, setBatchId] = useState<string | null>(batchIdParam);
  const [pages, setPages] = useState<IntakePage[]>([]);
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [batchRecord, setBatchRecord] = useState<BatchRecord | null>(null);
  const [priorBatches, setPriorBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const [showCommitModal, setShowCommitModal] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');

  const [customLabelPrompt, setCustomLabelPrompt] = useState<{
    resolve: (label: string | null) => void;
  } | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');

  const [priorBatchesOpen, setPriorBatchesOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Warn before navigating away with unsaved classify work or selected files
  useEffect(() => {
    const isDirty =
      (phase === 'upload' && selectedFiles.length > 0) ||
      phase === 'classify';
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase, selectedFiles.length]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchApp = useCallback(async () => {
    const res = await fetch(`/api/admin/pbv/full-applications/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data as AppDetail;
  }, [id]);

  const fetchBatch = useCallback(async (bid: string) => {
    const res = await fetch(`/api/admin/intake/pbv_full_application/${id}/batches/${bid}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data as { batch: BatchRecord; pages: IntakePage[] };
  }, [id]);

  const fetchPriorBatches = useCallback(async () => {
    const res = await fetch(`/api/admin/intake/pbv_full_application/${id}/batches`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []) as BatchRecord[];
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setError('');

    (async () => {
      try {
        const [appData, priorData] = await Promise.all([fetchApp(), fetchPriorBatches()]);
        setApp(appData);
        setDocRows(appData.documents.filter((d) => d.doc_type !== 'custom'));
        setPriorBatches(priorData);

        if (batchIdParam) {
          const { batch, pages: batchPages } = await fetchBatch(batchIdParam);
          setBatchRecord(batch);
          setPages(batchPages);
          if (batch.status === 'committed') {
            setPhase('upload');
          } else {
            setPhase('classify');
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [batchIdParam, fetchApp, fetchBatch, fetchPriorBatches]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    setUploadError('');

    const fd = new FormData();
    for (const f of selectedFiles) fd.append('files', f);
    if (sourceLabel.trim()) fd.append('source_label', sourceLabel.trim());

    try {
      const res = await fetch(
        `/api/admin/intake/pbv_full_application/${id}/upload`,
        { method: 'POST', body: fd }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const newBatchId = json.data.batch_id as string;
      setBatchId(newBatchId);
      const { batch, pages: batchPages } = await fetchBatch(newBatchId);
      setBatchRecord(batch);
      setPages(batchPages);
      setPhase('classify');
      router.replace(`/admin/pbv/full-applications/${id}/intake?batch=${newBatchId}`);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleSelect = useCallback(
    (pageId: string, shift: boolean) => {
      setSelectedPageIds((prev) => {
        const next = new Set(prev);
        if (shift && prev.size > 0) {
          const ids = pages.map((p) => p.id);
          const lastSelected = ids.findLastIndex((id) => prev.has(id));
          const clicked = ids.indexOf(pageId);
          const [from, to] =
            lastSelected < clicked
              ? [lastSelected, clicked]
              : [clicked, lastSelected];
          for (let i = from; i <= to; i++) {
            next.add(ids[i]);
          }
        } else {
          if (next.has(pageId)) {
            next.delete(pageId);
          } else {
            next.add(pageId);
          }
        }
        return next;
      });
    },
    [pages]
  );

  const persistAssignments = useCallback(
    async (updates: Array<{ page_id: string; assignment: StagedAssignment | null }>) => {
      if (!batchId) return;
      await fetch(
        `/api/admin/intake/pbv_full_application/${id}/batches/${batchId}/assignments`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: updates }),
        }
      );
    },
    [batchId, id]
  );

  const promptCustomLabel = (): Promise<string | null> => {
    return new Promise((resolve) => {
      setCustomLabelInput('');
      setCustomLabelPrompt({ resolve });
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const draggedPageId = active.id as string;

    const pagesToAssign: string[] = selectedPageIds.has(draggedPageId)
      ? Array.from(selectedPageIds)
      : [draggedPageId];

    let assignment: StagedAssignment;

    if (overId === '__discard__') {
      assignment = { target: 'discard' };
    } else if (overId === '__custom__') {
      const label = await promptCustomLabel();
      if (!label) return;
      const groupId = pagesToAssign.length > 1 ? crypto.randomUUID() : undefined;
      assignment = { target: 'custom', custom_label: label, group_id: groupId };
    } else {
      const groupId = pagesToAssign.length > 1 ? crypto.randomUUID() : undefined;
      assignment = { target: 'doc_row', doc_row_id: overId, group_id: groupId };
    }

    const updates = pagesToAssign.map((pid) => ({ page_id: pid, assignment }));

    setPages((prev) =>
      prev.map((p) =>
        pagesToAssign.includes(p.id) ? { ...p, staged_assignment: assignment } : p
      )
    );
    setSelectedPageIds(new Set());
    await persistAssignments(updates);
  };

  const handleClearAssignment = async (pageId: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, staged_assignment: null } : p))
    );
    await persistAssignments([{ page_id: pageId, assignment: null }]);
  };

  const unassignedCount = pages.filter((p) => !p.staged_assignment).length;

  const handleCommit = async () => {
    if (!batchId) return;
    setCommitting(true);
    setCommitError('');
    try {
      const res = await fetch(
        `/api/admin/intake/pbv_full_application/${id}/commit/${batchId}`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setShowCommitModal(false);
      router.push(`/admin/pbv/full-applications/${id}`);
    } catch (e: unknown) {
      setCommitError(e instanceof Error ? e.message : 'Commit failed');
      setCommitting(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-[var(--muted)]">Loading…</div>;
  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!app) return null;

  const activePage = pages.find((p) => p.id === activeDragId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Document page"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-2xl leading-none bg-black/40 px-3 py-1 hover:bg-black/70 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-sm flex items-center gap-2 text-[var(--muted)]">
        <Link href="/admin/pbv/full-applications" className="hover:text-[var(--ink)] underline">
          Full Applications
        </Link>
        <span>/</span>
        <Link href={`/admin/pbv/full-applications/${id}`} className="hover:text-[var(--ink)] underline">
          {app.head_of_household_name}
        </Link>
        <span>/</span>
        <span>Intake Packet</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">Intake Packet</h1>
        <span className="text-sm text-[var(--muted)]">
          {app.building_address} · Unit {app.unit_number}
        </span>
      </div>

      {/* Phase header */}
      <div className="flex items-center gap-0 border border-[var(--border)]">
        {(['upload', 'classify', 'commit'] as Phase[]).map((p, i) => (
          <div
            key={p}
            className={`flex-1 text-center py-2 text-sm font-medium uppercase tracking-wide border-r last:border-r-0 border-[var(--border)] ${
              phase === p
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-section)] text-[var(--muted)]'
            }`}
          >
            {i + 1}. {p}
          </div>
        ))}
      </div>

      {/* Phase A: Upload */}
      {phase === 'upload' && (
        <div className="bg-white border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Upload Files
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Upload one or more files (PDF, JPG, PNG, HEIC). Each PDF page becomes a separate
            classifiable item.
          </p>

          <div>
            <label className="block text-xs font-medium text-[var(--ink)] mb-1">
              Source Label (optional)
            </label>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="e.g. Walk-in 5/14"
              className="w-full max-w-sm px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
            />
          </div>

          <div
            className="border-2 border-dashed border-[var(--border)] p-8 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              setSelectedFiles((prev) => [...prev, ...files]);
            }}
          >
            <p className="text-sm text-[var(--muted)]">
              Drag and drop files here, or <span className="text-[var(--primary)] underline">browse</span>
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">PDF, JPG, PNG, HEIC up to 100 MB each</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
            className="hidden"
            onChange={handleFileSelect}
          />

          {selectedFiles.length > 0 && (
            <div className="space-y-1">
              {selectedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 border border-[var(--border)] text-sm"
                >
                  <span className="truncate text-[var(--ink)]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="text-xs text-[var(--muted)] hover:text-red-600 ml-3"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFiles.length || uploading}
            className="px-6 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Uploading & Processing…' : `Upload ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}
          </button>

          {/* Packet History */}
          {priorBatches.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setPriorBatchesOpen((v) => !v)}
                className="text-sm font-medium text-[var(--ink)] flex items-center gap-1"
              >
                {priorBatchesOpen ? '▼' : '▶'} Packet History ({priorBatches.length})
              </button>
              {priorBatchesOpen && (
                <div className="mt-3 space-y-2">
                  {priorBatches.map((b) => (
                    <div
                      key={b.id}
                      className="border border-[var(--border)] px-4 py-3 text-sm flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-[var(--ink)]">
                          {b.source_label ?? 'Unnamed batch'}
                        </span>
                        <span className="text-xs text-[var(--muted)] ml-2">
                          {new Date(b.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                        <span>{b.total_pages ?? '?'} pages</span>
                        <span>{b.committed_document_count ?? 0} docs committed</span>
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium ${
                            b.status === 'committed'
                              ? 'bg-green-100 text-green-800'
                              : b.status === 'abandoned'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {b.status}
                        </span>
                        {b.status === 'classifying' && (
                          <Link
                            href={`/admin/pbv/full-applications/${id}/intake?batch=${b.id}`}
                            className="text-[var(--primary)] underline"
                          >
                            Resume
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phase B: Classify */}
      {phase === 'classify' && batchId && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--muted)]">
              Batch: <span className="font-mono text-xs">{batchId}</span>
              {batchRecord?.source_label && (
                <span className="ml-2 text-[var(--ink)]">— {batchRecord.source_label}</span>
              )}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)]">
                {unassignedCount} unassigned
              </span>
              {selectedPageIds.size > 0 && (
                <span className="text-sm text-[var(--primary)] font-medium">
                  {selectedPageIds.size} selected
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowCommitModal(true)}
                disabled={unassignedCount > 0}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Commit Packet
              </button>
            </div>
          </div>

          {commitError && (
            <p className="text-sm text-red-600 mb-2">{commitError}</p>
          )}

          <div className="flex gap-4 items-start">
            {/* Left: Page thumbnails */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white border border-[var(--border)] p-3">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
                  Pages ({pages.length})
                </p>
                <p className="text-xs text-[var(--muted)] mb-3">
                  Click to select. Shift+click to multi-select. Drag to assign.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {pages.map((page) => (
                    <PageThumbnail
                      key={page.id}
                      page={page}
                      isSelected={selectedPageIds.has(page.id)}
                      onToggleSelect={handleToggleSelect}
                      onZoom={setLightboxUrl}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Drop targets */}
            <div className="flex-1 space-y-3">
              <div className="bg-white border border-[var(--border)] p-3">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
                  Document Rows — drop pages here
                </p>
                <div className="space-y-2">
                  {docRows
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((doc) => {
                      const assigned = pages.filter(
                        (p) => p.staged_assignment?.doc_row_id === doc.id
                      );
                      return (
                        <DropTarget key={doc.id} id={doc.id} label={doc.label}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 text-xs font-medium ${
                                  doc.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : doc.status === 'submitted'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : doc.status === 'missing'
                                    ? 'bg-gray-100 text-gray-500'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {doc.status}
                              </span>
                              {doc.person_slot > 0 && (
                                <span className="text-xs text-[var(--muted)]">
                                  slot {doc.person_slot}
                                </span>
                              )}
                            </div>
                            {assigned.length > 0 && (
                              <span className="text-xs text-green-700 font-medium">
                                {assigned.length} page{assigned.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {assigned.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {assigned.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleClearAssignment(p.id)}
                                  className="text-xs text-[var(--muted)] hover:text-red-600 underline"
                                  title="Click to unassign"
                                >
                                  p.{p.global_index} ×
                                </button>
                              ))}
                            </div>
                          )}
                        </DropTarget>
                      );
                    })}
                </div>
              </div>

              {/* Custom + Discard targets */}
              <div className="grid grid-cols-2 gap-3">
                <DropTarget id="__custom__" label="Custom — Not on Template" variant="custom">
                  <p className="text-xs text-purple-600">
                    Creates a new document row. You&apos;ll be prompted for a label.
                  </p>
                  {pages.filter((p) => p.staged_assignment?.target === 'custom').length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pages
                        .filter((p) => p.staged_assignment?.target === 'custom')
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleClearAssignment(p.id)}
                            className="text-xs text-purple-600 hover:text-red-600 underline"
                          >
                            p.{p.global_index} ({p.staged_assignment?.custom_label}) ×
                          </button>
                        ))}
                    </div>
                  )}
                </DropTarget>
                <DropTarget id="__discard__" label="Discard" variant="discard">
                  <p className="text-xs text-red-500">
                    Blank pages, separators, duplicates. Removed on commit.
                  </p>
                  {pages.filter((p) => p.staged_assignment?.target === 'discard').length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pages
                        .filter((p) => p.staged_assignment?.target === 'discard')
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleClearAssignment(p.id)}
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            p.{p.global_index} ×
                          </button>
                        ))}
                    </div>
                  )}
                </DropTarget>
              </div>
            </div>
          </div>

          <DragOverlay>
            {activePage && (
              <div className="bg-white border-2 border-[var(--primary)] p-2 text-xs text-[var(--ink)] shadow-lg">
                {selectedPageIds.size > 1 ? `${selectedPageIds.size} pages` : `p.${activePage.global_index}`}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Custom label prompt modal */}
      {customLabelPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-[var(--border)] max-w-sm w-full mx-4 p-6 space-y-4">
            <h3 className="font-semibold text-[var(--ink)]">Name this custom document</h3>
            <input
              type="text"
              value={customLabelInput}
              onChange={(e) => setCustomLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customLabelInput.trim()) {
                  customLabelPrompt.resolve(customLabelInput.trim());
                  setCustomLabelPrompt(null);
                }
                if (e.key === 'Escape') {
                  customLabelPrompt.resolve(null);
                  setCustomLabelPrompt(null);
                }
              }}
              placeholder="e.g. Court Order, Medical Letter"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!customLabelInput.trim()) return;
                  customLabelPrompt.resolve(customLabelInput.trim());
                  setCustomLabelPrompt(null);
                }}
                disabled={!customLabelInput.trim()}
                className="flex-1 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  customLabelPrompt.resolve(null);
                  setCustomLabelPrompt(null);
                }}
                className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commit modal */}
      {showCommitModal && (
        <CommitModal
          pages={pages}
          docRows={docRows}
          onConfirm={handleCommit}
          onCancel={() => { setShowCommitModal(false); setCommitError(''); }}
          committing={committing}
        />
      )}
    </div>
  );
}
