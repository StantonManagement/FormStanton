'use client';

import React, { useState, useCallback, useEffect } from 'react';

type DocStatus = 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';

interface DocumentRevision {
  id: string;
  document_id: string;
  revision: number;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  status_at_review: string | null;
  rejection_reason: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  download_url: string | null;
}

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
  download_url: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  revisions: DocumentRevision[];
}

interface DocumentsPayload {
  submission_id: string;
  tenant_name: string | null;
  form_data: any;
  documents: SubmissionDocument[];
}

interface Props {
  submissionId: string;
  tenantAccessToken: string | null;
}

const DOC_STATUS_CONFIG: Record<DocStatus, { label: string; rowClass: string; badgeClass: string; dotClass: string }> = {
  approved: {
    label: 'Approved',
    rowClass: '',
    badgeClass: 'bg-green-100 text-green-800',
    dotClass: 'bg-green-500',
  },
  submitted: {
    label: 'Awaiting Review',
    rowClass: '',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    dotClass: 'bg-yellow-500',
  },
  rejected: {
    label: 'Rejected',
    rowClass: 'bg-red-50',
    badgeClass: 'bg-red-100 text-red-800',
    dotClass: 'bg-red-500',
  },
  missing: {
    label: 'Missing',
    rowClass: '',
    badgeClass: 'bg-gray-100 text-gray-600',
    dotClass: 'bg-gray-400',
  },
  waived: {
    label: 'Waived',
    rowClass: '',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    dotClass: 'bg-indigo-400',
  },
};

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? DOC_STATUS_CONFIG.missing;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
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
    <div className="flex h-2 overflow-hidden w-full">
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

function getPersonLabel(personSlot: number, formData: any): string {
  if (personSlot === 0) return '';
  const members = formData?.household_members;
  if (!Array.isArray(members) || members.length < personSlot) {
    return `Person ${personSlot}`;
  }
  const member = members[personSlot - 1];
  if (!member) return `Person ${personSlot}`;
  if (typeof member === 'string') return member;
  const name =
    member.name ||
    member.full_name ||
    [member.first_name, member.last_name].filter(Boolean).join(' ') ||
    [member.firstName, member.lastName].filter(Boolean).join(' ');
  return name?.trim() || `Person ${personSlot}`;
}

type FilterKey = 'all' | 'needs_review' | 'rejected' | 'missing';

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Documents' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'missing', label: 'Missing' },
];

