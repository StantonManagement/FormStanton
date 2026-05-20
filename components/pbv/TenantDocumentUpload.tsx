'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import dynamic from 'next/dynamic';
import type { ScannerMetadata } from '@/components/DocumentScanner/DocumentScanner';
import { getDocHelp } from '@/lib/pbv/docTypeHelp';
import DedupApplyDialog from './DedupApplyDialog';
import MultiFileDropZone from './MultiFileDropZone';

const DocumentScanner = dynamic(
  () => import('@/components/DocumentScanner/DocumentScanner'),
  { ssr: false }
);

interface Document {
  id: string;
  doc_type: string;
  label: string;
  required: boolean;
  person_slot: number;
  status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
  rejection_reason: string | null;
  rejection_reason_key?: string | null;
  rejection_reason_display?: string | null;
  current_revision: number;
  uploaded_at: string | null;
  category?: string;
  display_order?: number;
  file_url?: string | null;
}

interface TenantDocumentUploadProps {
  token: string;
  language: 'en' | 'es' | 'pt';
  initialDocuments: Document[];
  packetLocked: boolean;
  onDocumentsChange?: (docs: Document[]) => void;
}

const translations = {
  en: {
    title: 'Required Documents',
    subtitle: 'Upload one file per document. Accepted: JPEG, PNG, PDF, HEIC. Max 25MB.',
    required: 'Required',
    optional: 'Optional',
    status_missing: 'Missing',
    status_submitted: 'Submitted',
    status_approved: 'Approved',
    status_rejected: 'Needs Replacement',
    scan_btn: 'Scan',
    upload_btn: 'Upload file',
    replace_btn: 'Replace',
    view_btn: 'View',
    uploading: 'Uploading...',
    error_file_size: 'File too large (max 25MB)',
    error_file_type: 'Invalid file type',
    error_upload: 'Upload failed. Please try again.',
    locked_message: 'This packet is under review. Contact the office for updates.',
    progress: '{uploaded} of {total} uploaded',
    category_income: 'Income Verification',
    category_assets: 'Banking & Assets',
    category_medical_childcare: 'Medical & Childcare',
    category_immigration: 'Citizenship & Immigration',
    category_signed_forms: 'Signed Forms',
    category_custom: 'Additional Documents',
    help_icon: '?',
    help_label: 'What is this?',
  },
  es: {
    title: 'Documentos Requeridos',
    subtitle: 'Suba un archivo por documento. Aceptados: JPEG, PNG, PDF, HEIC. Máx 25MB.',
    required: 'Requerido',
    optional: 'Opcional',
    status_missing: 'Pendiente',
    status_submitted: 'Enviado',
    status_approved: 'Aprobado',
    status_rejected: 'Necesita Reemplazo',
    scan_btn: 'Escanear',
    upload_btn: 'Subir archivo',
    replace_btn: 'Reemplazar',
    view_btn: 'Ver',
    uploading: 'Subiendo...',
    error_file_size: 'Archivo demasiado grande (máx 25MB)',
    error_file_type: 'Tipo de archivo inválido',
    error_upload: 'Error al subir. Intente de nuevo.',
    locked_message: 'Este paquete está en revisión. Contacte la oficina para actualizaciones.',
    progress: '{uploaded} de {total} subidos',
    category_income: 'Verificación de Ingresos',
    category_assets: 'Cuentas y Bienes',
    category_medical_childcare: 'Médico y Cuidado Infantil',
    category_immigration: 'Ciudadanía e Inmigración',
    category_signed_forms: 'Formularios Firmados',
    category_custom: 'Documentos Adicionales',
    help_icon: '?',
    help_label: '¿Qué es esto?',
  },
  pt: {
    title: 'Documentos Necessários',
    subtitle: 'Envie um arquivo por documento. Aceitos: JPEG, PNG, PDF, HEIC. Máx 25MB.',
    required: 'Obrigatório',
    optional: 'Opcional',
    status_missing: 'Pendente',
    status_submitted: 'Enviado',
    status_approved: 'Aprovado',
    status_rejected: 'Precisa Substituir',
    scan_btn: 'Digitalizar',
    upload_btn: 'Enviar arquivo',
    replace_btn: 'Substituir',
    view_btn: 'Ver',
    uploading: 'Enviando...',
    error_file_size: 'Arquivo muito grande (máx 25MB)',
    error_file_type: 'Tipo de arquivo inválido',
    error_upload: 'Falha no envio. Tente novamente.',
    locked_message: 'Este pacote está em revisão. Entre em contato com o escritório para atualizações.',
    progress: '{uploaded} de {total} enviados',
    category_income: 'Verificação de Renda',
    category_assets: 'Contas e Bens',
    category_medical_childcare: 'Médico e Creche',
    category_immigration: 'Cidadania e Imigração',
    category_signed_forms: 'Formulários Assinados',
    category_custom: 'Documentos Adicionais',
    help_icon: '?',
    help_label: 'O que é isso?',
  },
};

