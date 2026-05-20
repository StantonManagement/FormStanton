'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/admin/PageHeader';
import { useAdminAuth } from '@/lib/adminAuthContext';

const AMI_BANDS = [30, 50, 80, 100] as const;
const HOUSEHOLD_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface AmiLimitRow {
  id: string;
  msa_code: string;
  msa_name: string | null;
  effective_year: number;
  ami_pct: number;
  household_size: number;
  annual_limit: number;
  created_at: string;
}

type GroupKey = `${string}__${number}__${number}`;

interface GroupedLimits {
  msa_code: string;
  msa_name: string | null;
  effective_year: number;
  ami_pct: number;
  sizes: Record<number, AmiLimitRow>;
}

function groupRows(rows: AmiLimitRow[]): GroupedLimits[] {
  const map = new Map<GroupKey, GroupedLimits>();
  for (const row of rows) {
    const key: GroupKey = `${row.msa_code}__${row.effective_year}__${row.ami_pct}`;
    if (!map.has(key)) {
      map.set(key, {
        msa_code: row.msa_code,
        msa_name: row.msa_name,
        effective_year: row.effective_year,
        ami_pct: row.ami_pct,
        sizes: {},
      });
    }
    map.get(key)!.sizes[row.household_size] = row;
  }
  return Array.from(map.values());
}

const CSV_TEMPLATE = `effective_year,ami_pct,msa_code,msa_name,size_1,size_2,size_3,size_4,size_5,size_6,size_7,size_8
2025,50,25540,Hartford-West Hartford-East Hartford CT,38450,43950,49450,54900,59300,63700,68100,72500`;

