'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ReviewDoc {
  id: string;
  form_id: string;
  language: string;
  status: string;
  generated_at: string | null;
  viewerUrl: string | null;
  validation: null | { pass: boolean; flags: { field: string; page: number; reason: string }[] };
}

interface ReviewData {
  application: {
    id: string;
    head_of_household_name: string;
    household_size: number;
    language: string;
    intake_status: string;
    stage: string;
  };
  documents: ReviewDoc[];
  packageRevision: string;
  approved: boolean;
  latestDecision: null | {
    status: 'approved' | 'held';
    package_revision: string;
    approved_by_name: string | null;
    approved_at: string;
    note: string | null;
    staleForCurrentPackage: boolean;
  };
  canApprove: boolean;
}

export default function PreSendReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'hold' | null>(null);
  const [toast, setToast] = useState('');
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pbv/applications/${id}/review`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to load review');
      setData(json.data);
      setActiveDoc((prev) => prev ?? json.data.documents[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (action: 'approve' | 'hold') => {
      setBusy(action);
      setError('');
      try {
        const res = await fetch(`/api/admin/pbv/applications/${id}/review/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note.trim() || undefined }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? `${action} failed`);
        setToast(json.message ?? 'Done');
        window.setTimeout(() => setToast(''), 4000);
        setNote('');
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : `${action} failed`);
      } finally {
        setBusy(null);
      }
    },
    [id, note, load]
  );

  const active = data?.documents.find((d) => d.id === activeDoc) ?? null;

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-5 px-6 py-6">
      <div className="text-sm">
        <Link href={`/admin/pbv/pipeline/${id}`} className="text-[var(--primary)] hover:underline">
          ← Back to application
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-serif text-[var(--primary)]">Pre-send document review</h1>
        {data && (
          <p className="text-sm text-[var(--muted)]">
            {data.application.head_of_household_name} · HH {data.application.household_size} ·{' '}
            {data.application.language.toUpperCase()} · {data.documents.length} documents
          </p>
        )}
      </header>

      {error && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {loading && <div className="text-sm text-[var(--muted)]">Loading review…</div>}

      {data && (
        <>
          {/* Approval status banner */}
          <div
            className={`border px-4 py-3 text-sm ${
              data.approved
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {data.approved ? (
              <span>
                ✓ Approved at the current package revision
                {data.latestDecision?.approved_by_name ? ` by ${data.latestDecision.approved_by_name}` : ''} — the
                signing handoff has been (or can be) sent.
              </span>
            ) : data.latestDecision?.status === 'held' ? (
              <span>Held{data.latestDecision.note ? `: “${data.latestDecision.note}”` : ''} — nothing sent.</span>
            ) : data.latestDecision?.staleForCurrentPackage ? (
              <span>
                A prior approval no longer matches — the documents were regenerated. Re-review and approve to
                release the new package.
              </span>
            ) : (
              <span>Not yet reviewed. Nothing is sent to the applicant until you Approve &amp; send.</span>
            )}
            <span className="ml-2 font-mono text-xs opacity-60">rev {data.packageRevision.slice(0, 12) || '—'}</span>
          </div>

          <div className="grid grid-cols-[280px_1fr] gap-4">
            {/* Document list */}
            <div className="flex flex-col gap-1 border border-[var(--border)] bg-white p-2">
              {data.documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDoc(doc.id)}
                  className={`flex flex-col items-start gap-0.5 border-l-4 px-3 py-2 text-left text-sm ${
                    activeDoc === doc.id
                      ? 'border-[var(--primary)] bg-[var(--bg-section)]'
                      : 'border-transparent hover:bg-[var(--bg-section)]'
                  }`}
                >
                  <span className="font-medium text-[var(--ink)]">{doc.form_id}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {doc.language.toUpperCase()} · {doc.status}
                    {doc.validation && !doc.validation.pass ? ' · ⚠ flagged' : ''}
                  </span>
                </button>
              ))}
              {data.documents.length === 0 && (
                <span className="px-3 py-2 text-xs text-[var(--muted)]">No generated documents.</span>
              )}
            </div>

            {/* Viewer */}
            <div className="min-h-[640px] border border-[var(--border)] bg-white">
              {active?.viewerUrl ? (
                <iframe
                  key={active.id}
                  src={active.viewerUrl}
                  title={active.form_id}
                  className="h-[720px] w-full"
                />
              ) : (
                <div className="p-12 text-center text-sm text-[var(--muted)]">
                  {active ? 'No rendered PDF available for this document yet.' : 'Select a document.'}
                </div>
              )}
              {active?.validation && !active.validation.pass && (
                <div className="border-t border-[var(--border)] bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>Validation flags:</strong>
                  <ul className="mt-1 list-disc pl-5">
                    {active.validation.flags.map((f, i) => (
                      <li key={i}>
                        {f.field} (p{f.page}): {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 border border-[var(--border)] bg-white p-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (required reading for a Hold — what needs fixing)…"
              rows={2}
              className="w-full border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!data.canApprove || busy !== null || data.documents.length === 0}
                onClick={() => act('approve')}
                className="bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                title={data.canApprove ? 'Approve and send the signing handoff' : 'You do not have permission to approve'}
              >
                {busy === 'approve' ? 'Approving…' : 'Approve & send'}
              </button>
              <button
                type="button"
                disabled={!data.canApprove || busy !== null}
                onClick={() => act('hold')}
                className="border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg-section)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'hold' ? 'Holding…' : 'Hold / needs fix'}
              </button>
              {!data.canApprove && (
                <span className="text-xs text-[var(--muted)]">You do not have approval permission.</span>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-30 bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
