'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { sortBuildingsByAssetId, buildingToAssetId } from '@/lib/buildingAssetIds';
import { buildingToPortfolio, portfolioOrder } from '@/lib/portfolios';
import { buildingUnits } from '@/lib/buildings';
import { normalizeAddress, filterByBuilding, unitsMatch } from '@/lib/addressNormalizer';
import { groupDuplicateSubmissions, SubmissionGroup } from '@/lib/duplicateDetection';
import ParkingManagementPanel from '@/components/ParkingManagementPanel';
import DuplicateSubmissionAccordion from '@/components/DuplicateSubmissionAccordion';
import VehicleExportCenter from '@/components/VehicleExportCenter';
import AddTenantModal from '@/components/AddTenantModal';
import SubmissionEditModal from '@/components/SubmissionEditModal';
import { BuildingHeader, BuildingMatrixTable, countRowsWithActions, BulkActionsBar, ComplianceTabs, MatrixFilterBar, applyMatrixFilters, PortfolioTable, TenantSidePanel } from '@/components/compliance';
import Toast from '@/components/kit/Toast';
import type { ToastItem } from '@/components/kit/Toast';
import type { ComplianceTab, MatrixFilter } from '@/components/compliance';
import type { MatrixRow, BuildingMatrixResponse, BuildingMatrixStats, PortfolioBuildingStats } from '@/types/compliance';

interface TenantSubmission {
  id: string;
  full_name: string;
  unit_number: string;
  phone: string;
  email: string;
  building_address: string;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_verified: boolean;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  vehicle_addendum_file?: string;
  vehicle_addendum_file_uploaded_at?: string;
  vehicle_addendum_file_uploaded_by?: string;
  vehicle_submitted_by_phone?: boolean;
  vehicle_phone_submission_date?: string;
  vehicle_phone_submission_by?: string;
  vehicle_exported?: boolean;
  vehicle_exported_at?: string;
  vehicle_exported_by?: string;
  permit_issued: boolean;
  permit_issued_at?: string;
  permit_issued_by?: string;
  tenant_picked_up: boolean;
  tenant_picked_up_at?: string;
  has_pets: boolean;
  pets?: any;
  pet_verified: boolean;
  pet_signature?: string;
  pet_signature_date?: string;
  pet_addendum_file?: string;
  pet_addendum_received?: boolean;
  pet_addendum_received_by?: string;
  vehicle_addendum_received?: boolean;
  vehicle_addendum_received_by?: string;
  exemption_status?: string;
  exemption_reason?: string;
  exemption_documents?: string[];
  pickup_id_photo?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiration_date?: string;
  insurance_file?: string;
  insurance_type?: string;
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  insurance_authorization_signature?: string;
  add_insurance_to_rent?: boolean;
  vehicle_notes?: string;
  pet_notes?: string;
  insurance_notes?: string;
  admin_notes?: string;
  ready_for_review: boolean;
  reviewed_for_permit: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  merged_into?: string;
  is_primary?: boolean;
  duplicate_group_id?: string;
  additional_vehicles?: Array<{
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number | string;
    vehicle_color: string;
    vehicle_plate: string;
    requested_at?: string;
  }>;
  additional_vehicle_approved?: boolean;
  additional_vehicle_denied?: boolean;
}

interface BuildingTenantData {
  building_address_normalized: string;
  building_address_original: string;
  occupied_units: Array<{
    unit_number: string;
    tenant_name: string;
    email?: string;
    phone?: string;
    building_address: string;
  }>;
  occupied_count: number;
}

interface BuildingStats {
  totalUnits: number;
  occupiedUnits: number;
  submissionCount: number;
  percentComplete: number;
  missingUnits: string[];
  missingSubmissions: Array<{ unit: string; tenant: any }>;
  vacantUnits: number;
}

