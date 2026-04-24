'use client';

import { useState, useEffect, useCallback } from 'react';
import { buildings } from '@/lib/buildings';
import { PbvPreapplication, QualificationResult, PbvReviewStatus, HouseholdMember } from '@/types/compliance';

type ListRow = Pick<
  PbvPreapplication,
  | 'id'
  | 'created_at'
  | 'hoh_name'
  | 'building_address'
  | 'unit_number'
  | 'household_size'
  | 'total_household_income'
  | 'income_limit'
  | 'qualification_result'
  | 'stanton_review_status'
  | 'stanton_reviewer'
  | 'stanton_review_date'
  | 'bedroom_count'
  | 'language'
  | 'unit_not_in_canonical_list'
  | 'submission_source'
>;

const QUAL_LABELS: Record<QualificationResult, string> = {
  likely_qualifies: 'Likely Qualifies',
  over_income: 'Over Income',
  citizenship_issue: 'Citizenship Issue',
  over_income_and_citizenship: 'Over Income + Citizenship',
};

const QUAL_COLORS: Record<QualificationResult, string> = {
  likely_qualifies: 'bg-green-100 text-green-800 border-green-200',
  over_income: 'bg-red-100 text-red-800 border-red-200',
  citizenship_issue: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  over_income_and_citizenship: 'bg-red-100 text-red-800 border-red-200',
};

const REVIEW_LABELS: Record<PbvReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  needs_info: 'Needs Info',
};

const REVIEW_COLORS: Record<PbvReviewStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  denied: 'bg-red-100 text-red-800 border-red-200',
  needs_info: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

