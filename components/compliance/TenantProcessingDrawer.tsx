'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  X,
  Download,
  ExternalLink,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PawPrint,
  Car,
  Shield,
  HeartHandshake,
  IdCard,
} from 'lucide-react';
import type { MatrixRow } from '@/types/compliance';
import { getErrorMessage } from '@/lib/errorMessage';

interface TenantProcessingDrawerProps {
  row: MatrixRow;
  position: { index: number; total: number };
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onAfterSave: () => void;
  onToast?: (message: string, onUndo?: () => void) => void;
}

type PendingKind =
  | 'pet_addendum'
  | 'vehicle_addendum'
  | 'insurance'
  | 'exemption_document'
  | 'pickup_id'
  | 'pet_fee'
  | 'permit_fee';

interface ItemStatus {
  done: boolean;
  label: string;
  sublabel?: string | null;
  filePath?: string | null;
  /** True when something upstream is missing and staff can't action this row yet. */
  blocked?: boolean;
}

function itemForDoc(
  file: string | null,
  uploaded: boolean,
  at: string | null,
  by: string | null,
  docLabel: string,
): ItemStatus {
  if (!file) {
    return {
      done: false,
      label: `${docLabel} — missing file`,
      sublabel: 'Lobby needs to upload a signed copy first',
      blocked: true,
    };
  }
  if (uploaded) {
    const parts = [by, at && new Date(at).toLocaleDateString()].filter(Boolean);
    return {
      done: true,
      label: `${docLabel} uploaded`,
      sublabel: parts.length > 0 ? parts.join(' · ') : null,
      filePath: file,
    };
  }
  return { done: false, label: `${docLabel} ready to upload`, filePath: file };
}