export default function CompliancePage() {
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('all');
  const [buildingSearch, setBuildingSearch] = useState<string>('');
  const [quickLookupQuery, setQuickLookupQuery] = useState<string>('');
  const [quickLookupResults, setQuickLookupResults] = useState<TenantSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TenantSubmission[]>([]);
  const [buildingStats, setBuildingStats] = useState<Record<string, BuildingStats>>({});
  const [submissions, setSubmissions] = useState<TenantSubmission[]>([]);
  const [tenantData, setTenantData] = useState<BuildingTenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<TenantSubmission | null>(null);

  // Phase 1 redesign state
  const [activeTab, setActiveTab] = useState<ComplianceTab>('tenants');
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [matrixStats, setMatrixStats] = useState<BuildingMatrixStats | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const [sidePanelSubmission, setSidePanelSubmission] = useState<any | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<SubmissionGroup[]>([]);
  const [similarityThreshold] = useState(85);

  // Phase 3 state — bulk selection + filters
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<MatrixFilter>>(new Set());

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, onUndo, variant: 'success' as const }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (editingSubmission) {
      const refreshed = allSubmissions.find(s => s.id === editingSubmission.id);
      if (refreshed && refreshed !== editingSubmission) setEditingSubmission(refreshed);
    }
  }, [allSubmissions]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search name"]') as HTMLInputElement;
        searchInput?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      if (e.key === 'Escape' && quickLookupQuery) {
        setQuickLookupQuery('');
        setQuickLookupResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [quickLookupQuery]);

  useEffect(() => {
    setSelectedIds(new Set());
    setActiveFilters(new Set());
    if (selectedBuilding) {
      fetchMatrix();
      loadBuildingSubmissions();
    }
  }, [selectedBuilding]);

  useEffect(() => {
    if (submissions.length > 0) {
      setDuplicateGroups(groupDuplicateSubmissions(submissions, similarityThreshold));
    } else {
      setDuplicateGroups([]);
    }
  }, [submissions, similarityThreshold]);

  useEffect(() => {
    if (quickLookupQuery.trim().length < 2) { setQuickLookupResults([]); return; }
    const timer = setTimeout(() => {
      const q = quickLookupQuery.toLowerCase();
      const results = allSubmissions.filter(sub =>
        sub.full_name?.toLowerCase().includes(q) ||
        sub.building_address?.toLowerCase().includes(q) ||
        sub.unit_number?.toLowerCase().includes(q) ||
        sub.phone?.includes(q) ||
        sub.email?.toLowerCase().includes(q)
      );
      setQuickLookupResults(results.slice(0, 10));
    }, 300);
    return () => clearTimeout(timer);
  }, [quickLookupQuery, allSubmissions]);

  useEffect(() => {
    if (selectedRow && selectedRow.submission_id && !selectedRow.missing) {
      setSidePanelSubmission(allSubmissions.find(s => s.id === selectedRow.submission_id) || null);
    } else {
      setSidePanelSubmission(null);
    }
  }, [selectedRow, allSubmissions]);

  const fetchMatrix = async () => {
    if (!selectedBuilding) return;
    setMatrixLoading(true);
    try {
      const res = await fetch(`/api/admin/compliance/building-matrix?building=${encodeURIComponent(selectedBuilding)}`);
      const data: BuildingMatrixResponse = await res.json();
      if (data.success) { setMatrixRows(data.rows); setMatrixStats(data.stats); }
    } catch (error) {
      console.error('Failed to fetch building matrix:', error);
    } finally {
      setMatrixLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const submissionsResponse = await fetch('/api/admin/submissions');
      const submissionsResult = await submissionsResponse.json();
      if (!submissionsResult.success) throw new Error(submissionsResult.message);
      const subs: TenantSubmission[] = submissionsResult.data || [];
      setAllSubmissions(subs);

      const tenantResponse = await fetch('/api/admin/compliance/tenant-data');
      const tenantDataResult = await tenantResponse.json();
      const tenantDataList: BuildingTenantData[] = tenantDataResult.success ? tenantDataResult.data : [];
      setTenantData(tenantDataList);

      const stats: Record<string, BuildingStats> = {};
      const buildingList = Object.keys(buildingUnits);
      buildingList.forEach(building => {
        const units = buildingUnits[building] || [];
        const buildingSubs = filterByBuilding(subs, building);
        const normalizedBuilding = normalizeAddress(building);
        const buildingTenants = tenantDataList.find(td => td.building_address_normalized === normalizedBuilding);
        const occupiedUnits = (buildingTenants?.occupied_units || []) as Array<{
          unit_number: string; tenant_name: string; email?: string; phone?: string; building_address: string;
        }>;
        const missingSubmissions = occupiedUnits
          .filter((tenant: any) => !buildingSubs.some(sub => unitsMatch(sub.unit_number, tenant.unit_number)))
          .map((tenant: any) => ({ unit: tenant.unit_number, tenant }))
          .sort((a, b) => {
            const aR = a.unit.toLowerCase().includes('retail');
            const bR = b.unit.toLowerCase().includes('retail');
            if (aR && !bR) return -1;
            if (!aR && bR) return 1;
            return parseInt(a.unit.match(/\d+/)?.[0] || '999') - parseInt(b.unit.match(/\d+/)?.[0] || '999');
          });
        const vacantCount = units.length - occupiedUnits.length;
        stats[building] = {
          totalUnits: units.length,
          occupiedUnits: occupiedUnits.length,
          submissionCount: buildingSubs.length,
          percentComplete: occupiedUnits.length > 0 ? Math.round((buildingSubs.length / occupiedUnits.length) * 100) : 0,
          missingUnits: units.filter(u => !buildingSubs.some(sub => unitsMatch(sub.unit_number, u))),
          missingSubmissions,
          vacantUnits: vacantCount > 0 ? vacantCount : 0,
        };
      });
      setBuildingStats(stats);
      const sortedBuildings = sortBuildingsByAssetId(buildingList);
      setBuildings(sortedBuildings);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuildingSubmissions = () => {
    let buildingSubs = filterByBuilding(allSubmissions, selectedBuilding);
    buildingSubs = buildingSubs.filter(sub => !sub.merged_into);
    setSubmissions(buildingSubs);
  };

  const handleRefreshAll = useCallback(() => {
    fetchData();
    fetchMatrix();
  }, [selectedBuilding]);

  const handleMergeSubmissions = async (primaryId: string, duplicateIds: string[]) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryId, duplicateIds, mergeStrategy: 'keep_newest' }),
    });
    const data = await response.json();
    if (response.ok) { await handleRefreshAll(); } else { throw new Error(data.message || 'Failed to merge'); }
  };

  const handleMarkPrimary = async (submissionId: string, groupId: string) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, groupId, action: 'mark_primary' }),
    });
    if (response.ok) await handleRefreshAll();
  };

  const handleDismissDuplicate = async (groupId: string, duplicateId: string) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: duplicateId, groupId, action: 'dismiss' }),
    });
    if (response.ok) await handleRefreshAll();
  };

  const portfolioStats = useMemo(() => {
    return portfolioOrder.map(portfolio => {
      const blds = buildings.filter(b => buildingToPortfolio[b] === portfolio);
      const totalUnits = blds.reduce((s, b) => s + (buildingStats[b]?.totalUnits || 0), 0);
      const occupiedUnits = blds.reduce((s, b) => s + (buildingStats[b]?.occupiedUnits || 0), 0);
      const totalSubmissions = blds.reduce((s, b) => s + (buildingStats[b]?.submissionCount || 0), 0);
      return { name: portfolio, buildingCount: blds.length, totalUnits, occupiedUnits, totalSubmissions };
    });
  }, [allSubmissions, buildings, buildingStats]);

  const portfolioBuildingStats = useMemo((): PortfolioBuildingStats[] => {
    return buildings.map(building => {
      const subs = filterByBuilding(allSubmissions, building).filter(s => !s.merged_into);
      const stats = buildingStats[building];
      const occupied = stats?.occupiedUnits || 0;

      const withVehicle = subs.filter(s => s.has_vehicle);
      const withPets = subs.filter(s => s.has_pets);
      const withInsurance = subs.filter(s => s.has_insurance);

      const vehicleDocsUploaded = subs.filter((s: any) => s.has_vehicle && s.vehicle_addendum_uploaded_to_appfolio).length;
      const petDocsUploaded = subs.filter((s: any) => s.has_pets && s.pet_addendum_uploaded_to_appfolio).length;
      const insuranceUploaded = subs.filter((s: any) => s.has_insurance && s.insurance_uploaded_to_appfolio).length;
      const petFeesLoaded = subs.filter((s: any) => s.has_pets && s.pet_fee_added_to_appfolio).length;
      const permitFeesLoaded = subs.filter((s: any) => s.has_vehicle && s.permit_fee_added_to_appfolio).length;
      const permitsIssued = subs.filter(s => s.has_vehicle && s.permit_issued).length;

      // Compute overall completion score (average of all applicable fractions)
      const fractions: number[] = [];
      if (occupied > 0) fractions.push(subs.length / occupied);
      if (withVehicle.length > 0) fractions.push(vehicleDocsUploaded / withVehicle.length);
      if (withPets.length > 0) fractions.push(petDocsUploaded / withPets.length);
      if (withInsurance.length > 0) fractions.push(insuranceUploaded / withInsurance.length);
      if (withPets.length > 0) fractions.push(petFeesLoaded / withPets.length);
      if (withVehicle.length > 0) fractions.push(permitFeesLoaded / withVehicle.length);
      if (withVehicle.length > 0) fractions.push(permitsIssued / withVehicle.length);
      const completionScore = fractions.length > 0
        ? Math.round((fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100)
        : 0;

      return {
        building_address: building,
        asset_id: buildingToAssetId[building] || '',
        portfolio: buildingToPortfolio[building] || '',
        total_units: stats?.totalUnits || 0,
        occupied_units: occupied,
        submissions: subs.length,
        vehicle_docs_uploaded: vehicleDocsUploaded,
        vehicle_docs_total: withVehicle.length,
        pet_docs_uploaded: petDocsUploaded,
        pet_docs_total: withPets.length,
        insurance_uploaded: insuranceUploaded,
        insurance_total: withInsurance.length,
        pet_fees_loaded: petFeesLoaded,
        pet_fees_total: withPets.length,
        permit_fees_loaded: permitFeesLoaded,
        permit_fees_total: withVehicle.length,
        permits_issued: permitsIssued,
        permits_total: withVehicle.length,
        completion_score: completionScore,
      };
    });
  }, [buildings, allSubmissions, buildingStats]);

  const filteredBuildings = buildings.filter(building => {
    const matchesSearch = building.toLowerCase().includes(buildingSearch.toLowerCase());
    const matchesPortfolio = selectedPortfolio === 'all' || buildingToPortfolio[building] === selectedPortfolio;
    return matchesSearch && matchesPortfolio;
  });

  const filteredMatrixRows = useMemo(() => applyMatrixFilters(matrixRows, activeFilters), [matrixRows, activeFilters]);
  const missingSubmissions = useMemo(() => matrixRows.filter(r => r.missing), [matrixRows]);

  const handleToggleFilter = useCallback((filter: MatrixFilter) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter); else next.add(filter);
      return next;
    });
  }, []);

  const ui = {
    page: 'min-h-screen bg-[var(--paper)] text-[var(--ink)]',
    panelSoft: 'bg-[var(--bg-section)] border border-[var(--divider)]',
    title: 'font-serif text-[var(--primary)]',
    input: 'w-full px-3 py-2 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out',
    primaryButton: 'px-3 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
    secondaryButton: 'px-3 py-2 bg-white text-[var(--primary)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-[var(--muted)]">Loading compliance data...</div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      {/* Header */}
      <div className="bg-white border-b border-[var(--divider)] shadow-sm">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className={`text-3xl ${ui.title}`}>Compliance Dashboard</h1>
              <p className="text-sm text-[var(--muted)] mt-1 tracking-wide">Building-by-building review and verification</p>
            </div>
            <div className="flex gap-3 flex-1 justify-center">
              {portfolioStats.map(stat => (
                <div key={stat.name} className="px-3 py-2 bg-[var(--bg-section)] border border-[var(--divider)]">
                  <div className="text-xs font-semibold text-[var(--primary)]">{stat.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{stat.buildingCount} {stat.buildingCount === 1 ? 'bldg' : 'bldgs'}</div>
                  <div className="text-xs text-[var(--ink)] mt-0.5 font-medium">
                    {stat.totalUnits} units | {stat.occupiedUnits} occ | {stat.totalSubmissions} sub
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <a href="/admin" className={ui.secondaryButton}>Back</a>
              <a href="/admin?view=onboarding" className={ui.secondaryButton}>Raw Data</a>
              <button onClick={() => setShowExportCenter(true)} className={ui.primaryButton}>Export Center</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-0' : 'w-72'} bg-white border-r border-[var(--divider)] overflow-y-auto transition-all duration-300 flex-shrink-0`}>
          <div className={`${sidebarCollapsed ? 'hidden' : 'block'} p-4 space-y-4`}>
            {/* Quick Lookup */}
            <div className={`${ui.panelSoft} p-3`}>
              <div className="flex items-center justify-between mb-3 border-b border-[var(--divider)] pb-2">
                <h3 className="text-sm font-semibold text-[var(--primary)]">Quick Tenant Lookup</h3>
                <span className="text-xs text-[var(--muted)]">Ctrl+K</span>
              </div>
              <input
                type="text"
                placeholder="Search name, unit, phone..."
                value={quickLookupQuery}
                onChange={(e) => setQuickLookupQuery(e.target.value)}
                className={ui.input}
              />
              {quickLookupResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {quickLookupResults.map(result => (
                    <div
                      key={result.id}
                      onClick={() => {
                        setSelectedBuilding(result.building_address);
                        setQuickLookupQuery('');
                        setQuickLookupResults([]);
                      }}
                      className="p-2 bg-white border border-[var(--divider)] cursor-pointer hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                    >
                      <div className="text-xs font-medium text-[var(--ink)]">{result.full_name}</div>
                      <div className="text-xs text-[var(--muted)]">{result.building_address} - Unit {result.unit_number}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portfolio Filter */}
            <div className={`${ui.panelSoft} p-3`}>
              <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Portfolio</h3>
              <select
                value={selectedPortfolio}
                onChange={(e) => setSelectedPortfolio(e.target.value)}
                className={ui.input}
              >
                <option value="all">All Portfolios</option>
                {portfolioOrder.map(portfolio => (
                  <option key={portfolio} value={portfolio}>{portfolio}</option>
                ))}
              </select>
            </div>

            {/* Building List */}
            <div className={`${ui.panelSoft} p-3`}>
              <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Buildings</h3>
              <input
                type="text"
                placeholder="Filter buildings..."
                value={buildingSearch}
                onChange={(e) => setBuildingSearch(e.target.value)}
                className={`${ui.input} mb-3`}
              />
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredBuildings.map(building => {
                  const stats = buildingStats[building] || { totalUnits: 0, occupiedUnits: 0, submissionCount: 0, percentComplete: 0, missingUnits: [], missingSubmissions: [], vacantUnits: 0 };
                  const assetId = buildingToAssetId[building] || '';
                  const icon = stats.percentComplete === 100 ? '\u2705' : stats.percentComplete > 0 ? '\uD83D\uDFE1' : '\u26AA';
                  return (
                    <button
                      key={building}
                      onClick={() => setSelectedBuilding(building)}
                      className={`w-full text-left px-3 py-2 text-xs border transition-colors duration-200 ease-out ${
                        selectedBuilding === building
                          ? 'bg-[var(--bg-section)] border-[var(--primary)] text-[var(--primary)]'
                          : 'bg-white border-[var(--divider)] hover:bg-[var(--bg-section)]'
                      }`}
                    >
                      <div className="font-medium">{icon} {assetId} - {building}</div>
                      <div className="text-[var(--muted)] mt-1">
                        {stats.totalUnits} units | {stats.occupiedUnits} occ | {stats.submissionCount} sub ({stats.percentComplete}%)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filters — visible when a building is selected */}
            {selectedBuilding && !matrixLoading && matrixRows.length > 0 && (
              <div className={`${ui.panelSoft} p-3`}>
                <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Filters</h3>
                <MatrixFilterBar
                  activeFilters={activeFilters}
                  onToggleFilter={handleToggleFilter}
                  onClearFilters={() => setActiveFilters(new Set())}
                  rows={matrixRows}
                />
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 relative">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-4 left-4 z-10 p-2 bg-white border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out shadow-sm"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>

          {/* Portfolio table (default landing — no building selected) */}
          {!selectedBuilding && (
            <div className="max-w-7xl mx-auto space-y-6 pt-2">
              <div>
                <h2 className="text-2xl font-serif text-[var(--primary)]">All Buildings</h2>
                <p className="text-sm text-[var(--muted)] mt-1">Click a building to open the detail view. Sorted by completion — least complete first.</p>
              </div>
              <PortfolioTable
                rows={portfolioBuildingStats}
                selectedPortfolio={selectedPortfolio}
                onSelectBuilding={setSelectedBuilding}
              />
            </div>
          )}

          {/* Building view (selected building) */}
          {selectedBuilding && (
            <div className="max-w-7xl mx-auto space-y-6">
              <button
                onClick={() => setSelectedBuilding('')}
                className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] hover:underline transition-colors duration-200 ease-out font-medium"
              >
                &larr; All Buildings
              </button>

              {matrixStats && (
                <BuildingHeader
                  buildingAddress={selectedBuilding}
                  stats={matrixStats}
                  onAddTenant={() => setShowAddTenant(true)}
                />
              )}

              <ComplianceTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                actionCount={countRowsWithActions(matrixRows)}
                missingCount={missingSubmissions.length}
                duplicateCount={duplicateGroups.length}
              />

              {activeTab === 'tenants' && (
                <div className="space-y-3">
                  <BulkActionsBar
                    selectedIds={selectedIds}
                    rows={matrixRows}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onRefresh={handleRefreshAll}
                  />

                  {matrixLoading ? (
                    <div className="p-8 text-center text-[var(--muted)]">Loading building matrix...</div>
                  ) : (
                    <BuildingMatrixTable
                      rows={filteredMatrixRows}
                      onSelectTenant={(row) => setSelectedRow(row)}
                      onRefresh={handleRefreshAll}
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      onToast={showToast}
                    />
                  )}

                  {activeFilters.size > 0 && (
                    <div className="text-xs text-[var(--muted)]">
                      Showing {filteredMatrixRows.length} of {matrixRows.length} rows
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'parking' && (
                <ParkingManagementPanel buildingAddress={selectedBuilding} onRefresh={handleRefreshAll} />
              )}

              {activeTab === 'duplicates' && (
                <div className="space-y-4">
                  {duplicateGroups.length === 0 ? (
                    <div className="p-8 text-center text-[var(--muted)] bg-white border border-[var(--border)]">
                      No duplicate submissions detected for this building.
                    </div>
                  ) : (
                    duplicateGroups.map(group => (
                      <DuplicateSubmissionAccordion
                        key={group.id}
                        group={group}
                        onMerge={handleMergeSubmissions}
                        onMarkPrimary={handleMarkPrimary}
                        onDismiss={handleDismissDuplicate}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'missing' && (
                <div>
                  {missingSubmissions.length === 0 ? (
                    <div className="p-8 text-center text-[var(--success)] bg-white border border-[var(--border)]">
                      All occupied units have submissions.
                    </div>
                  ) : (
                    <div className="bg-white border border-[var(--border)]">
                      <div className="px-4 py-3 bg-[var(--error)]/10 border-b border-[var(--error)]/35">
                        <div className="text-sm font-semibold text-[var(--error)]">
                          {missingSubmissions.length} occupied unit{missingSubmissions.length !== 1 ? 's' : ''} without submissions
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
                        {missingSubmissions.map((row) => (
                          <div key={row.unit_number} className="p-3 border border-[var(--error)]/25 bg-white">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-semibold text-sm text-[var(--error)]">Unit {row.unit_number}</div>
                              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20">Missing</span>
                            </div>
                            <div className="text-sm text-[var(--ink)]">{row.tenant_lookup_name || '\u2014'}</div>
                            {row.email && <div className="text-xs text-[var(--muted)] mt-0.5 truncate">{row.email}</div>}
                            {row.phone && <div className="text-xs text-[var(--muted)]">{row.phone}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedRow && (
        <TenantSidePanel
          row={selectedRow}
          submission={sidePanelSubmission}
          onClose={() => setSelectedRow(null)}
          onRefresh={handleRefreshAll}
          onEditSubmission={(sub) => setEditingSubmission(sub)}
        />
      )}

      {showExportCenter && (
        <VehicleExportCenter
          allSubmissions={allSubmissions}
          buildings={buildings}
          onClose={() => setShowExportCenter(false)}
          onExportComplete={() => handleRefreshAll()}
        />
      )}

      {editingSubmission && (
        <SubmissionEditModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => handleRefreshAll()}
        />
      )}

      <AddTenantModal
        isOpen={showAddTenant}
        onClose={() => setShowAddTenant(false)}
        onSuccess={() => handleRefreshAll()}
        prefilledBuilding={selectedBuilding}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
