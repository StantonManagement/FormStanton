'use client';

import { useState, useEffect, useCallback } from 'react';

interface Document {
  id: string;
  doc_type: string;
  label: string;
  required: boolean;
  person_slot: number;
  status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
  rejection_reason: string | null;
  current_revision: number;
  uploaded_at: string | null;
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
    upload_btn: 'Upload',
    replace_btn: 'Replace',
    uploading: 'Uploading...',
    error_file_size: 'File too large (max 25MB)',
    error_file_type: 'Invalid file type',
    error_upload: 'Upload failed. Please try again.',
    locked_message: 'This packet is under review. Contact the office for updates.',
    progress: '{uploaded} of {total} uploaded',
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
    upload_btn: 'Subir',
    replace_btn: 'Reemplazar',
    uploading: 'Subiendo...',
    error_file_size: 'Archivo demasiado grande (máx 25MB)',
    error_file_type: 'Tipo de archivo inválido',
    error_upload: 'Error al subir. Intente de nuevo.',
    locked_message: 'Este paquete está en revisión. Contacte la oficina para actualizaciones.',
    progress: '{uploaded} de {total} subidos',
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
    upload_btn: 'Enviar',
    replace_btn: 'Substituir',
    uploading: 'Enviando...',
    error_file_size: 'Arquivo muito grande (máx 25MB)',
    error_file_type: 'Tipo de arquivo inválido',
    error_upload: 'Falha no envio. Tente novamente.',
    locked_message: 'Este pacote está em revisão. Entre em contato com o escritório para atualizações.',
    progress: '{uploaded} de {total} enviados',
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

  // Fetch documents on mount
  useEffect(() => {
    fetch(`/api/pbv-full-app/${token}/documents?language=${language}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.documents) {
          setDocuments(result.data.documents);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch documents:', err);
        setError('Failed to load documents');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, language]);

  const uploadedCount = documents.filter((d) => d.status !== 'missing').length;
  const totalCount = documents.length;
  const requiredCount = documents.filter((d) => d.required && d.status === 'missing').length;

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

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/pbv-full-app/${token}/documents/${docId}/upload`, {
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
      } catch (err: any) {
        setError(err.message || t.error_upload);
      } finally {
        setUploadingId(null);
      }
    },
    [documents, token, onDocumentsChange, t]
  );

  if (loading) {
    return (
      <div className="bg-white border border-[var(--border)] p-6 text-center">
        <p className="text-[var(--muted)] text-base">Loading documents...</p>
      </div>
    );
  }

  if (packetLocked) {
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
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const isUploading = uploadingId === doc.id;
          const canUpload = doc.status === 'missing' || doc.status === 'submitted' || doc.status === 'rejected';
          const isReplace = doc.status === 'submitted' || doc.status === 'rejected';

          return (
            <div
              key={doc.id}
              className={`bg-white border p-4 ${statusClasses[doc.status]}`}
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
                  </div>

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

                  {/* Rejection reason */}
                  {doc.status === 'rejected' && doc.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2 ml-4">
                      {doc.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Upload button */}
                {canUpload && (
                  <div className="flex-shrink-0">
                    <label
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
                        <span>{t.upload_btn}</span>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf,image/heic,image/heif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(doc.id, file);
                          e.target.value = ''; // Reset input
                        }}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                )}
              </div>
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
    </div>
  );
}