export default function PerDocumentReviewPanel({ submissionId, tenantAccessToken }: Props) {
  const [data, setData] = useState<DocumentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterKey>('all');

  const [actionDocId, setActionDocId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'waive' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [currentToken, setCurrentToken] = useState<string | null>(tenantAccessToken);
  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const [origin, setOrigin] = useState('');

  const [expandedRevisions, setExpandedRevisions] = useState<Set<string>>(new Set());

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch(`/api/admin/submissions/${submissionId}/documents`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load documents');
      setData(json.data);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const closeActionPanel = () => {
    setActionDocId(null);
    setPendingAction(null);
    setRejectionReason('');
    setActionNotes('');
    setActionError(null);
  };

  const openAction = (docId: string, action: 'approve' | 'reject' | 'waive') => {
    if (actionDocId === docId && pendingAction === action) {
      closeActionPanel();
    } else {
      setActionDocId(docId);
      setPendingAction(action);
      setRejectionReason('');
      setActionNotes('');
      setActionError(null);
    }
  };

  const handleAction = async (documentId: string, action: 'approve' | 'reject' | 'waive') => {
    if (action === 'reject' && !rejectionReason.trim()) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/submissions/${submissionId}/documents/${documentId}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            rejection_reason: action === 'reject' ? rejectionReason.trim() : undefined,
            notes: actionNotes.trim() || undefined,
          }),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Review action failed');
      closeActionPanel();
      await fetchDocuments();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/export`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'submission_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerateToken = async () => {
    setIsRegeneratingToken(true);
    try {
      const res = await fetch(`/api/admin/form-submissions/${submissionId}/regenerate-token`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to regenerate token');
      setCurrentToken(json.data.tenant_access_token);
    } catch (e: any) {
      alert(`Token regeneration failed: ${e.message}`);
    } finally {
      setIsRegeneratingToken(false);
    }
  };

  const toggleRevisions = (docId: string) => {
    setExpandedRevisions((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-white shadow-md p-6 rounded-none">
        <div className="text-gray-500 text-sm">Loading documents...</div>
      </div>
    );
  }

  if (fetchError || !data) {
    return (
      <div className="bg-white shadow-md p-6 rounded-none">
        <p className="text-red-600 text-sm">{fetchError || 'Failed to load documents'}</p>
        <button
          onClick={fetchDocuments}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const { documents, form_data } = data;

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

  const totalRequired = documents.filter((d) => d.required).length;
  const approvedRequired = documents.filter(
    (d) => d.required && (d.status === 'approved' || d.status === 'waived')
  ).length;

  const filteredDocs = documents.filter((doc) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'needs_review') return doc.status === 'submitted';
    if (filterStatus === 'rejected') return doc.status === 'rejected';
    if (filterStatus === 'missing') return doc.status === 'missing';
    return true;
  });

  const displayTokenUrl =
    origin && currentToken ? `${origin}/t/${currentToken}` : null;

  return (
    <div className="space-y-4">
      {/* Summary + actions */}
      <div className="bg-white shadow-md p-5 rounded-none">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Per-Document Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {approvedRequired}/{totalRequired} required documents approved or waived
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 rounded-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {isExporting ? 'Exporting...' : 'Export ZIP'}
          </button>
        </div>

        <ProgressBar counts={counts} />

        <div className="flex flex-wrap gap-5 mt-3 text-sm">
          <span>
            <strong className="text-green-700">{counts.approved}</strong>{' '}
            <span className="text-gray-500">Approved</span>
          </span>
          <span>
            <strong className="text-yellow-700">{counts.submitted}</strong>{' '}
            <span className="text-gray-500">Awaiting</span>
          </span>
          <span>
            <strong className="text-red-700">{counts.rejected}</strong>{' '}
            <span className="text-gray-500">Rejected</span>
          </span>
          <span>
            <strong className="text-gray-600">{counts.missing}</strong>{' '}
            <span className="text-gray-500">Missing</span>
          </span>
          <span>
            <strong className="text-indigo-700">{counts.waived}</strong>{' '}
            <span className="text-gray-500">Waived</span>
          </span>
        </div>
      </div>

      {/* Tenant access link */}
      <div className="bg-white shadow-md p-5 rounded-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tenant Access Link</h3>
            {displayTokenUrl ? (
              <p className="text-xs font-mono text-gray-500 break-all">{displayTokenUrl}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">No token — regenerate to create one</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {displayTokenUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(displayTokenUrl)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors rounded-none"
              >
                Copy
              </button>
            )}
            <button
              onClick={handleRegenerateToken}
              disabled={isRegeneratingToken}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 rounded-none"
            >
              {isRegeneratingToken ? 'Regenerating...' : currentToken ? 'Regenerate' : 'Generate Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Document table */}
      <div className="bg-white shadow-md rounded-none overflow-hidden">
        {/* Filter pills */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
          {FILTER_OPTIONS.map((f) => {
            const badge =
              f.key === 'needs_review'
                ? counts.submitted
                : f.key === 'rejected'
                ? counts.rejected
                : f.key === 'missing'
                ? counts.missing
                : 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1 text-xs font-semibold transition-colors rounded-none ${
                  filterStatus === f.key
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
                {badge > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full ${
                      f.key === 'rejected' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-gray-400">
            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No documents match this filter
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Document
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    File
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Reviewer
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rev
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const personLabel = getPersonLabel(doc.person_slot, form_data);
                  const isActionOpen = actionDocId === doc.id;
                  const hasRevisions = doc.revisions && doc.revisions.length > 0;
                  const isRevisionsExpanded = expandedRevisions.has(doc.id);
                  const rowCfg = DOC_STATUS_CONFIG[doc.status] ?? DOC_STATUS_CONFIG.missing;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr className={`border-b border-gray-100 ${rowCfg.rowClass}`}>
                        {/* Document label */}
                        <td className="px-4 py-3 min-w-[180px]">
                          <div className="font-medium text-gray-900">{doc.label}</div>
                          {personLabel && (
                            <div className="text-xs text-gray-500 mt-0.5">{personLabel}</div>
                          )}
                          {!doc.required && (
                            <div className="text-xs text-gray-400 mt-0.5">Optional</div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={doc.status} />
                          {doc.rejection_reason && (
                            <p className="text-xs text-red-700 mt-1 max-w-xs leading-snug">
                              {doc.rejection_reason}
                            </p>
                          )}
                        </td>

                        {/* File */}
                        <td className="px-4 py-3 min-w-[160px]">
                          {doc.file_name && doc.download_url ? (
                            <a
                              href={doc.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline block max-w-xs"
                              title={doc.file_name}
                            >
                              {doc.file_name.length > 42
                                ? doc.file_name.slice(0, 42) + '…'
                                : doc.file_name}
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                          {hasRevisions && (
                            <button
                              onClick={() => toggleRevisions(doc.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 mt-1 block"
                            >
                              {isRevisionsExpanded ? '▾ Hide history' : '▸ History'}
                            </button>
                          )}
                        </td>

                        {/* Reviewer */}
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {doc.reviewer || '—'}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {doc.reviewed_at
                            ? new Date(doc.reviewed_at).toLocaleDateString()
                            : '—'}
                        </td>

                        {/* Revision */}
                        <td className="px-4 py-3 text-center text-gray-600 text-xs">
                          {doc.revision > 0 ? `v${doc.revision}` : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {doc.revision > 0 && (
                              <>
                                <button
                                  onClick={() => openAction(doc.id, 'approve')}
                                  className={`px-2 py-1 text-xs font-medium transition-colors rounded-none ${
                                    isActionOpen && pendingAction === 'approve'
                                      ? 'bg-green-600 text-white'
                                      : 'border border-gray-300 text-gray-600 hover:border-green-600 hover:text-green-700'
                                  }`}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openAction(doc.id, 'reject')}
                                  className={`px-2 py-1 text-xs font-medium transition-colors rounded-none ${
                                    isActionOpen && pendingAction === 'reject'
                                      ? 'bg-red-600 text-white'
                                      : 'border border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-700'
                                  }`}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openAction(doc.id, 'waive')}
                              className={`px-2 py-1 text-xs font-medium transition-colors rounded-none ${
                                isActionOpen && pendingAction === 'waive'
                                  ? 'bg-indigo-600 text-white'
                                  : 'border border-gray-300 text-gray-600 hover:border-indigo-600 hover:text-indigo-700'
                              }`}
                            >
                              Waive
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline action panel */}
                      {isActionOpen && pendingAction && (
                        <tr className="border-b border-gray-200">
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
                            <div className="max-w-xl space-y-3">
                              {pendingAction === 'approve' && (
                                <>
                                  <p className="text-sm text-gray-700">
                                    Approve{' '}
                                    <strong>{doc.label}</strong>
                                    {personLabel ? ` (${personLabel})` : ''}?
                                  </p>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Internal notes (optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={actionNotes}
                                      onChange={(e) => setActionNotes(e.target.value)}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-green-500 focus:border-green-500 rounded-none"
                                      placeholder="e.g. Original scan verified on file"
                                    />
                                  </div>
                                </>
                              )}

                              {pendingAction === 'reject' && (
                                <>
                                  <p className="text-sm text-gray-700">
                                    Reject{' '}
                                    <strong>{doc.label}</strong>
                                    {personLabel ? ` (${personLabel})` : ''}
                                  </p>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Rejection reason{' '}
                                      <span className="text-red-500">*</span>
                                      <span className="text-gray-400 font-normal ml-1">
                                        (shown to tenant)
                                      </span>
                                    </label>
                                    <textarea
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      rows={2}
                                      autoFocus
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-red-500 focus:border-red-500 rounded-none"
                                      placeholder="e.g. Only 2 of 4 required pay stubs provided — need most recent 4 weeks"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Internal notes (optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={actionNotes}
                                      onChange={(e) => setActionNotes(e.target.value)}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-none"
                                      placeholder="Not shown to tenant"
                                    />
                                  </div>
                                </>
                              )}

                              {pendingAction === 'waive' && (
                                <>
                                  <p className="text-sm text-gray-700">
                                    Mark <strong>{doc.label}</strong>
                                    {personLabel ? ` (${personLabel})` : ''} as not applicable?
                                  </p>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Reason
                                      <span className="text-gray-400 font-normal ml-1">
                                        (shown to tenant)
                                      </span>
                                    </label>
                                    <input
                                      type="text"
                                      value={actionNotes}
                                      onChange={(e) => setActionNotes(e.target.value)}
                                      className="w-full px-3 py-1.5 text-sm border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded-none"
                                      placeholder="e.g. US citizen confirmed — I-551 not required"
                                    />
                                  </div>
                                </>
                              )}

                              {actionError && (
                                <p className="text-xs text-red-600">{actionError}</p>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAction(doc.id, pendingAction)}
                                  disabled={
                                    isSubmittingAction ||
                                    (pendingAction === 'reject' && !rejectionReason.trim())
                                  }
                                  className={`px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50 rounded-none ${
                                    pendingAction === 'approve'
                                      ? 'bg-green-600 hover:bg-green-700'
                                      : pendingAction === 'reject'
                                      ? 'bg-red-600 hover:bg-red-700'
                                      : 'bg-indigo-600 hover:bg-indigo-700'
                                  }`}
                                >
                                  {isSubmittingAction
                                    ? 'Saving...'
                                    : pendingAction === 'approve'
                                    ? 'Confirm Approve'
                                    : pendingAction === 'reject'
                                    ? 'Confirm Reject'
                                    : 'Confirm Waive'}
                                </button>
                                <button
                                  onClick={closeActionPanel}
                                  disabled={isSubmittingAction}
                                  className="px-4 py-1.5 text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white transition-colors rounded-none"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Revision history rows */}
                      {isRevisionsExpanded &&
                        doc.revisions.map((rev) => (
                          <tr
                            key={rev.id}
                            className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500"
                          >
                            <td className="px-4 py-2 pl-10 text-gray-400 italic">
                              ↳ v{rev.revision}
                            </td>
                            <td className="px-4 py-2">
                              {rev.status_at_review ? (
                                <StatusBadge status={rev.status_at_review as DocStatus} />
                              ) : (
                                <span className="text-gray-400">Uploaded</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {rev.download_url ? (
                                <a
                                  href={rev.download_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-blue-500 hover:underline"
                                >
                                  {rev.file_name.length > 42
                                    ? rev.file_name.slice(0, 42) + '…'
                                    : rev.file_name}
                                </a>
                              ) : (
                                <span className="font-mono">{rev.file_name}</span>
                              )}
                            </td>
                            <td className="px-4 py-2">{rev.reviewer || rev.uploaded_by}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {rev.reviewed_at
                                ? new Date(rev.reviewed_at).toLocaleDateString()
                                : new Date(rev.uploaded_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-center">v{rev.revision}</td>
                            <td className="px-4 py-2 text-red-600">
                              {rev.rejection_reason || ''}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
