'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PreferredLanguage } from '@/types/compliance';
import { submissionStatusTranslations } from '@/lib/submissionStatusTranslations';
import { getFormTypeInfo } from '@/lib/formTypeLabels';
import { evaluateImageQuality } from '@/components/DocumentScanner/quality';

type DocStatus = 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';

interface SubmissionDocument {
  id: string;
  doc_type: string;
  label: string;
  required: boolean;
  display_order: number;
  person_slot: number;
  revision: number;
  status: DocStatus;
  file_name: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  scan_metadata?: {
    quality_flags?: string[];
    quality_scores?: {
      blur?: number;
      brightness?: number;
      resolution?: number;
    };
  } | null;
}

interface SubmissionData {
  form_type: string;
  tenant_name: string | null;
  building_address: string | null;
  unit_number: string | null;
  language: string | null;
  status: string;
  document_review_summary: any | null;
  submitted_at: string;
}

interface StatusPayload {
  submission: SubmissionData;
  documents: SubmissionDocument[];
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const LANG_OPTIONS: { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'pt', label: 'PT' },
];

const DOC_STATUS_CONFIG: Record<
  DocStatus,
  { label: (t: any) => string; badgeClass: string; dotClass: string }
> = {
  approved: {
    label: (t) => t.status_approved,
    badgeClass: 'bg-green-100 text-green-800',
    dotClass: 'bg-green-500',
  },
  submitted: {
    label: (t) => t.status_submitted,
    badgeClass: 'bg-yellow-100 text-yellow-800',
    dotClass: 'bg-yellow-500',
  },
  rejected: {
    label: (t) => t.status_rejected,
    badgeClass: 'bg-red-100 text-red-800',
    dotClass: 'bg-red-500',
  },
  missing: {
    label: (t) => t.status_missing,
    badgeClass: 'bg-gray-100 text-gray-600',
    dotClass: 'bg-gray-400',
  },
  waived: {
    label: (t) => t.status_waived,
    badgeClass: 'bg-indigo-100 text-indigo-800',
    dotClass: 'bg-indigo-400',
  },
};

const PARENT_STATUS_MAP: Record<string, (t: any) => string> = {
  pending_review: (t) => t.parent_pending_review,
  under_review: (t) => t.parent_under_review,
  approved: (t) => t.parent_approved,
  revision_requested: (t) => t.parent_revision_requested,
  denied: (t) => t.parent_denied,
  completed: (t) => t.parent_completed,
  sent_to_appfolio: (t) => t.parent_completed,
};

function getPersonLabel(personSlot: number, t: any): string {
  if (personSlot === 0) return '';
  return t.person_label(personSlot);
}

function resolveLanguage(raw: string | null | undefined): PreferredLanguage {
  if (raw === 'es' || raw === 'pt') return raw;
  return 'en';
}