export default function TenantProcessingDrawer({
  row,
  position,
  onClose,
  onPrev,
  onNext,
  onAfterSave,
  onToast,
}: TenantProcessingDrawerProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only prefill from what was actually recorded at intake.
  // If the lobby didn't capture an amount, leave blank — Allan needs to check the form.
  const [petFeeAmount, setPetFeeAmount] = useState<string>(
    row.pet_fee_amount != null ? String(row.pet_fee_amount) : ''
  );
  const [permitFeeAmount, setPermitFeeAmount] = useState<string>(
    row.permit_fee_amount != null ? String(row.permit_fee_amount) : ''
  );

  // Reset fee inputs when row changes
  useEffect(() => {
    setPetFeeAmount(row.pet_fee_amount != null ? String(row.pet_fee_amount) : '');
    setPermitFeeAmount(row.permit_fee_amount != null ? String(row.permit_fee_amount) : '');
    setError(null);
  }, [row.submission_id, row.pet_fee_amount, row.permit_fee_amount]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && (e.altKey || e.metaKey)) onPrev();
      else if (e.key === 'ArrowRight' && (e.altKey || e.metaKey)) onNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  // Pending item counts per domain
  const pets = useMemo(() => {
    if (!row.has_pets) return null;
    const addendum = itemForDoc(
      row.pet_addendum_file,
      row.pet_addendum_uploaded_to_appfolio,
      row.pet_addendum_uploaded_to_appfolio_at,
      row.pet_addendum_uploaded_to_appfolio_by,
      'Pet addendum',
    );
    const feeDone = row.pet_fee_added_to_appfolio;
    return { addendum, feeDone };
  }, [row]);

  const vehicle = useMemo(() => {
    if (!row.has_vehicle && !row.requires_parking_permit && !row.permit_issued) return null;
    const addendum = row.has_vehicle
      ? itemForDoc(
          row.vehicle_addendum_file,
          row.vehicle_addendum_uploaded_to_appfolio,
          row.vehicle_addendum_uploaded_to_appfolio_at,
          row.vehicle_addendum_uploaded_to_appfolio_by,
          'Parking agreement',
        )
      : null;
    const pickupId = row.pickup_id_photo
      ? itemForDoc(
          row.pickup_id_photo,
          row.pickup_id_uploaded_to_appfolio,
          row.pickup_id_uploaded_to_appfolio_at,
          row.pickup_id_uploaded_to_appfolio_by,
          'Pickup ID photo',
        )
      : null;
    const feeDone = row.tenant_picked_up ? row.permit_fee_added_to_appfolio : null; // null = N/A
    return { addendum, pickupId, feeDone };
  }, [row]);

  const insurance = useMemo(() => {
    if (!row.has_insurance) return null;
    return itemForDoc(
      row.insurance_file,
      row.insurance_uploaded_to_appfolio,
      row.insurance_uploaded_to_appfolio_at,
      row.insurance_uploaded_to_appfolio_by,
      'Insurance policy',
    );
  }, [row]);

  const exemption = useMemo(() => {
    if (!row.has_esa_doc || !row.esa_doc_file) return null;
    return itemForDoc(
      row.esa_doc_file,
      row.esa_doc_uploaded_to_appfolio,
      row.esa_doc_uploaded_to_appfolio_at,
      row.esa_doc_uploaded_to_appfolio_by,
      'Exemption document',
    );
  }, [row]);

  const pendingCount = useMemo(() => {
    let n = 0;
    if (pets?.addendum && !pets.addendum.done && pets.addendum.filePath) n++;
    if (pets && !pets.feeDone && row.has_pets) n++;
    if (vehicle?.addendum && !vehicle.addendum.done && vehicle.addendum.filePath) n++;
    if (vehicle?.pickupId && !vehicle.pickupId.done && vehicle.pickupId.filePath) n++;
    if (vehicle?.feeDone === false) n++;
    if (insurance && !insurance.done && insurance.filePath) n++;
    if (exemption && !exemption.done && exemption.filePath) n++;
    return n;
  }, [pets, vehicle, insurance, exemption, row.has_pets]);

  // Actions
  const handleDownloadAll = useCallback(async () => {
    if (!row.submission_id) return;
    setBusy('download');
    try {
      const res = await fetch('/api/admin/compliance/download-documents-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: row.submission_id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Download failed');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const fallback = `${(row.full_name || 'tenant').replace(/\s+/g, '_')}_Unit_${row.unit_number}.zip`;
      const filename = match?.[1] || fallback;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getErrorMessage(e, 'Download failed'));
    } finally {
      setBusy(null);
    }
  }, [row.submission_id, row.full_name, row.unit_number]);

  const markDocUploaded = useCallback(async (documentType: PendingKind) => {
    if (!row.submission_id) return;
    setBusy(documentType);
    try {
      const res = await fetch('/api/admin/compliance/mark-appfolio-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: row.submission_id, documentType }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAfterSave();
      onToast?.('Marked uploaded');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to mark uploaded'));
    } finally {
      setBusy(null);
    }
  }, [row.submission_id, onAfterSave, onToast]);

  const markPickupIdUploaded = useCallback(async () => {
    if (!row.submission_id) return;
    setBusy('pickup_id');
    try {
      const res = await fetch('/api/admin/compliance/mark-pickup-id-uploaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: row.submission_id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAfterSave();
      onToast?.('Pickup ID marked uploaded');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to mark uploaded'));
    } finally {
      setBusy(null);
    }
  }, [row.submission_id, onAfterSave, onToast]);

  const markFee = useCallback(async (feeType: 'pet_rent' | 'permit_fee', amount: string) => {
    if (!row.submission_id) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) {
      setError('Enter a valid amount first');
      return;
    }
    setBusy(feeType);
    try {
      const res = await fetch('/api/admin/compliance/mark-fee-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: row.submission_id, feeType, amount: parsed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAfterSave();
      onToast?.('Fee marked added');
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to mark fee added'));
    } finally {
      setBusy(null);
    }
  }, [row.submission_id, onAfterSave, onToast]);

  const markTenantSynced = useCallback(async () => {
    if (!row.submission_id) return;
    setBusy('sync-all');
    try {
      const body: Record<string, unknown> = { submissionId: row.submission_id };
      if (row.has_pets && !row.pet_fee_added_to_appfolio && petFeeAmount) {
        body.petFeeAmount = parseFloat(petFeeAmount);
      }
      if (row.tenant_picked_up && !row.permit_fee_added_to_appfolio && permitFeeAmount) {
        body.permitFeeAmount = parseFloat(permitFeeAmount);
      }
      const res = await fetch('/api/admin/compliance/mark-tenant-synced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAfterSave();
      onToast?.(`Tenant synced — ${json.flipped?.length || 0} item(s) marked done`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to sync tenant'));
    } finally {
      setBusy(null);
    }
  }, [row, petFeeAmount, permitFeeAmount, onAfterSave, onToast]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="w-full max-w-xl h-full bg-white shadow-xl border-l border-[var(--border)] flex flex-col">
        {/* Header */}
        <header className="px-5 py-4 border-b border-[var(--divider)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[var(--muted)] mb-0.5">
                Tenant {position.index + 1} of {position.total}
              </div>
              <h2 className="font-serif text-xl text-[var(--ink)] truncate">
                {row.full_name || <span className="text-[var(--muted)]">No name on file</span>}
              </h2>
              <div className="text-sm text-[var(--muted)] truncate">
                Unit {row.unit_number} · {row.building_address}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={busy === 'download'}
              className="h-8 px-2.5 text-xs border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {busy === 'download' ? 'Preparing…' : 'Download all docs'}
            </button>
            <div className="ml-auto text-xs text-[var(--muted)]">
              {pendingCount === 0 ? (
                <span className="text-[var(--success)] inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All synced
                </span>
              ) : (
                <span>{pendingCount} pending</span>
              )}
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {row.permit_revoked && (
            <div className="p-2.5 bg-[var(--error)]/10 border border-[var(--error)]/40 text-xs text-[var(--error)] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Permit revoked{row.permit_revoked_reason ? ` (${row.permit_revoked_reason.replace('_', ' ')})` : ''}.
                Handle the move-out flow before syncing.
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-[var(--error)]/10 border border-[var(--error)]/40 text-xs text-[var(--error)] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
              <button type="button" onClick={() => setError(null)} className="underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Pets */}
          {pets && (
            <DomainSection icon={PawPrint} title="Pets" summary={row.pet_summary}>
              {pets.addendum && (
                <ChecklistItem
                  status={pets.addendum}
                  actionLabel="Mark uploaded"
                  busy={busy === 'pet_addendum'}
                  onAction={() => markDocUploaded('pet_addendum')}
                />
              )}
              {row.has_pets && (
                <FeeLineItem
                  label="Pet rent"
                  amount={petFeeAmount}
                  onAmountChange={setPetFeeAmount}
                  loaded={row.pet_fee_added_to_appfolio}
                  loadedBy={row.pet_fee_added_to_appfolio_by}
                  loadedAt={row.pet_fee_added_to_appfolio_at}
                  recordedAtIntake={row.pet_fee_amount != null}
                  busy={busy === 'pet_rent'}
                  onMark={() => markFee('pet_rent', petFeeAmount)}
                />
              )}
            </DomainSection>
          )}

          {/* Vehicle & Parking */}
          {vehicle && (row.has_vehicle || row.permit_issued) && (
            <DomainSection icon={Car} title="Vehicle & Parking" summary={row.vehicle_summary}>
              <div
                className={`px-3 py-2 border rounded-none flex items-center gap-2 text-sm ${
                  row.tenant_picked_up
                    ? 'border-[var(--success)]/40 bg-[var(--success)]/5'
                    : 'border-[var(--border)] bg-[var(--bg-section)]'
                }`}
              >
                {row.tenant_picked_up ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0" />
                ) : (
                  <Car className="w-5 h-5 text-[var(--muted)] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={row.tenant_picked_up ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}>
                    {row.tenant_picked_up
                      ? 'Permit picked up: YES — Charge parking fee'
                      : 'Permit picked up: NO — Do not charge parking fee'}
                  </div>
                  {row.tenant_picked_up && row.tenant_picked_up_at && (
                    <div className="text-xs text-[var(--muted)] truncate">
                      {new Date(row.tenant_picked_up_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              {vehicle.addendum && (
                <ChecklistItem
                  status={vehicle.addendum}
                  actionLabel="Mark uploaded"
                  busy={busy === 'vehicle_addendum'}
                  onAction={() => markDocUploaded('vehicle_addendum')}
                />
              )}
              {vehicle.pickupId && (
                <ChecklistItem
                  icon={IdCard}
                  status={vehicle.pickupId}
                  actionLabel="Mark uploaded"
                  busy={busy === 'pickup_id'}
                  onAction={markPickupIdUploaded}
                />
              )}
              {row.tenant_picked_up && (
                <FeeLineItem
                  label="Parking fee"
                  amount={permitFeeAmount}
                  onAmountChange={setPermitFeeAmount}
                  loaded={row.permit_fee_added_to_appfolio}
                  loadedBy={row.permit_fee_added_to_appfolio_by}
                  loadedAt={row.permit_fee_added_to_appfolio_at}
                  recordedAtIntake={row.permit_fee_amount != null}
                  busy={busy === 'permit_fee'}
                  onMark={() => markFee('permit_fee', permitFeeAmount)}
                />
              )}
            </DomainSection>
          )}

          {/* Insurance */}
          {insurance && (
            <DomainSection icon={Shield} title="Insurance" summary={row.insurance_summary}>
              <ChecklistItem
                status={insurance}
                actionLabel="Mark uploaded"
                busy={busy === 'insurance'}
                onAction={() => markDocUploaded('insurance')}
              />
              {!row.insurance_verified && (
                <div className="px-3 py-2 bg-[var(--warning)]/5 border border-[var(--warning)]/40 text-xs text-[var(--warning)]">
                  Insurance not yet verified in lobby. Sync to AppFolio anyway if desired.
                </div>
              )}
            </DomainSection>
          )}

          {/* Exemption */}
          {exemption && (
            <DomainSection icon={HeartHandshake} title="Exemption (ESA)" summary={null}>
              <ChecklistItem
                status={exemption}
                actionLabel="Mark uploaded"
                busy={busy === 'exemption_document'}
                onAction={() => markDocUploaded('exemption_document')}
              />
            </DomainSection>
          )}

          {!pets && !vehicle && !insurance && !exemption && (
            <div className="text-center py-6 text-sm text-[var(--muted)]">
              Nothing tracked for this tenant. Move on.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-[var(--divider)] bg-[var(--bg-section)] flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={position.index === 0}
            className="px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-none hover:bg-white transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={position.index >= position.total - 1}
            className="px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-none hover:bg-white transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={markTenantSynced}
            disabled={busy === 'sync-all' || pendingCount === 0 || row.permit_revoked}
            className="px-4 py-1.5 text-sm bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            title={pendingCount === 0 ? 'Nothing pending' : 'Flip every applicable flag to done'}
          >
            <CheckCircle2 className="w-4 h-4" />
            {busy === 'sync-all' ? 'Syncing…' : 'Mark tenant synced'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ----- Subcomponents -----

function DomainSection({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: typeof PawPrint;
  title: string;
  summary: string | null;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <Icon className="w-4 h-4 text-[var(--primary)] translate-y-0.5" />
        <h3 className="font-serif text-base text-[var(--primary)]">{title}</h3>
        {summary && <span className="text-xs text-[var(--muted)]">— {summary}</span>}
      </div>
      <div className="space-y-1.5 [counter-reset:step]">{children}</div>
    </section>
  );
}

function ChecklistItem({
  icon: Icon,
  status,
  actionLabel,
  busy,
  onAction,
}: {
  icon?: typeof PawPrint;
  status: ItemStatus;
  actionLabel: string;
  busy: boolean;
  onAction: () => void;
}) {
  const blocked = !!status.blocked;
  const actionable = !status.done && !blocked;

  const containerClass = status.done
    ? 'border-[var(--success)]/40 bg-[var(--success)]/5'
    : blocked
    ? 'border-[var(--error)]/40 bg-[var(--error)]/5'
    : 'border-[var(--border)] bg-white';

  const indicator = status.done ? (
    <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
  ) : blocked ? (
    <AlertTriangle className="w-5 h-5 text-[var(--error)]" />
  ) : (
    <span
      aria-hidden
      className="w-5 h-5 inline-flex items-center justify-center text-[11px] font-semibold border border-[var(--border)] bg-[var(--bg-section)] text-[var(--ink)] before:content-[counter(step)]"
    />
  );

  return (
    <div className={`px-3 py-2 border rounded-none flex items-center gap-2 text-sm [counter-increment:step] ${containerClass}`}>
      {actionable ? (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          aria-label={actionLabel}
          className="shrink-0 -m-1 p-1 rounded-none hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
        >
          {indicator}
        </button>
      ) : (
        <div className="shrink-0">{indicator}</div>
      )}
      {Icon && <Icon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className={`truncate ${status.done ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
          {status.label}
        </div>
        {status.sublabel && (
          <div className="text-xs text-[var(--muted)] truncate">{status.sublabel}</div>
        )}
      </div>
      {status.filePath && (
        <a
          href={`/api/admin/file?path=${encodeURIComponent(status.filePath)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-2.5 text-xs border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          View
        </a>
      )}
      {actionable && (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="h-8 px-2.5 text-xs bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50 inline-flex items-center"
        >
          {busy ? '…' : actionLabel}
        </button>
      )}
    </div>
  );
}

function FeeLineItem({
  label,
  amount,
  onAmountChange,
  loaded,
  loadedBy,
  loadedAt,
  recordedAtIntake,
  busy,
  onMark,
}: {
  label: string;
  amount: string;
  onAmountChange: (v: string) => void;
  loaded: boolean;
  loadedBy: string | null;
  loadedAt: string | null;
  /** Was an amount captured at lobby intake? If false and not loaded, Allan needs to check the form. */
  recordedAtIntake: boolean;
  busy: boolean;
  onMark: () => void;
}) {
  const needsLookup = !loaded && !recordedAtIntake;

  return (
    <div
      className={`px-3 py-2 border rounded-none flex items-center gap-2 text-sm [counter-increment:step] ${
        loaded
          ? 'border-[var(--success)]/40 bg-[var(--success)]/5'
          : 'border-[var(--border)] bg-white'
      }`}
    >
      <div className="shrink-0">
        {loaded ? (
          <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
        ) : (
          <span
            aria-hidden
            className="w-5 h-5 inline-flex items-center justify-center text-[11px] font-semibold border border-[var(--border)] bg-[var(--bg-section)] text-[var(--ink)] before:content-[counter(step)]"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={loaded ? 'text-[var(--muted)]' : 'text-[var(--ink)]'}>
          {label}{loaded && amount ? ` — $${parseFloat(amount).toFixed(2)}` : ''}
        </div>
        {loaded && (
          <div className="text-xs text-[var(--muted)] truncate">
            {[loadedBy, loadedAt && new Date(loadedAt).toLocaleDateString()].filter(Boolean).join(' · ') || 'Marked'}
          </div>
        )}
        {needsLookup && (
          <div className="text-xs text-[var(--muted)] mt-0.5">
            Amount not recorded at intake — check the lobby form.
          </div>
        )}
      </div>
      {!loaded && (
        <>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-[var(--muted)]">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder=""
              className="h-8 w-16 px-2 text-xs leading-none border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            type="button"
            onClick={onMark}
            disabled={busy || !amount}
            className="h-8 px-2.5 text-xs bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50 inline-flex items-center"
          >
            {busy ? '…' : 'Mark added'}
          </button>
        </>
      )}
    </div>
  );
}