export default function AmiLimitsPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth();
  const canManage = isSuperAdmin || hasPermission('role-management', 'admin');

  const [rows, setRows] = useState<AmiLimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterBand, setFilterBand] = useState('');

  // Add row form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    msa_code: '25540',
    msa_name: 'Hartford-West Hartford-East Hartford, CT',
    effective_year: String(new Date().getFullYear()),
    ami_pct: '50',
    household_size: '1',
    annual_limit: '',
  });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // CSV upload
  const [showCsv, setShowCsv] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvCommitting, setCsvCommitting] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState('');

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterYear) params.set('effective_year', filterYear);
      if (filterBand) params.set('ami_pct', filterBand);
      const res = await fetch(`/api/admin/ami-limits?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load');
      setRows(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load AMI limits');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterBand]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    setAddError('');
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/ami-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          effective_year: Number(addForm.effective_year),
          ami_pct: Number(addForm.ami_pct),
          household_size: Number(addForm.household_size),
          annual_limit: Number(addForm.annual_limit),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add');
      setShowAddForm(false);
      setAddForm((f) => ({ ...f, annual_limit: '' }));
      await load();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add row');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/admin/ami-limits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete');
      setDeletingId(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete row');
    }
  };

  const handleCsvPreview = async () => {
    setCsvError('');
    setCsvPreview(null);
    setCsvSuccess('');
    setCsvParsing(true);
    try {
      const res = await fetch('/api/admin/ami-limits/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, commit: false }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Parse failed');
      setCsvPreview(json.preview);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to parse CSV');
    } finally {
      setCsvParsing(false);
    }
  };

  const handleCsvCommit = async () => {
    setCsvError('');
    setCsvCommitting(true);
    try {
      const res = await fetch('/api/admin/ami-limits/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText, commit: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Commit failed');
      setCsvSuccess(`${json.inserted} rows inserted.`);
      setCsvPreview(null);
      setCsvText('');
      setShowCsv(false);
      await load();
    } catch (err: any) {
      setCsvError(err.message || 'Failed to commit CSV');
    } finally {
      setCsvCommitting(false);
    }
  };

  const grouped = groupRows(rows);

  const uniqueYears = [...new Set(rows.map((r) => r.effective_year))].sort((a, b) => b - a);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <PageHeader
          title="AMI Limits"
          subtitle="HUD Area Median Income limits by MSA, year, and household size"
          breadcrumbs={[{ label: 'Settings' }, { label: 'AMI Limits' }]}
        />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-sm text-[var(--muted)]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeader
        title="AMI Limits"
        subtitle="HUD Area Median Income limits by MSA, year, and household size"
        breadcrumbs={[{ label: 'Settings' }, { label: 'AMI Limits' }]}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowCsv(!showCsv); setShowAddForm(false); }}
                className="px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors"
              >
                CSV Upload
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setShowCsv(false); }}
                className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] transition-colors"
              >
                Add Row
              </button>
            </div>
          ) : null
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {!canManage && (
          <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You need super admin or role management permissions to edit AMI limits. View-only mode.
          </div>
        )}

        {error && (
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {csvSuccess && (
          <div className="border border-green-200 bg-green-50 p-4 text-sm text-green-700">{csvSuccess}</div>
        )}

        {/* ── CSV Upload Panel ── */}
        {showCsv && canManage && (
          <div className="bg-white border border-[var(--border)] p-5 space-y-4">
            <h2 className="font-serif text-lg text-[var(--primary)]">CSV Upload</h2>
            <p className="text-sm text-[var(--muted)]">
              Paste a CSV with the following header row. One data row per AMI band — each row expands to 8
              household-size records. <code className="text-xs bg-[var(--bg-section)] px-1">ON CONFLICT DO NOTHING</code> — existing rows are not overwritten.
            </p>
            <div className="bg-[var(--bg-section)] border border-[var(--divider)] px-3 py-2 text-xs font-mono text-[var(--muted)] overflow-x-auto whitespace-nowrap">
              effective_year, ami_pct, msa_code, msa_name, size_1, size_2, …, size_8
            </div>
            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setCsvPreview(null); setCsvError(''); }}
              rows={8}
              placeholder={CSV_TEMPLATE}
              className="w-full text-sm font-mono border border-[var(--border)] bg-white px-3 py-2 text-[var(--ink)] placeholder:text-[var(--muted)] resize-y focus:outline-none focus:border-[var(--primary)]"
            />
            {csvError && (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{csvError}</div>
            )}

            {csvPreview && (
              <div className="space-y-2">
                <div className="text-sm text-[var(--muted)]">{csvPreview.length} rows parsed — ready to commit.</div>
                <div className="overflow-x-auto border border-[var(--divider)]">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-section)]">
                        {['year', 'band', 'msa_code', 'size', 'annual_limit'].map((h) => (
                          <th key={h} className="px-3 py-1.5 text-left font-medium text-[var(--muted)] border-b border-[var(--divider)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 24).map((r, i) => (
                        <tr key={i} className="border-b border-[var(--divider)] last:border-0">
                          <td className="px-3 py-1">{r.effective_year}</td>
                          <td className="px-3 py-1">{r.ami_pct}%</td>
                          <td className="px-3 py-1">{r.msa_code}</td>
                          <td className="px-3 py-1">{r.household_size}</td>
                          <td className="px-3 py-1">${r.annual_limit.toLocaleString()}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 24 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-1 text-[var(--muted)] italic">
                            …and {csvPreview.length - 24} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleCsvPreview}
                disabled={csvParsing || !csvText.trim()}
                className="px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
              >
                {csvParsing ? 'Parsing…' : 'Preview'}
              </button>
              {csvPreview && (
                <button
                  onClick={handleCsvCommit}
                  disabled={csvCommitting}
                  className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
                >
                  {csvCommitting ? 'Committing…' : `Commit ${csvPreview.length} rows`}
                </button>
              )}
              <button
                onClick={() => { setShowCsv(false); setCsvText(''); setCsvPreview(null); setCsvError(''); }}
                className="px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Add Row Form ── */}
        {showAddForm && canManage && (
          <div className="bg-white border border-[var(--border)] p-5 space-y-4">
            <h2 className="font-serif text-lg text-[var(--primary)]">Add AMI Limit Row</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">MSA Code</span>
                <input
                  type="text"
                  value={addForm.msa_code}
                  onChange={(e) => setAddForm((f) => ({ ...f, msa_code: e.target.value }))}
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="block space-y-1 col-span-2 sm:col-span-1">
                <span className="text-xs font-medium text-[var(--muted)]">MSA Name</span>
                <input
                  type="text"
                  value={addForm.msa_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, msa_name: e.target.value }))}
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Effective Year</span>
                <input
                  type="number"
                  value={addForm.effective_year}
                  onChange={(e) => setAddForm((f) => ({ ...f, effective_year: e.target.value }))}
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">AMI Band</span>
                <select
                  value={addForm.ami_pct}
                  onChange={(e) => setAddForm((f) => ({ ...f, ami_pct: e.target.value }))}
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] bg-white focus:outline-none focus:border-[var(--primary)]"
                >
                  {AMI_BANDS.map((b) => (
                    <option key={b} value={b}>{b}%</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Household Size</span>
                <select
                  value={addForm.household_size}
                  onChange={(e) => setAddForm((f) => ({ ...f, household_size: e.target.value }))}
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] bg-white focus:outline-none focus:border-[var(--primary)]"
                >
                  {HOUSEHOLD_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Annual Limit ($)</span>
                <input
                  type="number"
                  value={addForm.annual_limit}
                  onChange={(e) => setAddForm((f) => ({ ...f, annual_limit: e.target.value }))}
                  placeholder="e.g. 54900"
                  className="w-full border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />
              </label>
            </div>
            {addError && (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{addError}</div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={addSaving || !addForm.annual_limit}
                className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
              >
                {addSaving ? 'Saving…' : 'Save Row'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(''); }}
                className="px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex items-center gap-3">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All years</option>
            {uniqueYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={filterBand}
            onChange={(e) => setFilterBand(e.target.value)}
            className="border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--ink)] bg-white focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="">All bands</option>
            {AMI_BANDS.map((b) => (
              <option key={b} value={b}>{b}% AMI</option>
            ))}
          </select>
          {(filterYear || filterBand) && (
            <button
              onClick={() => { setFilterYear(''); setFilterBand(''); }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-[var(--muted)] ml-auto">{rows.length} rows</span>
        </div>

        {/* ── Delete confirm ── */}
        {deletingId && (
          <div className="border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
            <span className="text-sm text-red-700">Delete this AMI limit row? This cannot be undone.</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {rows.length === 0 ? (
          <div className="bg-white border border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
            No AMI limit rows found.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div
                key={`${group.msa_code}__${group.effective_year}__${group.ami_pct}`}
                className="bg-white border border-[var(--border)] overflow-hidden"
              >
                {/* Group header */}
                <div className="px-5 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-base text-[var(--primary)]">
                      {group.ami_pct}% AMI
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-[var(--border)] text-[var(--muted)]">
                      {group.effective_year}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      {group.msa_name ?? group.msa_code}
                    </span>
                    <span className="text-xs text-[var(--muted)] opacity-60">
                      MSA {group.msa_code}
                    </span>
                  </div>
                </div>

                {/* Sizes table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--divider)]">
                        {HOUSEHOLD_SIZES.map((s) => (
                          <th
                            key={s}
                            className="px-4 py-2 text-center text-xs font-medium text-[var(--muted)] border-r border-[var(--divider)] last:border-r-0"
                          >
                            Size {s}
                          </th>
                        ))}
                        {canManage && <th className="px-4 py-2 w-12" />}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {HOUSEHOLD_SIZES.map((s) => {
                          const row = group.sizes[s];
                          return (
                            <td
                              key={s}
                              className="px-4 py-3 text-center text-sm text-[var(--ink)] border-r border-[var(--divider)] last:border-r-0"
                            >
                              {row ? (
                                <span>${row.annual_limit.toLocaleString()}</span>
                              ) : (
                                <span className="text-[var(--muted)] opacity-40">—</span>
                              )}
                            </td>
                          );
                        })}
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                const firstRow = Object.values(group.sizes)[0];
                                if (firstRow) setDeletingId(firstRow.id);
                              }}
                              title="Delete individual rows via Add Row form"
                              className="text-xs text-[var(--muted)] hover:text-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
