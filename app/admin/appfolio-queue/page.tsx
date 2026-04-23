'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, PawPrint, Car, Shield, HeartHandshake, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import TenantProcessingDrawer from '@/components/compliance/TenantProcessingDrawer';
import Toast from '@/components/kit/Toast';
import { useToast } from '@/lib/useToast';
import { getErrorMessage } from '@/lib/errorMessage';
import { sortBuildingsByAssetId } from '@/lib/buildingAssetIds';
import type { MatrixRow } from '@/types/compliance';

/**
 * A row is outstanding in AppFolio when at least one item is ACTIONABLE for Allan:
 *   - a declared doc has a file on disk that hasn't been uploaded yet (not: "declared but no file" — that's lobby's problem)
 *   - pet rent not yet loaded (lease-wide — charge is due any time a pet is verified)
 *   - parking fee not yet loaded AND the tenant actually picked up the permit
 *   - permit was issued but not yet recorded in AppFolio
 *   - pickup ID photo captured but not yet uploaded
 *
 * NOTE: don't use the compliance-column registry's isComplete for fees here —
 * that filter is "what must happen for a tenant to be permit-ready," not
 * "what's actionable right now in AppFolio." They differ for tenants who have
 * a vehicle but never picked up a permit (no billable parking fee until pickup).
 */
function hasPendingAppfolioWork(row: MatrixRow): boolean {
  if (row.missing) return false;
  if (row.permit_revoked) return false;

  // Gate: no files on disk at all means lobby hasn't finished intake for this tenant.
  // Allan has nothing to download or upload. Don't pull them into the AppFolio queue;
  // they need to be resolved in the lobby flow first.
  const hasAnyFileOnDisk =
    !!row.pet_addendum_file ||
    !!row.vehicle_addendum_file ||
    !!row.insurance_file ||
    !!row.esa_doc_file ||
    !!row.pickup_id_photo;
  if (!hasAnyFileOnDisk) return false;

  // Documents with file on disk ready for AppFolio upload
  if (row.has_pets && row.pet_addendum_file && !row.pet_addendum_uploaded_to_appfolio) return true;
  if (row.has_vehicle && row.vehicle_addendum_file && !row.vehicle_addendum_uploaded_to_appfolio) return true;
  if (row.has_insurance && row.insurance_file && !row.insurance_uploaded_to_appfolio) return true;
  if (row.has_esa_doc && row.esa_doc_file && !row.esa_doc_uploaded_to_appfolio) return true;

  // Pickup ID photo (exists only if permit was actually picked up at lobby)
  if (row.pickup_id_photo && !row.pickup_id_uploaded_to_appfolio) return true;

  // Permit record entry — only meaningful once the permit was issued
  if (row.permit_issued && !row.permit_entered_in_appfolio) return true;

  // Fees
  if (row.has_pets && !row.pet_fee_added_to_appfolio) return true;
  if (row.tenant_picked_up && !row.permit_fee_added_to_appfolio) return true;

  return false;
}

/** Per-domain pending counts across the whole project queue */
interface DomainBreakdown {
  petsDocs: number;
  petsFees: number;
  vehicleDocs: number;
  vehicleFees: number;
  permitEntries: number;
  pickupIds: number;
  insurance: number;
  exemption: number;
}

function computeBreakdown(rows: MatrixRow[]): DomainBreakdown {
  const b: DomainBreakdown = {
    petsDocs: 0, petsFees: 0, vehicleDocs: 0, vehicleFees: 0,
    permitEntries: 0, pickupIds: 0, insurance: 0, exemption: 0,
  };
  for (const r of rows) {
    if (r.has_pets && r.pet_addendum_file && !r.pet_addendum_uploaded_to_appfolio) b.petsDocs++;
    if (r.has_pets && !r.pet_fee_added_to_appfolio) b.petsFees++;
    if (r.has_vehicle && r.vehicle_addendum_file && !r.vehicle_addendum_uploaded_to_appfolio) b.vehicleDocs++;
    if (r.tenant_picked_up && !r.permit_fee_added_to_appfolio) b.vehicleFees++;
    if (r.permit_issued && !r.permit_entered_in_appfolio) b.permitEntries++;
    if (r.pickup_id_photo && !r.pickup_id_uploaded_to_appfolio) b.pickupIds++;
    if (r.has_insurance && r.insurance_file && !r.insurance_uploaded_to_appfolio) b.insurance++;
    if (r.has_esa_doc && r.esa_doc_file && !r.esa_doc_uploaded_to_appfolio) b.exemption++;
  }
  return b;
}

