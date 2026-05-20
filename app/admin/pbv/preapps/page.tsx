'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { buildings } from '@/lib/buildings';
import { copyToClipboard } from '@/lib/copyToClipboard';
import { parsePhoneToE164 } from '@/lib/phoneParser';
import { PbvPreapplication, QualificationResult, PbvReviewStatus, HouseholdMember } from '@/types/compliance';
import {
  DataTable,
  type ColumnDef,
  BadgeCell,
  MoneyCell,
  DateCell,
} from '@/components/admin/DataTable';

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
  needs_citizenship_review: 'Needs Citizenship Review',
};

const QUAL_COLORS: Record<QualificationResult, string> = {
  likely_qualifies: 'bg-green-100 text-green-800 border-green-200',
  over_income: 'bg-red-100 text-red-800 border-red-200',
  citizenship_issue: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  over_income_and_citizenship: 'bg-red-100 text-red-800 border-red-200',
  needs_citizenship_review: 'bg-amber-100 text-amber-800 border-amber-200',
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

  const duplicateKeys = useMemo(() => rows.reduce((acc, r) => {
    const k = `${r.building_address}||${r.unit_number}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>), [rows]);

  const buildingOptions = useMemo(
    () => buildings.map((b) => ({ value: b, label: b })),
    []
  );

  const columns = useMemo<ColumnDef<ListRow>[]>(
    () => [
      {
        id: 'unit_number',
        accessorKey: 'unit_number',
        header: 'Unit',
        cell: ({ row }) => {
          const isDuplicate = duplicateKeys[`${row.building_address}||${row.unit_number}`] > 1;
          return (
            <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <span className="font-medium">{row.unit_number}</span>
              {row.unit_not_in_canonical_list && (
                <BadgeCell value="unit_flag" label="Unit?" variant="amber" />
              )}
              {isDuplicate && <BadgeCell value="duplicate" label="Duplicate" variant="gray" />}
            </div>
          );
        },
      },
      {
        id: 'building_address',
        accessorKey: 'building_address',
        header: 'Building',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: buildingOptions,
            multi: true,
          },
        },
        cell: ({ value }) => <span className="text-sm text-[var(--muted)]">{value as string}</span>,
      },
      {
        id: 'hoh_name',
        accessorKey: 'hoh_name',
        header: 'HoH Name',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
        },
      },
      {
        id: 'household_size',
        accessorKey: 'household_size',
        header: 'HH Size',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => row.household_size.toString(),
        },
      },
      {
        id: 'total_household_income',
        accessorKey: 'total_household_income',
        header: 'Total Income',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => (row.total_household_income ?? 0).toString(),
        },
        cell: ({ value }) => <MoneyCell value={Number(value) || 0} />, 
      },
      {
        id: 'income_limit',
        accessorKey: 'income_limit',
        header: 'Limit',
        meta: {
          align: 'right',
          csvValue: (row) => (row.income_limit ?? 0).toString(),
        },
        cell: ({ value }) => <MoneyCell value={Number(value) || 0} />, 
      },
      {
        id: 'qualification_result',
        accessorKey: 'qualification_result',
        header: 'Result',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: (Object.entries(QUAL_LABELS) as [QualificationResult, string][]).map(([value, label]) => ({ value, label })),
            multi: true,
          },
          csvValue: (row) => QUAL_LABELS[row.qualification_result],
        },
        cell: ({ row }) => (
          <BadgeCell
            value={row.qualification_result}
            variant={row.qualification_result === 'likely_qualifies' ? 'green' : row.qualification_result === 'over_income' ? 'red' : 'amber'}
            label={QUAL_LABELS[row.qualification_result]}
          />
        ),
      },
      {
        id: 'stanton_review_status',
        accessorKey: 'stanton_review_status',
        header: 'Review',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: (Object.entries(REVIEW_LABELS) as [PbvReviewStatus, string][]).map(([value, label]) => ({ value, label })),
          },
          csvValue: (row) => REVIEW_LABELS[row.stanton_review_status],
        },
        cell: ({ row }) => (
          <BadgeCell
            value={row.stanton_review_status}
            variant={row.stanton_review_status === 'approved' ? 'green' : row.stanton_review_status === 'denied' ? 'red' : row.stanton_review_status === 'needs_info' ? 'yellow' : 'gray'}
            label={REVIEW_LABELS[row.stanton_review_status]}
          />
        ),
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Submitted',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.created_at,
        },
        cell: ({ value }) => <DateCell value={value as string} />, 
      },
    ],
    [duplicateKeys, buildingOptions]
  );

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

          {(filterQual || filterReview) && (
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
          <DataTable<ListRow>
            data={rows}
            columns={columns}
            urlNamespace="preapps"
            getRowId={(row) => row.id}
            loading={loading}
            enableGlobalSearch={true}
            enableColumnFilters={true}
            enableColumnVisibility={true}
            enableCsvExport={true}
            onRowClick={(row) => openDetail(row.id)}
            emptyState={error ? (
              <div className="p-12 text-center text-sm text-red-600">{error}</div>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--muted)]">No pre-applications found.</div>
            )}
          />
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

// ── Thresholds panel (inlined from admin/pbv/thresholds) ──

interface Threshold {
  id?: string;
  household_size: number;
  income_limit: number;
  effective_date: string;
  zipcode?: string | null;
}

const ZIPCODES = ['06106', '06114', '06105', '06120']; // Hartford MSA zipcodes

function ThresholdsPanel() {
  const [rows, setRows] = useState<Threshold[]>([]);
  const [selectedZipcode, setSelectedZipcode] = useState<string>('06106'); // Default to first Hartford zip
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
      // Fetch all thresholds, then filter by zipcode client-side
      const res = await fetch('/api/admin/pbv/thresholds');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const allData: Threshold[] = json.data ?? [];
      // Filter by selected zipcode (or null/undefined for default)
      const filteredData = allData.filter(
        (t) => t.zipcode === selectedZipcode || (!t.zipcode && selectedZipcode === '06106')
      );
      setRows(filteredData);
      const initial: Record<number, { income_limit: string; effective_date: string }> = {};
      for (const r of filteredData) {
        initial[r.household_size] = { income_limit: String(r.income_limit), effective_date: r.effective_date };
      }
      setEdits(initial);
      setDirty(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load thresholds');
    } finally {
      setLoading(false);
    }
  }, [selectedZipcode]);

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
        zipcode: selectedZipcode,
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
          <select
            value={selectedZipcode}
            onChange={(e) => setSelectedZipcode(e.target.value)}
            className="px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            {ZIPCODES.map((zip) => (
              <option key={zip} value={zip}>ZIP {zip}</option>
            ))}
          </select>
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

  // Full application + chain state
  const [fullAppResult, setFullAppResult] = useState<{ id: string; magic_link: string } | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [emailFallback, setEmailFallback] = useState(false);

  type ChainStep = 'idle' | 'confirming' | 'approving' | 'creating' | 'sending' | 'done' | 'error';
  const [chainStep, setChainStep] = useState<ChainStep>('idle');
  const [chainError, setChainError] = useState<{ step: ChainStep; message: string } | null>(null);

  // Phone editing state
  const [localPhone, setLocalPhone] = useState<string | null>(detail.phone);
  const [phoneEditMode, setPhoneEditMode] = useState(false);
  const [phoneEditValue, setPhoneEditValue] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneEditError, setPhoneEditError] = useState('');
  // Inline phone capture before confirming chain (when hasPhone is false)
  const [inlinePhoneMode, setInlinePhoneMode] = useState(false);
  const [inlinePhoneValue, setInlinePhoneValue] = useState('');
  const [inlinePhoneSaving, setInlinePhoneSaving] = useState(false);
  const [inlinePhoneError, setInlinePhoneError] = useState('');

  const qualified = detail.qualification_result === 'likely_qualifies';
  const approved = detail.stanton_review_status === 'approved';
  const hasPhone = !!localPhone;

  const handleApproveAndSendInvitation = async (fromStep?: ChainStep) => {
    setChainError(null);

    const startFromApprove = !fromStep || fromStep === 'approving';
    const startFromCreate = fromStep === 'creating';
    const startFromSend = fromStep === 'sending';

    let currentFullAppId = fullAppResult?.id ?? null;

    // Step 1: Approve (skip if already approved or retrying from a later step)
    if (startFromApprove && detail.stanton_review_status !== 'approved') {
      setChainStep('approving');
      const res = await fetch(`/api/admin/pbv/preapps/${detail.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approved' }),
      });
      const j = await res.json() as { success: boolean; message?: string };
      if (!j.success) {
        setChainError({ step: 'approving', message: j.message || 'Failed to approve preapp' });
        setChainStep('error');
        return;
      }
    }

    // Step 2: Create full application (skip if already exists or retrying from send)
    if (!startFromSend && !currentFullAppId) {
      setChainStep('creating');
      const res = await fetch('/api/admin/pbv/full-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_address: detail.building_address,
          unit_number: detail.unit_number,
          head_of_household_name: detail.hoh_name,
          bedroom_count: detail.bedroom_count ?? undefined,
          language: detail.language,
          preapp_id: detail.id,
          phone: localPhone ?? undefined,
        }),
      });
      const j = await res.json() as { success: boolean; message?: string; data?: { id: string; magic_link: string } };
      if (!j.success && res.status !== 409) {
        setChainError({ step: 'creating', message: j.message || 'Failed to create full application' });
        setChainStep('error');
        return;
      }
      if (j.data?.id) {
        currentFullAppId = j.data.id;
        setFullAppResult({ id: j.data.id, magic_link: j.data.magic_link ?? '' });
      }
    }

    if (!currentFullAppId) {
      setChainError({ step: 'creating', message: 'Full application ID not available' });
      setChainStep('error');
      return;
    }

    // Step 3: Send SMS
    setChainStep('sending');
    const res = await fetch(`/api/admin/pbv/full-applications/${currentFullAppId}/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_type: 'magic_link_initial' }),
    });
    const j = await res.json() as { success: boolean; message?: string; data?: { email_sent?: boolean; note?: string } };
    if (!j.success) {
      setChainError({ step: 'sending', message: j.message || 'Failed to send invitation' });
      setChainStep('error');
      return;
    }
    const isEmailFallback = !!(j.data?.note && j.data.note.includes('email fallback'));
    setEmailFallback(isEmailFallback);
    setSmsSent(true);
    setChainStep('done');
  };

  const savePhonePatch = async (rawPhone: string): Promise<{ ok: boolean; message?: string; e164?: string }> => {
    const res = await fetch(`/api/admin/pbv/preapps/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: rawPhone }),
    });
    const j = await res.json() as { success: boolean; message?: string };
    if (!j.success) return { ok: false, message: j.message };
    return { ok: true, e164: rawPhone };
  };

  const handleSavePhone = async () => {
    setPhoneSaving(true);
    setPhoneEditError('');
    const result = await savePhonePatch(phoneEditValue.trim());
    if (!result.ok) {
      setPhoneEditError(result.message || 'Failed to save phone');
    } else {
      setLocalPhone(phoneEditValue.trim());
      setPhoneEditMode(false);
    }
    setPhoneSaving(false);
  };

  const handleSaveInlinePhone = async () => {
    setInlinePhoneSaving(true);
    setInlinePhoneError('');
    const result = await savePhonePatch(inlinePhoneValue.trim());
    if (!result.ok) {
      setInlinePhoneError(result.message || 'Failed to save phone');
      setInlinePhoneSaving(false);
      return;
    }
    setLocalPhone(inlinePhoneValue.trim());
    setInlinePhoneSaving(false);
    setInlinePhoneMode(false);
    setChainStep('confirming');
  };

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
          {/* Editable phone field */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-[var(--muted)] shrink-0">Phone</span>
            {!phoneEditMode ? (
              <div className="flex items-center gap-2">
                <span className="text-[var(--ink)] text-right">
                  {localPhone
                    ? (parsePhoneToE164(localPhone)?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') ?? localPhone)
                    : <span className="text-[var(--muted)] italic">Not set</span>
                  }
                </span>
                <button
                  type="button"
                  onClick={() => { setPhoneEditValue(localPhone ?? ''); setPhoneEditMode(true); setPhoneEditError(''); }}
                  className="text-xs text-[var(--primary)] hover:underline shrink-0"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1 items-end w-full">
                <input
                  type="tel"
                  value={phoneEditValue}
                  onChange={e => setPhoneEditValue(e.target.value)}
                  placeholder="(860) 555-0199"
                  className="w-full px-2 py-1 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
                {phoneEditError && <p className="text-xs text-red-600">{phoneEditError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhoneEditMode(false)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePhone}
                    disabled={phoneSaving || !phoneEditValue.trim()}
                    className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                  >
                    {phoneSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
                    {m.relationship.charAt(0).toUpperCase() + m.relationship.slice(1)} -+ DOB: {formatDate(m.dob)}
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

      {/* Combined Invite section — visible for qualified preapps */}
      {qualified && (
        <section className="border-t border-[var(--divider)] pt-5">
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Full Application</h3>

          <div className="space-y-4">
            {/* Inline phone capture (no phone yet, user clicked the combined button) */}
            {inlinePhoneMode && (
              <div className="border border-[var(--border)] bg-[var(--bg-section)] p-4 space-y-3">
                <p className="text-sm font-medium text-[var(--ink)]">Phone number required to send invitation</p>
                <input
                  type="tel"
                  value={inlinePhoneValue}
                  onChange={e => setInlinePhoneValue(e.target.value)}
                  placeholder="(860) 555-0199"
                  className="w-full px-2 py-1.5 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
                {inlinePhoneError && <p className="text-xs text-red-600">{inlinePhoneError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setInlinePhoneMode(false); setInlinePhoneValue(''); setInlinePhoneError(''); }}
                    className="flex-1 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white rounded-none transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveInlinePhone}
                    disabled={inlinePhoneSaving || !inlinePhoneValue.trim()}
                    className="flex-1 py-2 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] rounded-none transition-colors duration-200 disabled:opacity-50"
                  >
                    {inlinePhoneSaving ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Combined action button / confirm / progress / done / error */}
            {chainStep === 'idle' && !smsSent && !inlinePhoneMode && (() => {
              let label: string;
              if (!approved) label = 'Approve & Send Invitation';
              else if (!fullAppResult) label = 'Create & Send Invitation';
              else label = 'Send Invitation';
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!hasPhone) {
                      setInlinePhoneValue('');
                      setInlinePhoneError('');
                      setInlinePhoneMode(true);
                    } else {
                      setChainStep('confirming');
                    }
                  }}
                  className="w-full py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
                >
                  {label}
                </button>
              );
            })()}

            {chainStep === 'confirming' && (() => {
              const e164 = parsePhoneToE164(localPhone);
              const displayPhone = localPhone
                ? (e164
                  ? e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')
                  : `${localPhone} (unformatted)`)
                : 'No phone on file';
              const langMap: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
              const displayLang = langMap[detail.language] ?? detail.language;
              const willApprove = detail.stanton_review_status !== 'approved';
              const actionDesc = [
                willApprove ? 'approve the preapp' : null,
                !fullAppResult ? 'create the full application' : null,
                'text them the link',
              ].filter(Boolean).join(', ');
              return (
                <div className="border border-[var(--border)] bg-[var(--bg-section)] p-4 space-y-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-[var(--ink)]">{detail.hoh_name}</p>
                    <p className="text-[var(--muted)]">{displayPhone}</p>
                    <p className="text-[var(--muted)]">{displayLang}</p>
                  </div>
                  <p className="text-sm text-[var(--ink)]">This will: {actionDesc}.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChainStep('idle')}
                      className="flex-1 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white rounded-none transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveAndSendInvitation()}
                      className="flex-1 py-2 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] rounded-none transition-colors duration-200"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              );
            })()}

            {(chainStep === 'approving' || chainStep === 'creating' || chainStep === 'sending') && (
              <button
                type="button"
                disabled
                className="w-full py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-none opacity-50 cursor-not-allowed"
              >
                {chainStep === 'approving' && 'Approving...'}
                {chainStep === 'creating' && 'Creating application...'}
                {chainStep === 'sending' && 'Sending invitation...'}
              </button>
            )}

            {chainStep === 'done' && (
              <div className={`p-3 border text-sm font-medium ${emailFallback ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                {emailFallback ? 'Sent via email (SMS failed)' : 'Invitation sent ✓'}
              </div>
            )}

            {chainStep === 'error' && chainError && (
              <div className="border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-sm font-medium text-red-700">
                  Failed at: {chainError.step}
                </p>
                <p className="text-sm text-red-600">{chainError.message}</p>
                <button
                  type="button"
                  onClick={() => handleApproveAndSendInvitation(chainError.step as ChainStep)}
                  className="w-full py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-none transition-colors duration-200"
                >
                  Retry {chainError.step}
                </button>
              </div>
            )}

            {/* Magic link display — always visible once full app exists */}
            {fullAppResult && (
              <>
                <div className="bg-[var(--bg-section)] border border-[var(--divider)] p-3">
                  <p className="text-xs text-[var(--muted)] mb-1">Magic Link</p>
                  <p className="text-xs font-mono text-[var(--ink)] break-all">{fullAppResult.magic_link}</p>
                  <button
                    type="button"
                    onClick={() => { copyToClipboard(fullAppResult.magic_link); }}
                    className="mt-2 text-xs text-[var(--primary)] hover:underline"
                  >
                    Copy Link
                  </button>
                </div>

                <Link
                  href={`/admin/pbv/full-applications/${fullAppResult.id}`}
                  className="block w-full py-2.5 border border-[var(--border)] text-center text-[var(--ink)] text-sm font-medium rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200"
                >
                  View Full Application →
                </Link>
              </>
            )}
          </div>
        </section>
      )}

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