function formatCurrency(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return '$' + n.toLocaleString('en-US');
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PbvPreappsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PbvPreapplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [filterQual, setFilterQual] = useState('');
  const [filterReview, setFilterReview] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');

  // Admin tab
  const [adminTab, setAdminTab] = useState<'submissions' | 'thresholds'>('submissions');

  // Review panel state
  const [reviewAction, setReviewAction] = useState<'approved' | 'denied' | 'needs_info' | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterQual) params.set('qualification_result', filterQual);
      if (filterReview) params.set('review_status', filterReview);
      if (filterBuilding) params.set('building', filterBuilding);

      const res = await fetch(`/api/admin/pbv/preapps?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load pre-applications');
    } finally {
      setLoading(false);
    }
  }, [filterQual, filterReview, filterBuilding]);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setReviewAction('');
    setReviewNotes('');
    setReviewError('');
    try {
      const res = await fetch(`/api/admin/pbv/preapps/${id}`);
      if (!res.ok) throw new Error('Failed to load detail');
      const json = await res.json();
      setDetail(json.data);
    } catch (err: any) {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setReviewAction('');
    setReviewNotes('');
    setReviewError('');
  };

  const deleteApplication = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/pbv/preapps/${selectedId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Delete failed');
      }
      closeDetail();
      await loadList();
    } catch (err: any) {
      // Surface error inside the detail panel via reviewError state
      setReviewError(err.message || 'Failed to delete application');
    }
  };

  const submitReview = async () => {
    if (!reviewAction || !selectedId) return;
    setReviewing(true);
    setReviewError('');
    try {
      const res = await fetch(`/api/admin/pbv/preapps/${selectedId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reviewAction, notes: reviewNotes, reviewer: 'staff' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Review failed');
      }
      // Refresh both list and detail
      await loadList();
      await openDetail(selectedId);
    } catch (err: any) {
      setReviewError(err.message || 'Failed to save review');
    } finally {
      setReviewing(false);
    }
  };

  const duplicateKeys = rows.reduce((acc, r) => {
    const k = `${r.building_address}||${r.unit_number}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-[var(--divider)] shadow-sm flex-shrink-0">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-serif text-[var(--primary)]">PBV Pre-Applications</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Review tenant pre-application submissions</p>
        </div>
        {/* Admin tab bar */}
        <div className="flex border-t border-[var(--divider)]">
          {(['submissions', 'thresholds'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setAdminTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                adminTab === tab
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab === 'submissions' ? 'Submissions' : 'Income Limits'}
            </button>
          ))}
        </div>
      </div>

      {adminTab === 'thresholds' && <ThresholdsPanel />}

      {adminTab === 'submissions' && <>
      {/* Filter bar */}
      <div className="bg-white border-b border-[var(--divider)] flex-shrink-0">
        <div className="px-6 py-3 flex flex-wrap gap-3">
          <select
            value={filterQual}
            onChange={(e) => setFilterQual(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All results</option>
            {(Object.keys(QUAL_LABELS) as QualificationResult[]).map((k) => (
              <option key={k} value={k}>{QUAL_LABELS[k]}</option>
            ))}
          </select>

          <select
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All review statuses</option>
            {(Object.keys(REVIEW_LABELS) as PbvReviewStatus[]).map((k) => (
              <option key={k} value={k}>{REVIEW_LABELS[k]}</option>
            ))}
          </select>

          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {(filterQual || filterReview || filterBuilding) && (
            <button
              type="button"
              onClick={() => { setFilterQual(''); setFilterReview(''); setFilterBuilding(''); }}
              className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--border)] rounded-none transition-colors duration-200"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-sm text-[var(--muted)] self-center">
            {rows.length} submission{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Table */}
        <div className={`flex-1 overflow-auto p-6 ${selectedId ? 'hidden lg:block' : ''}`}>
          {error && (
            <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="text-sm text-[var(--muted)] py-8 text-center">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="bg-white border border-[var(--border)] py-16 text-center">
              <p className="text-[var(--muted)] text-sm">No pre-applications found.</p>
            </div>
          ) : (
            <div className="bg-white border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Unit</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">HoH Name</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">HH Size</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Total Income</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Limit</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Result</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Review</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openDetail(row.id)}
                      className={`border-b border-[var(--divider)] hover:bg-[var(--bg-section)] cursor-pointer transition-colors ${selectedId === row.id ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--ink)] flex items-center gap-1.5 flex-wrap">
                          {row.unit_number}
                          {row.unit_not_in_canonical_list && (
                            <span className="text-[10px] font-medium px-1 py-px bg-amber-100 text-amber-700 border border-amber-200 leading-none">Unit?</span>
                          )}
                          {duplicateKeys[`${row.building_address}||${row.unit_number}`] > 1 && (
                            <span className="text-[10px] font-medium px-1 py-px bg-orange-100 text-orange-700 border border-orange-200 leading-none">Duplicate</span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-0.5">{row.building_address}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink)]">{row.hoh_name}</td>
                      <td className="px-4 py-3 text-right text-[var(--ink)]">{row.household_size}</td>
                      <td className="px-4 py-3 text-right text-[var(--ink)]">{formatCurrency(row.total_household_income)}</td>
                      <td className="px-4 py-3 text-right text-[var(--muted)]">{formatCurrency(row.income_limit)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium border ${QUAL_COLORS[row.qualification_result]}`}>
                          {QUAL_LABELS[row.qualification_result]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium border ${REVIEW_COLORS[row.stanton_review_status]}`}>
                          {REVIEW_LABELS[row.stanton_review_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {selectedId && (
          <div className="w-full lg:w-[480px] xl:w-[520px] bg-white border-l border-[var(--divider)] flex flex-col flex-shrink-0 overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--divider)] flex-shrink-0">
              <h2 className="font-serif text-lg text-[var(--primary)]">Pre-Application Detail</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="p-1 hover:bg-[var(--bg-section)] transition-colors duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="p-6 text-sm text-[var(--muted)]">Loading...</div>
              ) : !detail ? (
                <div className="p-6 text-sm text-[var(--error)]">Failed to load detail.</div>
              ) : (
                <DetailContent
                  detail={detail}
                  reviewAction={reviewAction}
                  reviewNotes={reviewNotes}
                  reviewing={reviewing}
                  reviewError={reviewError}
                  onActionChange={setReviewAction}
                  onNotesChange={setReviewNotes}
                  onSubmitReview={submitReview}
                  onDelete={deleteApplication}
                />
              )}
            </div>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ── Thresholds panel (inlined from admin/pbv/thresholds) ─────────────────────

interface Threshold {
  id?: string;
  household_size: number;
  income_limit: number;
  effective_date: string;
}

function ThresholdsPanel() {
  const [rows, setRows] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Record<number, { income_limit: string; effective_date: string }>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pbv/thresholds');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const data: Threshold[] = json.data ?? [];
      setRows(data);
      const initial: Record<number, { income_limit: string; effective_date: string }> = {};
      for (const r of data) {
        initial[r.household_size] = { income_limit: String(r.income_limit), effective_date: r.effective_date };
      }
      setEdits(initial);
      setDirty(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load thresholds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (size: number, field: 'income_limit' | 'effective_date', value: string) => {
    setEdits(prev => ({ ...prev, [size]: { ...prev[size], [field]: value } }));
    setDirty(true);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const thresholds = rows.map(r => ({
        household_size: r.household_size,
        income_limit: Number(edits[r.household_size]?.income_limit ?? r.income_limit),
        effective_date: edits[r.household_size]?.effective_date ?? r.effective_date,
      }));
      const res = await fetch('/api/admin/pbv/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Save failed');
      }
      await load();
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const initial: Record<number, { income_limit: string; effective_date: string }> = {};
    for (const r of rows) {
      initial[r.household_size] = { income_limit: String(r.income_limit), effective_date: r.effective_date };
    }
    setEdits(initial);
    setDirty(false);
    setSaveError('');
    setSaveSuccess(false);
  };

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-serif text-[var(--primary)]">Income Limits by Household Size</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Used for pre-application qualification math. Changes take effect on new submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button type="button" onClick={handleReset} disabled={saving}
              className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-section)] rounded-none transition-colors duration-200 disabled:opacity-50">
              Discard
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={!dirty || saving}
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded-none transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saveError && <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>}
      {saveSuccess && <div className="mb-4 border border-green-200 bg-green-50 p-3 text-sm text-green-700">Thresholds saved successfully.</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)] py-8 text-center">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[var(--border)] py-16 text-center">
          <p className="text-[var(--muted)] text-sm">No thresholds found.</p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="bg-white border border-[var(--border)]">
            <div className="grid grid-cols-[80px_1fr_1fr] bg-[var(--bg-section)] border-b border-[var(--divider)]">
              <div className="px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">HH Size</div>
              <div className="px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Income Limit</div>
              <div className="px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Effective Date</div>
            </div>
            {rows.map(row => {
              const edit = edits[row.household_size];
              const originalLimit = row.income_limit;
              const editedLimit = Number(edit?.income_limit ?? row.income_limit);
              const isChanged = edit && (editedLimit !== originalLimit || edit.effective_date !== row.effective_date);
              return (
                <div key={row.household_size}
                  className={`grid grid-cols-[80px_1fr_1fr] border-b border-[var(--divider)] last:border-b-0 ${isChanged ? 'bg-yellow-50/50' : ''}`}>
                  <div className="px-4 py-3 flex items-center">
                    <span className="text-sm font-medium text-[var(--ink)]">{row.household_size} {row.household_size === 1 ? 'person' : 'people'}</span>
                  </div>
                  <div className="px-4 py-2 flex items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-[var(--muted)]">$</span>
                      <input type="number" min={0} step={1000}
                        value={edit?.income_limit ?? String(row.income_limit)}
                        onChange={e => handleChange(row.household_size, 'income_limit', e.target.value)}
                        className="w-32 px-2 py-1.5 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] bg-white" />
                      {edit && editedLimit !== originalLimit && (
                        <span className="text-xs text-[var(--muted)]">was ${originalLimit.toLocaleString('en-US')}</span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 flex items-center">
                    <input type="date"
                      value={edit?.effective_date ?? row.effective_date}
                      onChange={e => handleChange(row.household_size, 'effective_date', e.target.value)}
                      className="px-2 py-1.5 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] bg-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailContent({
  detail,
  reviewAction,
  reviewNotes,
  reviewing,
  reviewError,
  onActionChange,
  onNotesChange,
  onSubmitReview,
  onDelete,
}: {
  detail: PbvPreapplication;
  reviewAction: 'approved' | 'denied' | 'needs_info' | '';
  reviewNotes: string;
  reviewing: boolean;
  reviewError: string;
  onActionChange: (a: 'approved' | 'denied' | 'needs_info' | '') => void;
  onNotesChange: (n: string) => void;
  onSubmitReview: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const incomeOk = detail.income_limit === null || detail.total_household_income <= detail.income_limit;
  const citizenshipOk = detail.hoh_is_citizen || detail.other_adult_citizen;
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const handleGeneratePdf = async () => {
    setPdfGenerating(true);
    setPdfError('');
    try {
      const res = await fetch(`/api/admin/pbv/preapps/${detail.id}/summary-pdf`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'PDF generation failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = detail.hoh_name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      a.download = `PBV_PreApp_Summary_${safeName}_${detail.id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err.message || 'Failed to generate PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="p-5 space-y-6">
      {/* Status badges + PDF button */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex px-2 py-1 text-xs font-medium border ${QUAL_COLORS[detail.qualification_result]}`}>
          {QUAL_LABELS[detail.qualification_result]}
        </span>
        <span className={`inline-flex px-2 py-1 text-xs font-medium border ${REVIEW_COLORS[detail.stanton_review_status]}`}>
          {REVIEW_LABELS[detail.stanton_review_status]}
        </span>
        <button
          type="button"
          onClick={handleGeneratePdf}
          disabled={pdfGenerating}
          className="ml-auto px-3 py-1.5 text-xs font-medium border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--bg-section)] rounded-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pdfGenerating ? 'Generating...' : 'Generate Summary PDF'}
        </button>
      </div>
      {pdfError && (
        <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">{pdfError}</div>
      )}

      {/* Head of Household */}
      <section>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Head of Household</h3>
        <div className="space-y-2 text-sm">
          <Row label="Name" value={detail.hoh_name} />
          <Row label="Date of Birth" value={formatDate(detail.hoh_dob)} />
          <Row label="Building" value={detail.building_address} />
          <Row label="Unit" value={detail.unit_number} />
          <Row label="Submitted" value={formatDate(detail.created_at)} />
          <Row label="Language" value={detail.language.toUpperCase()} />
        </div>
      </section>

      {/* Qualification Math */}
      <section>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Qualification Analysis</h3>
        <div className="bg-[var(--bg-section)] border border-[var(--divider)] p-3 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-[var(--muted)]">Total Household Income</span>
            <span className="font-medium text-[var(--ink)]">{formatCurrency(detail.total_household_income)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--muted)]">Income Limit ({detail.household_size}-person HH)</span>
            <span className="font-medium text-[var(--ink)]">{formatCurrency(detail.income_limit)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-[var(--divider)]">
            <span className="text-[var(--muted)]">Income Check</span>
            <StatusPill ok={incomeOk} okLabel="Under Limit" failLabel="Over Limit" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--muted)]">Citizenship</span>
            <StatusPill ok={!!citizenshipOk} okLabel="Met" failLabel="Not Met" />
          </div>
          {detail.bedroom_count !== null && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--muted)]">Bedroom Count</span>
              <span className="font-medium text-[var(--ink)]">{detail.bedroom_count} BR</span>
            </div>
          )}
        </div>
      </section>

      {/* Household Members */}
      <section>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">
          Household Members ({detail.household_size})
        </h3>
        <div className="border border-[var(--border)] divide-y divide-[var(--divider)]">
          {(detail.household_members as HouseholdMember[]).map((m, i) => (
            <div key={i} className="px-3 py-3 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-[var(--ink)]">{m.name}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {m.relationship.charAt(0).toUpperCase() + m.relationship.slice(1)} · DOB: {formatDate(m.dob)}
                  </p>
                  {m.income_sources?.length > 0 && (
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Sources: {m.income_sources.join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-[var(--ink)] font-medium flex-shrink-0 ml-3">
                  {formatCurrency(m.annual_income)}/yr
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Citizenship detail */}
      <section>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Citizenship</h3>
        <div className="space-y-2 text-sm">
          <Row label="HoH is citizen/eligible" value={detail.hoh_is_citizen ? 'Yes' : 'No'} />
          {!detail.hoh_is_citizen && (
            <Row
              label="Other adult eligible"
              value={detail.other_adult_citizen === null ? '—' : detail.other_adult_citizen ? 'Yes' : 'No'}
            />
          )}
        </div>
      </section>

      {/* Existing review */}
      {detail.stanton_review_status !== 'pending' && (
        <section>
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Previous Review</h3>
          <div className="space-y-2 text-sm">
            <Row label="Status" value={REVIEW_LABELS[detail.stanton_review_status]} />
            <Row label="Reviewer" value={detail.stanton_reviewer ?? '—'} />
            <Row label="Date" value={formatDate(detail.stanton_review_date)} />
            {detail.stanton_review_notes && (
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Notes</p>
                <p className="text-[var(--ink)] bg-[var(--bg-section)] border border-[var(--divider)] p-2 text-sm">{detail.stanton_review_notes}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Review action */}
      <section>
        <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Review Action</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['approved', 'denied', 'needs_info'] as const).map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onActionChange(reviewAction === action ? '' : action)}
                className={`flex-1 py-2 px-2 text-xs font-medium border rounded-none transition-colors duration-200 ${
                  reviewAction === action
                    ? action === 'approved'
                      ? 'bg-green-700 text-white border-green-700'
                      : action === 'denied'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-yellow-600 text-white border-yellow-600'
                    : 'bg-white text-[var(--ink)] border-[var(--border)] hover:bg-[var(--bg-section)]'
                }`}
              >
                {action === 'approved' ? 'Approve' : action === 'denied' ? 'Deny' : 'Needs Info'}
              </button>
            ))}
          </div>

          <textarea
            value={reviewNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
          />

          {reviewError && (
            <div className="border border-red-200 bg-red-50 p-2 text-sm text-red-700">{reviewError}</div>
          )}

          <button
            type="button"
            onClick={onSubmitReview}
            disabled={!reviewAction || reviewing}
            className="w-full py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewing ? 'Saving...' : 'Save Review'}
          </button>
        </div>
      </section>

      {/* Delete */}
      <section className="border-t border-[var(--divider)] pt-5">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-none transition-colors duration-200"
          >
            Delete Application
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-700 font-medium">Delete this pre-application permanently?</p>
            <p className="text-xs text-[var(--muted)]">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-section)] rounded-none transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-none transition-colors duration-200"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--muted)] flex-shrink-0">{label}</span>
      <span className="text-[var(--ink)] text-right">{value}</span>
    </div>
  );
}

function StatusPill({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium border ${ok ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
      {ok ? okLabel : failLabel}
    </span>
  );
}