/** Inline status summary for a row, shown in the backlog list */
function rowDomainBadges(row: MatrixRow): string[] {
  const badges: string[] = [];
  const petPending =
    (row.has_pets && row.pet_addendum_file && !row.pet_addendum_uploaded_to_appfolio) ||
    (row.has_pets && !row.pet_fee_added_to_appfolio);
  if (petPending) badges.push('Pets');
  const vehiclePending =
    (row.has_vehicle && row.vehicle_addendum_file && !row.vehicle_addendum_uploaded_to_appfolio) ||
    (row.permit_issued && !row.permit_entered_in_appfolio) ||
    (row.pickup_id_photo && !row.pickup_id_uploaded_to_appfolio) ||
    (row.tenant_picked_up && !row.permit_fee_added_to_appfolio);
  if (vehiclePending) badges.push('Vehicle & Parking');
  if (row.has_insurance && row.insurance_file && !row.insurance_uploaded_to_appfolio) badges.push('Insurance');
  if (row.has_esa_doc && row.esa_doc_file && !row.esa_doc_uploaded_to_appfolio) badges.push('Exemption');
  return badges;
}

export default function AppFolioSyncPage() {
  const [buildings, setBuildings] = useState<string[]>([]);
  const [rowsByBuilding, setRowsByBuilding] = useState<Record<string, MatrixRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toasts, showToast, dismissToast } = useToast();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const buildingsRes = await fetch('/api/admin/buildings');
      const buildingsJson = await buildingsRes.json();
      if (!buildingsJson.success) {
        throw new Error(buildingsJson.message || 'Failed to load buildings');
      }
      const list: string[] = buildingsJson.data || [];
      const sorted = sortBuildingsByAssetId(list);
      setBuildings(sorted);

      const results = await Promise.all(
        sorted.map(async (b): Promise<[string, MatrixRow[]]> => {
          try {
            const res = await fetch(
              `/api/admin/compliance/building-matrix?building=${encodeURIComponent(b)}`
            );
            const json = await res.json();
            if (!json.success) return [b, []];
            return [b, (json.rows as MatrixRow[]) || []];
          } catch {
            return [b, []];
          }
        })
      );

      const map: Record<string, MatrixRow[]> = {};
      for (const [b, rows] of results) map[b] = rows;
      setRowsByBuilding(map);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /**
   * Flat ordered list of pending rows for prev/next traversal.
   * Grouped by building, same order as the backlog list below.
   */
  const pendingFlat = useMemo(() => {
    const out: MatrixRow[] = [];
    for (const b of buildings) {
      const rows = (rowsByBuilding[b] || []).filter(hasPendingAppfolioWork);
      for (const r of rows) out.push(r);
    }
    return out;
  }, [buildings, rowsByBuilding]);

  const pendingByBuilding = useMemo(() => {
    const out: Array<{ building: string; rows: MatrixRow[] }> = [];
    for (const b of buildings) {
      const rows = (rowsByBuilding[b] || []).filter(hasPendingAppfolioWork);
      if (rows.length > 0) out.push({ building: b, rows });
    }
    return out;
  }, [buildings, rowsByBuilding]);

  const totalPending = pendingFlat.length;
  const breakdown = useMemo(() => computeBreakdown(pendingFlat), [pendingFlat]);

  // If the drawer is open and the row at activeIndex disappears (after mark-synced),
  // advance to the next pending; close if none left.
  useEffect(() => {
    if (activeIndex === null) return;
    if (activeIndex >= pendingFlat.length) {
      if (pendingFlat.length === 0) setActiveIndex(null);
      else setActiveIndex(pendingFlat.length - 1);
    }
  }, [pendingFlat, activeIndex]);

  const activeRow = activeIndex !== null ? pendingFlat[activeIndex] : null;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeader
        title="AppFolio Sync"
        subtitle="Tenants with documents or charges still outstanding in AppFolio — Permit Campaign."
        breadcrumbs={[{ label: 'Home', href: '/admin/home' }, { label: 'AppFolio Sync' }]}
        actions={
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        }
        meta={
          !loading && (
            <div className="text-xs text-[var(--muted)]">
              {totalPending === 0
                ? 'All clear — nothing outstanding in AppFolio for this project.'
                : `${totalPending} tenant${totalPending === 1 ? '' : 's'} across ${pendingByBuilding.length} building${pendingByBuilding.length === 1 ? '' : 's'} outstanding.`}
            </div>
          )
        }
      />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/40 text-[var(--error)] text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button type="button" onClick={() => setError(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {loading && (
          <div className="p-6 text-center text-[var(--muted)] bg-white border border-[var(--divider)]">
            Loading buildings…
          </div>
        )}

        {!loading && totalPending > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DomainCard icon={PawPrint} label="Pet addendums" value={breakdown.petsDocs} sub={`+ ${breakdown.petsFees} pet rent`} />
            <DomainCard icon={Car} label="Vehicle docs" value={breakdown.vehicleDocs} sub={`+ ${breakdown.vehicleFees} parking fee · ${breakdown.permitEntries} permit · ${breakdown.pickupIds} ID`} />
            <DomainCard icon={Shield} label="Insurance" value={breakdown.insurance} sub="policies to upload" />
            <DomainCard icon={HeartHandshake} label="Exemption" value={breakdown.exemption} sub="ESA docs to upload" />
          </section>
        )}

        {!loading && totalPending === 0 && (
          <div className="p-8 text-center bg-white border border-[var(--divider)]">
            <div className="text-3xl mb-2">✓</div>
            <div className="text-sm text-[var(--muted)]">
              Nothing outstanding — every document and charge is in AppFolio for this project.
            </div>
          </div>
        )}

        {!loading &&
          pendingByBuilding.map(({ building, rows }) => {
            const buildingStartIndex = pendingFlat.findIndex(
              (r) => r.building_address === building && r.submission_id === rows[0]?.submission_id
            );
            return (
              <section key={building}>
                <h2 className="font-serif text-lg text-[var(--primary)] mb-2">
                  {building}{' '}
                  <span className="text-sm text-[var(--muted)] font-sans">
                    ({rows.length} tenant{rows.length === 1 ? '' : 's'})
                  </span>
                </h2>
                <ul className="bg-white border border-[var(--divider)] divide-y divide-[var(--divider)]">
                  {rows.map((row, i) => {
                    const badges = rowDomainBadges(row);
                    const flatIndex = buildingStartIndex >= 0 ? buildingStartIndex + i : -1;
                    return (
                      <li key={row.submission_id || `${row.building_address}-${row.unit_number}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (flatIndex >= 0) setActiveIndex(flatIndex);
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--bg-section)] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[var(--ink)] truncate">
                              {row.full_name || <span className="text-[var(--muted)]">No name</span>}
                              <span className="text-[var(--muted)]"> · Unit {row.unit_number}</span>
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-0.5 flex items-center flex-wrap gap-1.5">
                              {badges.length > 0
                                ? badges.map((b) => (
                                    <span
                                      key={b}
                                      className="px-1.5 py-0.5 bg-[var(--bg-section)] border border-[var(--divider)] text-[var(--muted)] rounded-none"
                                    >
                                      {b}
                                    </span>
                                  ))
                                : <span>No outstanding items</span>}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </div>

      {activeRow && activeIndex !== null && (
        <TenantProcessingDrawer
          row={activeRow}
          position={{ index: activeIndex, total: pendingFlat.length }}
          onClose={() => setActiveIndex(null)}
          onPrev={() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setActiveIndex((i) => (i !== null && i < pendingFlat.length - 1 ? i + 1 : i))}
          onAfterSave={loadAll}
          onToast={showToast}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function DomainCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof PawPrint;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-[var(--border)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[var(--muted)]" />
        <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-2xl font-serif text-[var(--primary)]">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-0.5 truncate" title={sub}>{sub}</div>
    </div>
  );
}