function ProgressBar({ counts }: { counts: Record<DocStatus, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const segments: { count: number; colorClass: string }[] = [
    { count: counts.approved, colorClass: 'bg-green-500' },
    { count: counts.submitted, colorClass: 'bg-yellow-400' },
    { count: counts.rejected, colorClass: 'bg-red-500' },
    { count: counts.waived, colorClass: 'bg-indigo-400' },
    { count: counts.missing, colorClass: 'bg-gray-200' },
  ];
  return (
    <div className="flex h-2 overflow-hidden w-full rounded-none">
      {segments.map((s, i) =>
        s.count > 0 ? (
          <div
            key={i}
            className={`${s.colorClass} transition-all duration-300`}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ) : null
      )}
    </div>
  );
}

function resolveTranslations(language: PreferredLanguage) {
  return submissionStatusTranslations[language];
}

function qualityFlagLabel(flag: string, t: ReturnType<typeof resolveTranslations>) {
  if (flag === 'blurry') return t.scan_blurry;
  if (flag === 'dark') return t.scan_dark;
  if (flag === 'low_resolution') return t.scan_low_resolution;
  return flag;
}

async function evaluateUploadQuality(file: File): Promise<Record<string, unknown> | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode image for quality check'));
    });

    const quality = evaluateImageQuality(image, image.width, image.height);

    return {
      capture_method: 'file_upload',
      page_count: 1,
      quality_flags: quality.flags,
      quality_scores: quality.scores,
      format: 'jpeg',
      heic_converted: false,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function SubmissionStatusPortal({ token }: { token: string }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [uploadStates, setUploadStates] = useState<Map<string, UploadState>>(new Map());

  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const t = resolveTranslations(language);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/t/${token}/status`);
      if (res.status === 404 || res.status === 410) {
        setFetchError('invalid');
        return;
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');
      const payload = json.data as StatusPayload;
      setData(payload);
      setLanguage(resolveLanguage(payload.submission.language));
    } catch {
      setFetchError('error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const setDocUploadState = (docId: string, state: UploadState) => {
    setUploadStates((prev) => new Map(prev).set(docId, state));
  };

  const handleFileSelect = async (doc: SubmissionDocument, file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setDocUploadState(doc.id, { status: 'error', message: t.err_type_hint });
      return;
    }
    setDocUploadState(doc.id, { status: 'uploading' });
    try {
      const scanMetadata = await evaluateUploadQuality(file);
      const form = new FormData();
      form.append('file', file);
      if (scanMetadata) {
        form.append('scan_metadata', JSON.stringify(scanMetadata));
      }
      const res = await fetch(`/api/t/${token}/documents/${doc.id}`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || t.err_upload_failed);
      setDocUploadState(doc.id, { status: 'success' });
      await fetchStatus();
    } catch (e: any) {
      setDocUploadState(doc.id, { status: 'error', message: e.message || t.err_upload_failed });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">{t.loading}</p>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <>
        <header className="border-b border-[var(--divider)] bg-white sticky top-0 z-50 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--primary)] flex items-center justify-center">
                <span className="text-white font-serif font-bold text-sm">SM</span>
              </div>
              <div className="hidden sm:block border-l border-[var(--divider)] pl-3">
                <p className="text-sm font-medium text-[var(--primary)]">Stanton Management LLC</p>
              </div>
            </div>
          </div>
        </header>
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--border)] shadow-sm p-8 max-w-sm w-full text-center">
            <p className="text-[var(--ink)] text-sm leading-relaxed">{t.link_invalid}</p>
          </div>
        </div>
      </>
    );
  }

  const { submission, documents } = data;

  const counts: Record<DocStatus, number> = {
    missing: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    waived: 0,
  };
  for (const doc of documents) {
    counts[doc.status] = (counts[doc.status] ?? 0) + 1;
  }

  const requiredDocs = documents.filter((d) => d.required);
  const approvedRequired = requiredDocs.filter(
    (d) => d.status === 'approved' || d.status === 'waived'
  ).length;
  const allDone = requiredDocs.length > 0 && approvedRequired === requiredDocs.length;
  const docsNeedingRetake = documents.filter((doc) => {
    const flags = doc.scan_metadata?.quality_flags ?? [];
    return flags.length > 0 && (doc.status === 'submitted' || doc.status === 'rejected');
  }).length;

  const formTypeInfo = getFormTypeInfo(submission.form_type);

  const parentStatusFn = PARENT_STATUS_MAP[submission.status];
  const parentStatusLabel = parentStatusFn ? parentStatusFn(t) : submission.status;

  const parentStatusBadgeClass =
    submission.status === 'approved' || submission.status === 'completed' || submission.status === 'sent_to_appfolio'
      ? 'bg-green-100 text-green-800'
      : submission.status === 'denied'
      ? 'bg-red-100 text-red-800'
      : submission.status === 'revision_requested'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-yellow-100 text-yellow-800';

  return (
    <>
      <header className="border-b border-[var(--divider)] bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white font-serif font-bold text-sm">SM</span>
            </div>
            <div className="hidden sm:block border-l border-[var(--divider)] pl-3">
              <p className="text-sm font-medium text-[var(--primary)]">Stanton Management LLC</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLanguage(opt.value)}
                className={`px-2 py-1 text-xs font-semibold transition-colors rounded-none ${
                  language === opt.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Submission info card */}
          <div className="bg-white border border-[var(--border)] shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-[var(--muted)] font-medium uppercase tracking-wide mb-0.5">
                  {t.page_subtitle}
                </p>
                <h1 className="text-xl font-bold text-[var(--primary)] font-serif">
                  {formTypeInfo.label}
                </h1>
                {submission.tenant_name && (
                  <p className="text-sm text-[var(--ink)] mt-0.5">{submission.tenant_name}</p>
                )}
                {(submission.building_address || submission.unit_number) && (
                  <p className="text-sm text-[var(--muted)]">
                    {submission.building_address}
                    {submission.unit_number ? ` — Unit ${submission.unit_number}` : ''}
                  </p>
                )}
              </div>
              <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-semibold ${parentStatusBadgeClass}`}>
                {parentStatusLabel}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {t.submitted_on(new Date(submission.submitted_at).toLocaleDateString())}
            </p>
          </div>

          {/* All done banner */}
          {allDone && (
            <div className="bg-green-50 border border-green-200 p-5">
              <p className="font-semibold text-green-900 text-base">{t.all_done_title}</p>
              <p className="text-sm text-green-800 mt-1">{t.all_done_body}</p>
            </div>
          )}

          {docsNeedingRetake > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-900">
                {t.scan_needs_retake_summary(docsNeedingRetake)}
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="bg-white border border-[var(--border)] shadow-sm p-5">
            <p className="text-sm text-[var(--muted)] mb-2">
              {t.progress_label(approvedRequired, requiredDocs.length)}
            </p>
            <ProgressBar counts={counts} />
            <div className="flex flex-wrap gap-4 mt-3 text-xs">
              {counts.approved > 0 && (
                <span>
                  <strong className="text-green-700">{counts.approved}</strong>{' '}
                  <span className="text-[var(--muted)]">{t.count_approved}</span>
                </span>
              )}
              {counts.submitted > 0 && (
                <span>
                  <strong className="text-yellow-700">{counts.submitted}</strong>{' '}
                  <span className="text-[var(--muted)]">{t.count_awaiting}</span>
                </span>
              )}
              {counts.rejected > 0 && (
                <span>
                  <strong className="text-red-700">{counts.rejected}</strong>{' '}
                  <span className="text-[var(--muted)]">{t.count_rejected}</span>
                </span>
              )}
              {counts.missing > 0 && (
                <span>
                  <strong className="text-gray-600">{counts.missing}</strong>{' '}
                  <span className="text-[var(--muted)]">{t.count_missing}</span>
                </span>
              )}
              {counts.waived > 0 && (
                <span>
                  <strong className="text-indigo-700">{counts.waived}</strong>{' '}
                  <span className="text-[var(--muted)]">{t.count_waived}</span>
                </span>
              )}
            </div>
          </div>

          {/* Document list */}
          <div className="bg-white border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--divider)]">
              <h2 className="text-sm font-semibold text-[var(--primary)]">{t.documents_header}</h2>
            </div>

            <div className="divide-y divide-[var(--divider)]">
              {documents.map((doc) => {
                const personLabel = getPersonLabel(doc.person_slot, t);
                const cfg = DOC_STATUS_CONFIG[doc.status] ?? DOC_STATUS_CONFIG.missing;
                const uploadState = uploadStates.get(doc.id) ?? { status: 'idle' };
                const canUpload = doc.status !== 'approved' && doc.status !== 'waived';
                const qualityFlags = doc.scan_metadata?.quality_flags ?? [];
                const showQualityWarning = qualityFlags.length > 0 && (doc.status === 'submitted' || doc.status === 'rejected');

                return (
                  <div
                    key={doc.id}
                    className={`px-5 py-4 ${doc.status === 'rejected' ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-[var(--ink)]">{doc.label}</span>
                          {!doc.required && (
                            <span className="text-xs text-[var(--muted)]">({t.optional_label})</span>
                          )}
                        </div>
                        {personLabel && (
                          <p className="text-xs text-[var(--muted)] mb-1">{personLabel}</p>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass} flex-shrink-0`} />
                          {cfg.label(t)}
                        </span>
                      </div>
                    </div>

                    {/* Rejection reason */}
                    {doc.status === 'rejected' && doc.rejection_reason && (
                      <div className="mt-2 px-3 py-2 bg-red-100 border-l-2 border-red-400">
                        <p className="text-xs font-semibold text-red-800 mb-0.5">
                          {t.rejection_reason_label}
                        </p>
                        <p className="text-sm text-red-900 leading-snug">{doc.rejection_reason}</p>
                      </div>
                    )}

                    {showQualityWarning && (
                      <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200">
                        <p className="text-xs font-semibold text-amber-900 mb-1">{t.scan_quality_label}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {qualityFlags.map((flag) => (
                            <span key={`${doc.id}-${flag}`} className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-900">
                              {qualityFlagLabel(flag, t)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Approved/waived hint */}
                    {doc.status === 'approved' && (
                      <p className="mt-2 text-xs text-green-700">{t.approved_locked}</p>
                    )}
                    {doc.status === 'waived' && (
                      <p className="mt-2 text-xs text-indigo-700">{t.waived_note}</p>
                    )}

                    {/* Upload area */}
                    {canUpload && (
                      <div className="mt-3">
                        {uploadState.status === 'error' && (
                          <p className="text-xs text-red-600 mb-1">{uploadState.message}</p>
                        )}
                        {uploadState.status === 'success' && (
                          <p className="text-xs text-green-700 mb-1">{t.upload_success}</p>
                        )}
                        <p className="text-xs text-[var(--muted)] mb-2">{t.err_type_hint}</p>

                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="sr-only"
                          ref={(el) => {
                            if (el) fileInputRefs.current.set(doc.id, el);
                          }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(doc, file);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => fileInputRefs.current.get(doc.id)?.click()}
                          disabled={uploadState.status === 'uploading'}
                          className={`w-full sm:w-auto px-4 py-2 text-sm font-medium transition-colors rounded-none disabled:opacity-50 ${
                            doc.status === 'rejected' || showQualityWarning || doc.status === 'submitted'
                              ? 'bg-[var(--primary)] text-white hover:opacity-90'
                              : 'border border-[var(--border)] text-[var(--ink)] hover:bg-gray-50'
                          }`}
                        >
                          {uploadState.status === 'uploading'
                            ? t.uploading
                            : showQualityWarning
                            ? t.scan_retake_btn
                            : doc.status === 'rejected' || doc.status === 'submitted'
                            ? t.replace_btn
                            : t.upload_btn}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="text-center py-4">
            <p className="text-xs text-[var(--muted)]">Stanton Management LLC</p>
          </footer>
        </div>
      </main>
    </>
  );
}