const statusClasses: Record<string, string> = {
  missing: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  waived: 'bg-blue-50 text-blue-700 border-blue-200',
};

const statusDotClasses: Record<string, string> = {
  missing: 'bg-gray-400',
  submitted: 'bg-yellow-400',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  waived: 'bg-blue-400',
};

export default function TenantDocumentUpload({
  token,
  language,
  initialDocuments,
  packetLocked,
  onDocumentsChange,
}: TenantDocumentUploadProps) {
  const t = translations[language];
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(packetLocked);
  const [scanningDocId, setScanningDocId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [expandedHelp, setExpandedHelp] = useState<Set<string>>(new Set());
  
  // F1: Dedup dialog state
  const [dedupDialogOpen, setDedupDialogOpen] = useState(false);
  const [dedupFilename, setDedupFilename] = useState('');
  const [dedupSourceDocId, setDedupSourceDocId] = useState('');
  const [dedupSlots, setDedupSlots] = useState<Array<{ id: string; doc_type: string; label: string; category: string | null; person_slot: number | null }>>([]);

  // Fixed category order per PRD-14 Phase 4
  const CATEGORY_ORDER = ['income', 'assets', 'medical_childcare', 'immigration', 'signed_forms', 'custom'];

  // Group documents by category
  const groupedDocs = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    const category = doc.category || 'custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {});

  // Sort documents within each category by (display_order, person_slot)
  Object.keys(groupedDocs).forEach((key) => {
    groupedDocs[key].sort((a, b) => {
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.person_slot ?? 0) - (b.person_slot ?? 0);
    });
  });

  // Get sorted category entries based on fixed order
  const sortedCategories = CATEGORY_ORDER.filter((cat) => groupedDocs[cat]?.length > 0)
    .map((cat) => [cat, groupedDocs[cat]] as const);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleHelp = (docId: string) => {
    setExpandedHelp((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const loadDocuments = useCallback(() => {
    setLoading(true);
    setError(null);
    tenantFetch(`/api/t/${token}/pbv-full-app/documents?language=${language}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.documents) {
          setDocuments(result.data.documents);
        }
        if (result.success && result.data?.packet_locked) {
          setIsLocked(true);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch documents:', err);
        setError(language === 'en' ? 'Failed to load documents. Please try again.' : language === 'es' ? 'Error al cargar documentos. Intente de nuevo.' : 'Erro ao carregar documentos. Tente novamente.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, language]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const requiredDocs = documents.filter((d) => d.required);
  const uploadedCount = requiredDocs.filter((d) => d.status !== 'missing').length;
  const totalCount = requiredDocs.length;
  const requiredCount = requiredDocs.filter((d) => d.status === 'missing').length;
  const optionalUploadedCount = documents.filter((d) => !d.required && d.status !== 'missing').length;

  // F1: Check for dedup after successful upload
  const checkForDedup = useCallback(
    async (docId: string, filename: string, wasReplace: boolean) => {
      // Don't trigger dedup on file replacement - only on first upload
      if (wasReplace) return;

      try {
        // Call by-hash endpoint
        const response = await tenantFetch(
          `/api/t/${token}/pbv-full-app/documents/by-hash?hash=${encodeURIComponent('pending')}&exclude_doc_id=${docId}`,
          { method: 'GET' }
        );

        if (!response.ok) return;

        const result = await response.json();
        if (!result.success) return;

        const compatibleSlots = result.data?.compatible_missing_slots ?? [];
        
        // Only show dialog if there are compatible slots
        if (compatibleSlots.length > 0) {
          setDedupSourceDocId(docId);
          setDedupFilename(filename);
          setDedupSlots(compatibleSlots);
          setDedupDialogOpen(true);
        }
      } catch (err) {
        // Silently fail - dedup is a UX enhancement, not critical
        console.error('[Dedup check] Failed:', err);
      }
    },
    [token]
  );

  // F1: Apply dedup selections
  const handleDedupApply = useCallback(
    async (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        setDedupDialogOpen(false);
        return;
      }

      try {
        const response = await tenantFetch(
          `/api/t/${token}/pbv-full-app/documents/bulk-apply`,
          {
            method: 'POST',
            body: {
              source_doc_id: dedupSourceDocId,
              target_doc_ids: selectedIds,
            },
          }
        );

        const result = await response.json();
        
        if (result.success) {
          // Refresh documents to show applied changes
          loadDocuments();
        } else {
          console.error('[Bulk apply] Failed:', result.message);
        }
      } catch (err) {
        console.error('[Bulk apply] Error:', err);
      } finally {
        setDedupDialogOpen(false);
      }
    },
    [dedupSourceDocId, token, loadDocuments]
  );

  const handleFileChange = useCallback(
    async (docId: string, file: File) => {
      if (!file) return;

      // Clear previous errors
      setError(null);

      // Validate file size (25MB)
      if (file.size > 25 * 1024 * 1024) {
        setError(t.error_file_size);
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
        setError(t.error_file_type);
        return;
      }

      setUploadingId(docId);

      // Check if this is a replacement (doc already has file)
      const doc = documents.find((d) => d.id === docId);
      const isReplace = doc?.status === 'submitted' || doc?.status === 'rejected';

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await tenantFetch(`/api/t/${token}/pbv-full-app/documents/${docId}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || t.error_upload);
        }

        // Update local state
        const updatedDocs = documents.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: 'submitted' as const,
                current_revision: result.data.revision,
                uploaded_at: new Date().toISOString(),
              }
            : d
        );
        setDocuments(updatedDocs);
        onDocumentsChange?.(updatedDocs);

        // F1: Check for dedup (only on first upload, not replacement)
        // Note: We pass 'false' for wasReplace since this was a successful new upload
        await checkForDedup(docId, file.name, false);
      } catch (err: any) {
        setError(err.message || t.error_upload);
      } finally {
        setUploadingId(null);
      }
    },
    [documents, token, onDocumentsChange, t, checkForDedup]
  );

  const handleScannerComplete = useCallback(
    async (docId: string, file: File, _metadata: ScannerMetadata) => {
      setScanningDocId(null);
      await handleFileChange(docId, file);
    },
    [handleFileChange]
  );

  const handleFileInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, docId: string) => {
      const file = event.target.files?.[0];
      if (file) {
        await handleFileChange(docId, file);
      }
      // Reset input so the same file can be selected again
      event.target.value = '';
    },
    [handleFileChange]
  );

  if (loading) {
    return (
      <div className="bg-white border border-[var(--border)] p-6 text-center">
        <p className="text-[var(--muted)] text-base">Loading documents...</p>
      </div>
    );
  }

  if (!loading && documents.length === 0 && error) {
    return (
      <div className="bg-white border border-[var(--border)] p-6 text-center space-y-3">
        <p className="text-sm text-[var(--error)]">{error}</p>
        <button
          type="button"
          onClick={loadDocuments}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {language === 'en' ? 'Try again' : language === 'es' ? 'Intentar de nuevo' : 'Tentar novamente'}
        </button>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="bg-white border border-[var(--border)] p-6 text-center">
        <p className="text-[var(--muted)] text-base min-h-[44px] flex items-center justify-center">
          {t.locked_message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[var(--border)] p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold" style={{ fontFamily: 'Libre Baskerville, serif' }}>
            {t.title}
          </h3>
          <span className="text-sm text-[var(--muted)]">
            {t.progress.replace('{uploaded}', String(uploadedCount)).replace('{total}', String(totalCount))}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)]">{t.subtitle}</p>
        {requiredCount > 0 && (
          <p className="text-sm text-[var(--error)] mt-2">
            {requiredCount} {t.required.toLowerCase()} {requiredCount === 1 ? 'document' : 'documents'} {language === 'en' ? 'remaining' : language === 'es' ? 'pendiente' : 'pendente'}
          </p>
        )}
        {optionalUploadedCount > 0 && (
          <p className="text-xs text-[var(--muted)] mt-1">
            +{optionalUploadedCount} {language === 'en' ? 'optional uploaded' : language === 'es' ? 'opcional subido' : 'opcional enviado'}
          </p>
        )}
      </div>

      {/* F2: Multi-file drop zone */}
      {!isLocked && (
        <MultiFileDropZone
          token={token}
          language={language}
          missingSlots={documents
            .filter((d) => d.status === 'missing')
            .map((d) => ({
              id: d.id,
              doc_type: d.doc_type,
              label: d.label,
              category: d.category || null,
              person_slot: d.person_slot,
            }))}
          onUploadsComplete={loadDocuments}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Document list - grouped by category */}
      <div className="space-y-4">
        {sortedCategories.map(([category, categoryDocs]) => {
          const isCollapsed = collapsedCategories.has(category);
          const categoryLabel = t[`category_${category}` as keyof typeof t] || category;

          return (
            <div key={category} className="bg-white border border-[var(--border)]">
              {/* Category header - clickable to toggle */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full px-5 py-3 border-b border-[var(--border)] bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">{categoryLabel}</span>
                  <span className="text-xs text-[var(--muted)]">
                    ({categoryDocs.filter(d => d.status !== 'missing').length}/{categoryDocs.length})
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-[var(--muted)] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Document list for this category */}
              {!isCollapsed && (
                <div className="divide-y divide-[var(--border)]">
                  {categoryDocs.map((doc) => {
                    const isUploading = uploadingId === doc.id;
                    const canUpload = doc.status === 'missing' || doc.status === 'submitted' || doc.status === 'rejected';
                    const isReplace = doc.status === 'submitted' || doc.status === 'rejected';

                    return (
                      <div
                        key={doc.id}
                        className={`p-4 ${statusClasses[doc.status]}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${statusDotClasses[doc.status]}`} />
                              <span className="font-medium text-base">{doc.label}</span>
                              {doc.required ? (
                                <span className="text-xs text-[var(--error)]">({t.required})</span>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">({t.optional})</span>
                              )}
                              {/* Help icon */}
                              <button
                                type="button"
                                onClick={() => toggleHelp(doc.id)}
                                className="ml-1 w-5 h-5 rounded-full border border-[var(--muted)] text-[var(--muted)] text-xs flex items-center justify-center hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                                title={t.help_label as string}
                                aria-label={t.help_label as string}
                                aria-expanded={expandedHelp.has(doc.id)}
                              >
                                {t.help_icon}
                              </button>
                            </div>

                            {/* Help text - expandable */}
                            {expandedHelp.has(doc.id) && (
                              <p className="text-xs text-[var(--muted)] ml-4 mb-2 max-w-md">
                                {getDocHelp(doc.doc_type, language)}
                              </p>
                            )}

                            {doc.person_slot > 0 && (
                              <p className="text-xs text-[var(--muted)] ml-4">
                                Person {doc.person_slot}
                              </p>
                            )}

                            {/* Status badge */}
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 border ${statusClasses[doc.status]}`}>
                                {t[`status_${doc.status}` as keyof typeof t] || doc.status}
                              </span>
                              {doc.current_revision > 0 && (
                                <span className="text-xs text-[var(--muted)]">
                                  Rev {doc.current_revision}
                                </span>
                              )}
                            </div>

                            {/* Rejection reason - always show for rejected docs */}
                            {doc.status === 'rejected' && (
                              <p className="text-xs text-red-600 mt-2 ml-4">
                                {doc.rejection_reason_display || doc.rejection_reason || (language === 'en'
                                  ? 'Please contact the office for details on why this document was rejected.'
                                  : language === 'es'
                                  ? 'Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.'
                                  : 'Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.')}
                              </p>
                            )}
                          </div>

                          {/* View + Scan + Upload buttons */}
                          <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                            {doc.file_url && (
                              <a
                                href={doc.file_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center min-w-[100px] min-h-[44px] px-4 py-2 text-sm font-semibold border border-[var(--primary)] text-[var(--primary)] hover:opacity-75 transition-opacity"
                              >
                                {t.view_btn}
                              </a>
                            )}
                            {canUpload && (
                              <>
                                {/* Scan button - opens camera scanner */}
                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() => setScanningDocId(doc.id)}
                                  className={`
                                    inline-flex items-center justify-center
                                    min-w-[100px] min-h-[44px] px-4 py-2
                                    text-sm font-semibold
                                    transition-opacity hover:opacity-90
                                    ${isUploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[var(--primary)] text-white cursor-pointer'}
                                  `}
                                  style={{ touchAction: 'manipulation' }}
                                >
                                  {isUploading ? (
                                    <span>{t.uploading}</span>
                                  ) : isReplace ? (
                                    <span>{t.replace_btn}</span>
                                  ) : (
                                    <span>{t.scan_btn}</span>
                                  )}
                                </button>
                                {/* Upload file button - desktop PDF path */}
                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() => {
                                    const input = document.getElementById(`file-input-${doc.id}`) as HTMLInputElement | null;
                                    input?.click();
                                  }}
                                  className={`
                                    inline-flex items-center justify-center
                                    min-w-[100px] min-h-[44px] px-4 py-2
                                    text-sm font-semibold border border-[var(--primary)]
                                    transition-opacity hover:opacity-90
                                    ${isUploading ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white text-[var(--primary)] cursor-pointer'}
                                  `}
                                  style={{ touchAction: 'manipulation' }}
                                >
                                  {isUploading ? t.uploading : t.upload_btn}
                                </button>
                                {/* Hidden file input for desktop upload - one per doc row */}
                                <input
                                  id={`file-input-${doc.id}`}
                                  type="file"
                                  accept="application/pdf,image/*,.heic,.heif"
                                  className="hidden"
                                  onChange={(e) => handleFileInputChange(e, doc.id)}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="bg-white border border-[var(--border)] p-6 text-center">
          <p className="text-[var(--muted)]">No documents required.</p>
        </div>
      )}

      {/* Document Scanner overlay */}
      {scanningDocId && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="max-w-lg mx-auto p-4">
            <DocumentScanner
              instructions={documents.find((d) => d.id === scanningDocId)?.label ?? ''}
              multiPage={false}
              language={language}
              onComplete={async (file, metadata) => {
                await handleScannerComplete(scanningDocId, file, metadata);
              }}
              onCancel={() => setScanningDocId(null)}
            />
          </div>
        </div>
      )}

      {/* F1: Dedup Apply Dialog */}
      <DedupApplyDialog
        isOpen={dedupDialogOpen}
        filename={dedupFilename}
        compatibleSlots={dedupSlots}
        language={language}
        onClose={() => setDedupDialogOpen(false)}
        onApply={handleDedupApply}
      />
    </div>
  );
}
