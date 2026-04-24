'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/errorMessage';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  slot: number;
  name: string;
  date_of_birth: string | null;
  age: number | null;
  relationship: string;
  ssn_last_four: string | null;
  annual_income: number;
  documented_income: number | null;
  income_sources: string[];
  disability: boolean;
  student: boolean;
  citizenship_status: string;
  criminal_history: string | null;
  signature_required: boolean;
  signature_date: string | null;
  signed_forms: string[];
}

interface Document {
  id: string;
  doc_type: string;
  label: string;
  person_slot: number;
  status: string;
  required: boolean;
  display_order: number;
}

interface AppDetail {
  id: string;
  created_at: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  bedroom_count: number | null;
  household_size: number;
  intake_submitted_at: string | null;
  stanton_review_status: string;
  stanton_reviewer: string | null;
  stanton_review_date: string | null;
  stanton_review_notes: string | null;
  hha_application_file: string | null;
  tenant_access_token: string;
  form_submission_id: string;
  magic_link: string;
  claiming_medical_deduction: boolean;
  has_childcare_expense: boolean;
  dv_status: boolean;
  homeless_at_admission: boolean;
  reasonable_accommodation_requested: boolean;
  members: Member[];
  documents: Document[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function deltaClass(claimed: number, documented: number | null): string {
  if (documented == null) return '';
  const diff = Math.abs(claimed - documented);
  const pct = claimed > 0 ? diff / claimed : 0;
  if (pct >= 0.1) return 'text-amber-700 font-semibold';
  return 'text-green-700';
}

function deltaLabel(claimed: number, documented: number | null): string {
  if (documented == null) return '—';
  const diff = documented - claimed;
  const pct = claimed > 0 ? Math.abs(diff) / claimed : 0;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${fmt(diff)} (${(pct * 100).toFixed(1)}%)`;
}

const DOC_STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-800',
  submitted: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
  missing: 'bg-gray-100 text-gray-600',
  waived: 'bg-indigo-100 text-indigo-800',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  needs_info: 'Needs Info',
  approved: 'Approved',
  denied: 'Denied',
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  under_review: 'bg-yellow-100 text-yellow-800',
  needs_info: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PbvFullApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [incomeEdits, setIncomeEdits] = useState<Record<string, string>>({});
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [generatingHha, setGeneratingHha] = useState(false);
  const [hhaMsg, setHhaMsg] = useState('');
  const [exportingHach, setExportingHach] = useState(false);
  const [hhaTemplateFile, setHhaTemplateFile] = useState<File | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');
      const d: AppDetail = json.data;
      setDetail(d);
      setReviewStatus(d.stanton_review_status);
      setReviewerName(d.stanton_reviewer ?? '');
      setReviewNotes(d.stanton_review_notes ?? '');
      const edits: Record<string, string> = {};
      for (const m of d.members) {
        edits[m.id] = m.documented_income != null ? String(m.documented_income) : '';
      }
      setIncomeEdits(edits);
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSaveReview = async () => {
    if (!detail) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const memberIncomeUpdates = detail.members.map((m) => ({
        id: m.id,
        documented_income: incomeEdits[m.id] !== '' ? parseFloat(incomeEdits[m.id]) || null : null,
      }));

      const res = await fetch(`/api/admin/pbv/full-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stanton_review_status: reviewStatus,
          stanton_reviewer: reviewerName.trim() || null,
          stanton_review_notes: reviewNotes.trim() || null,
          member_income_updates: memberIncomeUpdates,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Save failed');
      setSaveMsg('Saved.');
      await fetchDetail();
    } catch (e: any) {
      setSaveMsg(e.message || 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleTemplateUpload = async () => {
    if (!hhaTemplateFile) {
      setTemplateMsg('Choose a .docx template first.');
      return;
    }

    setUploadingTemplate(true);
    setTemplateMsg('');

    try {
      const formData = new FormData();
      formData.append('template', hhaTemplateFile);

      const res = await fetch(`/api/admin/pbv/full-applications/${id}/hha?action=upload-template`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Template upload failed');

      setTemplateMsg('Template uploaded. HHA generation now uses this version.');
      setHhaTemplateFile(null);
    } catch (error: unknown) {
      setTemplateMsg(getErrorMessage(error, 'Template upload failed'));
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleGenerateHha = async () => {
    if (!detail) return;
    setGeneratingHha(true);
    setHhaMsg('');
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${id}/hha`, { method: 'POST' });
      if (res.ok && res.headers.get('content-type')?.includes('wordprocessingml')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        a.download = match?.[1] ?? 'hha_application.docx';
        a.click();
        URL.revokeObjectURL(url);
        setHhaMsg('HHA application downloaded.');
        await fetchDetail();
      } else {
        const json = await res.json();
        throw new Error(json.message || 'Generation failed');
      }
    } catch (e: any) {
      setHhaMsg(e.message || 'Generation failed');
    } finally {
      setGeneratingHha(false);
    }
  };

  const handleExportHach = async () => {
    if (!detail) return;
    setExportingHach(true);
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${id}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'hach_package.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExportingHach(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 text-sm text-[var(--muted)]">Loading...</div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="p-8 text-sm text-[var(--error)]">{fetchError || 'Not found'}</div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const docCounts: Record<string, number> = { approved: 0, submitted: 0, rejected: 0, missing: 0, waived: 0 };
  for (const d of detail.documents) {
    docCounts[d.status] = (docCounts[d.status] ?? 0) + 1;
  }
  const requiredDocs = detail.documents.filter((d) => d.required);
  const allRequiredApproved = requiredDocs.length > 0 && requiredDocs.every(
    (d) => d.status === 'approved' || d.status === 'waived'
  );
  const canGenerateHha = allRequiredApproved && reviewStatus === 'approved';

  const totalClaimed = detail.members.reduce((s, m) => s + (m.annual_income ?? 0), 0);
  const totalDocumented = detail.members.every((m) => incomeEdits[m.id] !== '')
    ? detail.members.reduce((s, m) => {
        const v = parseFloat(incomeEdits[m.id] ?? '');
        return s + (isNaN(v) ? 0 : v);
      }, 0)
    : null;

  const signedCount = detail.members.filter((m) => m.signature_required && m.signed_forms.length > 0).length;
  const sigRequired = detail.members.filter((m) => m.signature_required).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/pbv/full-applications" className="text-[var(--muted)] hover:text-[var(--ink)] underline">
          ← Full Applications
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">
            {detail.head_of_household_name}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {detail.building_address} — Unit {detail.unit_number}
            {detail.bedroom_count ? ` · ${detail.bedroom_count} BR` : ''}
            {' · '}{detail.household_size} person{detail.household_size !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold ${REVIEW_STATUS_COLORS[detail.stanton_review_status] ?? 'bg-gray-100 text-gray-700'}`}>
          {REVIEW_STATUS_LABELS[detail.stanton_review_status] ?? detail.stanton_review_status}
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        {[
          { label: 'Invited', value: fmtDate(detail.created_at) },
          { label: 'Intake Submitted', value: fmtDate(detail.intake_submitted_at) },
          { label: 'Signatures', value: `${signedCount} / ${sigRequired}` },
          { label: 'Docs Approved', value: `${docCounts.approved + docCounts.waived} / ${requiredDocs.length} required` },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-medium mb-1">{item.label}</p>
            <p className="font-semibold text-[var(--ink)]">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Qualification Math Panel */}
      <section className="bg-white border border-[var(--border)] shadow-sm">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Qualification — Income Review
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Enter documented income per member after reviewing submitted paystubs and award letters.
            Delta ≥ 10% is flagged.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--bg-section)]">
                <th className="text-left px-4 py-2 font-medium text-[var(--muted)]">Member</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--muted)]">Relationship</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Claimed</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Documented</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {detail.members.map((m) => {
                const claimed = m.annual_income ?? 0;
                const docVal = incomeEdits[m.id] !== '' ? parseFloat(incomeEdits[m.id] ?? '') : null;
                const documented = !isNaN(docVal as number) ? docVal : null;
                return (
                  <tr key={m.id} className="hover:bg-[var(--bg-section)]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--ink)]">{m.name}</span>
                      {m.age != null && (
                        <span className="text-xs text-[var(--muted)] ml-2">{m.age} yr</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{m.relationship}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink)]">{fmt(claimed)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={incomeEdits[m.id] ?? ''}
                            onChange={(e) =>
                              setIncomeEdits((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            placeholder="—"
                            className="w-28 pl-5 pr-2 py-1.5 border border-[var(--border)] rounded-none text-sm text-right focus:outline-none focus:border-[var(--primary)] bg-white"
                          />
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right text-xs ${deltaClass(claimed, documented)}`}>
                      {deltaLabel(claimed, documented)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--divider)] bg-[var(--bg-section)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-4 py-2 text-right text-sm font-semibold text-[var(--ink)]">
                  {fmt(totalClaimed)}
                </td>
                <td className="px-4 py-2 text-right text-sm font-semibold text-[var(--ink)]">
                  {totalDocumented != null ? fmt(totalDocumented) : '—'}
                </td>
                <td className={`px-4 py-2 text-right text-xs ${deltaClass(totalClaimed, totalDocumented)}`}>
                  {deltaLabel(totalClaimed, totalDocumented)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Flags */}
        {(detail.claiming_medical_deduction || detail.has_childcare_expense || detail.dv_status || detail.homeless_at_admission || detail.reasonable_accommodation_requested) && (
          <div className="px-5 py-3 border-t border-[var(--divider)] flex flex-wrap gap-2">
            {detail.claiming_medical_deduction && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs border border-blue-200">Medical Deduction</span>
            )}
            {detail.has_childcare_expense && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs border border-blue-200">Childcare Expense</span>
            )}
            {detail.dv_status && (
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs border border-purple-200">DV Status</span>
            )}
            {detail.homeless_at_admission && (
              <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs border border-orange-200">Homeless at Admission</span>
            )}
            {detail.reasonable_accommodation_requested && (
              <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs border border-teal-200">Reasonable Accommodation</span>
            )}
          </div>
        )}
      </section>

      {/* Document Status */}
      <section className="bg-white border border-[var(--border)] shadow-sm">
        <div className="px-5 py-3 border-b border-[var(--divider)] flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Documents
          </h2>
          <div className="flex gap-3 text-xs">
            {Object.entries(docCounts).map(([status, count]) =>
              count > 0 ? (
                <span key={status} className={`px-2 py-0.5 font-semibold ${DOC_STATUS_COLORS[status]}`}>
                  {count} {status}
                </span>
              ) : null
            )}
          </div>
        </div>

        {allRequiredApproved && (
          <div className="px-5 py-2 bg-green-50 border-b border-green-100 text-xs text-green-800 font-medium">
            All required documents approved or waived.
          </div>
        )}

        <div className="divide-y divide-[var(--divider)]">
          {detail.documents.map((d) => (
            <div key={d.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                d.status === 'approved' ? 'bg-green-500' :
                d.status === 'submitted' ? 'bg-yellow-500' :
                d.status === 'rejected' ? 'bg-red-500' :
                d.status === 'waived' ? 'bg-indigo-400' :
                'bg-gray-300'
              }`} />
              <span className="flex-1 text-[var(--ink)]">{d.label}</span>
              {d.person_slot > 0 && (
                <span className="text-xs text-[var(--muted)]">P{d.person_slot}</span>
              )}
              {!d.required && (
                <span className="text-xs text-[var(--muted)]">(opt)</span>
              )}
              <span className={`text-xs px-2 py-0.5 font-semibold ${DOC_STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {d.status}
              </span>
            </div>
          ))}
        </div>

        {detail.form_submission_id && (
          <div className="px-5 py-3 border-t border-[var(--divider)]">
            <Link
              href={`/admin/form-submissions/${detail.form_submission_id}`}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
            >
              Open in Per-Document Review →
            </Link>
          </div>
        )}
      </section>

      {/* Stanton Review Panel */}
      <section className="bg-white border border-[var(--border)] shadow-sm">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Stanton Review
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink)] mb-1">Review Status</label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
              >
                {Object.entries(REVIEW_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink)] mb-1">Reviewer</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="Staff name"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink)] mb-1">Review Notes</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes for this application..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white resize-none"
            />
          </div>
          {detail.stanton_review_date && (
            <p className="text-xs text-[var(--muted)]">
              Last reviewed {fmtDate(detail.stanton_review_date)}
              {detail.stanton_reviewer ? ` by ${detail.stanton_reviewer}` : ''}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveReview}
              disabled={saving}
              className="px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Review'}
            </button>
            {saveMsg && (
              <span className="text-xs text-[var(--muted)]">{saveMsg}</span>
            )}
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="bg-white border border-[var(--border)] shadow-sm">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Actions
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 border border-[var(--divider)] bg-[var(--bg-section)] space-y-2">
            <p className="text-xs font-medium text-[var(--ink)] uppercase tracking-wide">HHA Template</p>
            <p className="text-xs text-[var(--muted)]">
              Upload the current HACH HC application `.docx` template. This overwrites the prior template.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setHhaTemplateFile(e.target.files?.[0] ?? null)}
                className="text-xs text-[var(--ink)] file:mr-2 file:px-3 file:py-1.5 file:border file:border-[var(--border)] file:bg-white file:text-[var(--ink)] file:rounded-none"
              />
              <button
                type="button"
                onClick={handleTemplateUpload}
                disabled={!hhaTemplateFile || uploadingTemplate}
                className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium transition-colors hover:bg-white disabled:opacity-50"
              >
                {uploadingTemplate ? 'Uploading...' : 'Upload Template'}
              </button>
            </div>
            {hhaTemplateFile && (
              <p className="text-xs text-[var(--muted)]">Selected: {hhaTemplateFile.name}</p>
            )}
            {templateMsg && (
              <p className="text-xs text-[var(--muted)]">{templateMsg}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-start">
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleGenerateHha}
                disabled={!canGenerateHha || generatingHha}
                className="px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingHha ? 'Generating...' : 'Generate HHA Application'}
              </button>
              {!canGenerateHha && (
                <p className="text-xs text-[var(--muted)]">
                  {!allRequiredApproved
                    ? 'All required documents must be approved or waived.'
                    : 'Review status must be Approved.'}
                </p>
              )}
              {detail.hha_application_file && (
                <p className="text-xs text-green-700">HHA generated. Re-generate to refresh.</p>
              )}
              {hhaMsg && (
                <p className="text-xs text-[var(--muted)]">{hhaMsg}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportHach}
              disabled={exportingHach}
              className="px-5 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium transition-colors hover:bg-[var(--bg-section)] disabled:opacity-50"
            >
              {exportingHach ? 'Exporting...' : 'Download HACH Package'}
            </button>
          </div>

          <div className="pt-2 border-t border-[var(--divider)]">
            <p className="text-xs text-[var(--muted)] mb-1 font-medium">Tenant Magic Link</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--muted)] truncate">{detail.magic_link}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(detail.magic_link)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Household detail */}
      <section className="bg-white border border-[var(--border)] shadow-sm">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Household Members
          </h2>
        </div>
        <div className="divide-y divide-[var(--divider)]">
          {detail.members.map((m) => (
            <div key={m.id} className="px-5 py-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-[var(--ink)]">{m.name}</span>
                  <span className="text-xs text-[var(--muted)] ml-2">
                    {m.relationship} · {m.age ?? '?'} yr
                  </span>
                </div>
                <div className="flex gap-2 items-center text-xs">
                  {m.disability && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600">Disability</span>}
                  {m.student && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600">Student</span>}
                  {m.signature_required && (
                    m.signed_forms.length > 0
                      ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700">Signed</span>
                      : <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700">Sig. Pending</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-[var(--muted)] flex flex-wrap gap-4">
                <span>Citizenship: {m.citizenship_status}</span>
                {m.ssn_last_four && <span>SSN: ···{m.ssn_last_four}</span>}
                {m.income_sources?.length > 0 && <span>Sources: {m.income_sources.join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
