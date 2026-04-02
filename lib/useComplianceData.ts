'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { sortBuildingsByAssetId, buildingToAssetId } from '@/lib/buildingAssetIds';
import { buildingToPortfolio, portfolioOrder } from '@/lib/portfolios';
import { buildingUnits } from '@/lib/buildings';
import { normalizeAddress, filterByBuilding, unitsMatch } from '@/lib/addressNormalizer';
import { groupDuplicateSubmissions } from '@/lib/duplicateDetection';
import type { SubmissionGroup } from '@/lib/duplicateDetection';
import { computeColumnStats, computeCompletionScore } from '@/lib/complianceColumns';
import type { ComplianceRecord } from '@/lib/complianceColumns';
import { getBuildingRequirements } from '@/lib/buildingRequirements';
import { applyMatrixFilters } from '@/components/compliance/MatrixFilterBar';
import type {
  TenantSubmission,
  BuildingTenantData,
  BuildingStats,
  MatrixRow,
  BuildingMatrixResponse,
  BuildingMatrixStats,
  PortfolioBuildingStats,
  DynamicColumn,
  ProjectMatrixRow,
  ProjectBuildingStats,
} from '@/types/compliance';

export interface PortfolioStat {
  name: string;
  buildingCount: number;
  totalUnits: number;
  occupiedUnits: number;
  totalSubmissions: number;
}

export interface ComplianceData {
  // Mode
  mode: 'legacy' | 'project';

  // Core data
  loading: boolean;
  buildings: string[];
  allSubmissions: TenantSubmission[];
  buildingStats: Record<string, BuildingStats>;

  // Selected building state
  selectedBuilding: string;
  setSelectedBuilding: (b: string) => void;
  matrixRows: MatrixRow[];
  matrixStats: BuildingMatrixStats | null;
  matrixLoading: boolean;
  submissions: TenantSubmission[];
  duplicateGroups: SubmissionGroup[];
  pendingParkingRequests: number;
  parkingExpanded: boolean;
  setParkingExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Side panel
  selectedRow: MatrixRow | null;
  setSelectedRow: (r: MatrixRow | null) => void;
  sidePanelSubmission: TenantSubmission | null;

  // Bulk selection + filters
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  activeFilters: Set<string>;
  setActiveFilters: (f: Set<string>) => void;
  handleToggleFilter: (filter: string) => void;

  // Computed
  portfolioStats: PortfolioStat[];
  portfolioBuildingStats: PortfolioBuildingStats[];
  filteredMatrixRows: MatrixRow[];
  missingSubmissions: MatrixRow[];

  // Actions
  handleRefreshAll: () => void;
  handleMergeSubmissions: (primaryId: string, duplicateIds: string[]) => Promise<void>;
  handleMarkPrimary: (submissionId: string, groupId: string) => Promise<void>;
  handleDismissDuplicate: (groupId: string, duplicateId: string) => Promise<void>;

  // Project mode
  projectColumns: DynamicColumn[];
  projectRows: ProjectMatrixRow[];
  filteredProjectRows: ProjectMatrixRow[];
  projectBuildingStats: ProjectBuildingStats[];
  projectBuildings: string[];
  projectName: string | null;
  handleStaffComplete: (unitId: string, taskId: string) => Promise<void>;
  handleStaffUncomplete: (unitId: string, taskId: string) => Promise<void>;
}

export function useComplianceData(selectedProject: string = 'legacy'): ComplianceData {
  const mode: 'legacy' | 'project' = selectedProject === 'legacy' ? 'legacy' : 'project';
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuildingRaw] = useState<string>('');
  const [allSubmissions, setAllSubmissions] = useState<TenantSubmission[]>([]);
  const [buildingStats, setBuildingStats] = useState<Record<string, BuildingStats>>({});
  const [submissions, setSubmissions] = useState<TenantSubmission[]>([]);
  const [tenantData, setTenantData] = useState<BuildingTenantData[]>([]);
  const [loading, setLoading] = useState(true);

  // Matrix state
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);
  const [matrixStats, setMatrixStats] = useState<BuildingMatrixStats | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<SubmissionGroup[]>([]);
  const [pendingParkingRequests, setPendingParkingRequests] = useState(0);
  const [parkingExpanded, setParkingExpanded] = useState(false);

  // Side panel
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const [sidePanelSubmission, setSidePanelSubmission] = useState<TenantSubmission | null>(null);

  // Bulk selection + filters
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const similarityThreshold = 85;

  // Project mode state
  const [projectColumns, setProjectColumns] = useState<DynamicColumn[]>([]);
  const [projectRows, setProjectRows] = useState<ProjectMatrixRow[]>([]);
  const [projectBuildings, setProjectBuildings] = useState<string[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Fetchers
  // -----------------------------------------------------------------------

  const fetchProjectData = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const [projectRes, unitsRes] = await Promise.all([
        fetch(`/api/admin/projects/${projectId}`),
        fetch(`/api/admin/projects/${projectId}/units`),
      ]);

      const projectJson = await projectRes.json();
      const unitsJson = await unitsRes.json();

      if (!projectJson.success || !unitsJson.success) {
        console.error('Failed to fetch project data');
        return;
      }

      const project = projectJson.data;
      setProjectName(project.name);

      // Build dynamic columns from project_tasks
      const tasks = project.tasks || [];
      const cols: DynamicColumn[] = tasks.map((t: any) => ({
        id: t.id,
        label: t.task_type?.name || 'Unknown',
        assignee: (t.task_type?.assignee || 'tenant') as 'tenant' | 'staff',
        evidence_type: t.task_type?.evidence_type || 'acknowledgment',
        required: t.required !== false,
        order_index: t.order_index,
      }));
      setProjectColumns(cols);

      // Build matrix rows from units
      const units = unitsJson.data || [];
      const rows: ProjectMatrixRow[] = units.map((u: any) => {
        const completions: ProjectMatrixRow['completions'] = {};
        const tc = u.task_completions || [];
        for (const c of tc) {
          completions[c.project_task_id] = {
            status: c.status || 'pending',
            completed_at: c.completed_at,
            completed_by: c.completed_by,
            evidence_url: c.evidence_url,
          };
        }
        return {
          unit_id: u.id,
          unit_number: u.unit_number,
          building: u.building,
          tenant_name: u.tenant_name || null,
          overall_status: u.overall_status || 'not_started',
          completions,
          submission_data: u.submission_data || null,
        };
      });
      setProjectRows(rows);

      // Derive building list
      const bldgSet = new Set(rows.map((r: ProjectMatrixRow) => r.building));
      const bldgs = Array.from(bldgSet).sort();
      setProjectBuildings(bldgs);
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMatrix = useCallback(async (building: string) => {
    if (!building) return;
    setMatrixLoading(true);
    setParkingExpanded(false);
    try {
      const [matrixRes, parkingRes] = await Promise.all([
        fetch(`/api/admin/compliance/building-matrix?building=${encodeURIComponent(building)}`),
        fetch(`/api/admin/compliance/parking-availability?building=${encodeURIComponent(building)}`).catch(() => null),
      ]);
      const data: BuildingMatrixResponse = await matrixRes.json();
      if (data.success) { setMatrixRows(data.rows); setMatrixStats(data.stats); }

      if (parkingRes) {
        const parkingData = await parkingRes.json();
        const pending = parkingData.success ? (parkingData.requests || []).filter((r: any) => !r.approved && !r.denied).length : 0;
        setPendingParkingRequests(pending);
      } else {
        setPendingParkingRequests(0);
      }
    } catch (error) {
      console.error('Failed to fetch building matrix:', error);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
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
  }, []);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  // Initial load — legacy fetches always run (portfolio stats, sidebar building list)
  useEffect(() => { fetchData(); }, [fetchData]);

  // Project mode fetch
  useEffect(() => {
    if (mode === 'project') {
      fetchProjectData(selectedProject);
    } else if (projectColumns.length > 0 || projectRows.length > 0 || projectBuildings.length > 0 || projectName !== null) {
      setProjectColumns([]);
      setProjectRows([]);
      setProjectBuildings([]);
      setProjectName(null);
    }
  }, [selectedProject, mode, fetchProjectData]);

  // When building changes, reset bulk state and fetch matrix
  useEffect(() => {
    setSelectedIds(new Set());
    setActiveFilters(new Set());
    if (selectedBuilding) {
      fetchMatrix(selectedBuilding);
      // Load building-specific submissions
      let buildingSubs = filterByBuilding(allSubmissions, selectedBuilding);
      buildingSubs = buildingSubs.filter(sub => !sub.merged_into);
      setSubmissions(buildingSubs);
    }
  }, [selectedBuilding]); // eslint-disable-line react-hooks/exhaustive-deps

  // Duplicate detection
  useEffect(() => {
    if (submissions.length > 0) {
      setDuplicateGroups(groupDuplicateSubmissions(submissions, similarityThreshold));
    } else {
      setDuplicateGroups([]);
    }
  }, [submissions]);

  // Side panel submission sync
  useEffect(() => {
    if (selectedRow && selectedRow.submission_id && !selectedRow.missing) {
      setSidePanelSubmission(
        (allSubmissions.find(s => s.id === selectedRow.submission_id) as TenantSubmission) || null
      );
    } else {
      setSidePanelSubmission(null);
    }
  }, [selectedRow, allSubmissions]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRefreshAll = useCallback(() => {
    fetchData();
    if (mode === 'project') {
      fetchProjectData(selectedProject);
    } else if (selectedBuilding) {
      fetchMatrix(selectedBuilding);
    }
  }, [selectedBuilding, fetchData, fetchMatrix, mode, selectedProject, fetchProjectData]);

  const handleStaffComplete = useCallback(async (unitId: string, taskId: string) => {
    if (mode !== 'project') return;
    const res = await fetch(`/api/admin/projects/${selectedProject}/units/${unitId}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      fetchProjectData(selectedProject);
    }
  }, [mode, selectedProject, fetchProjectData]);

  const handleStaffUncomplete = useCallback(async (unitId: string, taskId: string) => {
    if (mode !== 'project') return;
    const res = await fetch(`/api/admin/projects/${selectedProject}/units/${unitId}/tasks/${taskId}/complete`, {
      method: 'DELETE',
    });
    if (res.ok) {
      fetchProjectData(selectedProject);
    }
  }, [mode, selectedProject, fetchProjectData]);

  const handleMergeSubmissions = useCallback(async (primaryId: string, duplicateIds: string[]) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primaryId, duplicateIds, mergeStrategy: 'keep_newest' }),
    });
    const data = await response.json();
    if (response.ok) { handleRefreshAll(); } else { throw new Error(data.message || 'Failed to merge'); }
  }, [handleRefreshAll]);

  const handleMarkPrimary = useCallback(async (submissionId: string, groupId: string) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, groupId, action: 'mark_primary' }),
    });
    if (response.ok) handleRefreshAll();
  }, [handleRefreshAll]);

  const handleDismissDuplicate = useCallback(async (groupId: string, duplicateId: string) => {
    const response = await fetch('/api/admin/compliance/merge-submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: duplicateId, groupId, action: 'dismiss' }),
    });
    if (response.ok) handleRefreshAll();
  }, [handleRefreshAll]);

  const setSelectedBuilding = useCallback((b: string) => {
    setSelectedBuildingRaw(b);
  }, []);

  const handleToggleFilter = useCallback((filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter); else next.add(filter);
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Memos
  // -----------------------------------------------------------------------

  const portfolioStats = useMemo<PortfolioStat[]>(() => {
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
      const reqs = getBuildingRequirements(building);

      const records: ComplianceRecord[] = subs.map(s => {
        const exemptionDocs = Array.isArray(s.exemption_documents)
          ? s.exemption_documents.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0)
          : [];
        const hasEsaDoc =
          (s.exemption_reason ?? null) === 'emotional_support'
          || exemptionDocs.length > 0
          || (s.esa_doc_uploaded_to_appfolio ?? false);

        return {
          has_vehicle: s.has_vehicle,
          has_pets: s.has_pets,
          has_insurance: s.has_insurance || reqs.requires_renters_insurance,
          has_esa_doc: hasEsaDoc,
          requires_parking_permit: reqs.requires_parking_permit && s.has_vehicle,
          vehicle_addendum_file: s.vehicle_addendum_file ?? null,
          vehicle_addendum_uploaded_to_appfolio: s.vehicle_addendum_uploaded_to_appfolio ?? false,
          pet_addendum_file: s.pet_addendum_file ?? null,
          pet_addendum_uploaded_to_appfolio: s.pet_addendum_uploaded_to_appfolio ?? false,
          insurance_file: s.insurance_file ?? null,
          insurance_uploaded_to_appfolio: s.insurance_uploaded_to_appfolio ?? false,
          esa_doc_file: exemptionDocs[0] ?? null,
          esa_doc_uploaded_to_appfolio: s.esa_doc_uploaded_to_appfolio ?? false,
          pet_fee_added_to_appfolio: s.pet_fee_added_to_appfolio ?? false,
          permit_fee_added_to_appfolio: s.permit_fee_added_to_appfolio ?? false,
          permit_issued: s.permit_issued,
          insurance_verified: s.insurance_verified ?? false,
          calculated_pet_fee: null,
          calculated_permit_fee: null,
        };
      });

      const columns = computeColumnStats(records);

      const unprocessedNotes = subs.filter(s => s.lobby_notes && !s.lobby_notes_processed).length;

      return {
        building_address: building,
        asset_id: buildingToAssetId[building] || '',
        portfolio: buildingToPortfolio[building] || '',
        total_units: stats?.totalUnits || 0,
        occupied_units: occupied,
        submissions: subs.length,
        columns,
        completion_score: computeCompletionScore({ num: subs.length, den: occupied }, columns),
        unprocessed_notes_count: unprocessedNotes,
      };
    });
  }, [buildings, allSubmissions, buildingStats]);

  const filteredMatrixRows = useMemo(() => applyMatrixFilters(matrixRows, activeFilters), [matrixRows, activeFilters]);
  const missingSubmissions = useMemo(() => matrixRows.filter((r: MatrixRow) => r.missing), [matrixRows]);

  // Project mode: filter rows by selected building + active filters
  const filteredProjectRows = useMemo(() => {
    let rows = projectRows;
    if (selectedBuilding) {
      rows = rows.filter(r => r.building === selectedBuilding);
    }
    if (activeFilters.size > 0) {
      rows = rows.filter(row => {
        for (const fId of activeFilters) {
          const comp = row.completions[fId];
          const status = comp?.status || 'pending';
          if (status !== 'complete' && status !== 'waived') return true;
        }
        return false;
      });
    }
    return rows;
  }, [projectRows, selectedBuilding, activeFilters]);

  // Project mode: per-building stats
  const projectBuildingStatsComputed = useMemo((): ProjectBuildingStats[] => {
    if (mode !== 'project' || projectColumns.length === 0) return [];

    const buildingMap = new Map<string, ProjectMatrixRow[]>();
    for (const row of projectRows) {
      const list = buildingMap.get(row.building) || [];
      list.push(row);
      buildingMap.set(row.building, list);
    }

    return Array.from(buildingMap.entries()).map(([building, rows]) => {
      const columns: Record<string, { complete: number; total: number }> = {};
      for (const col of projectColumns) {
        let complete = 0;
        let total = 0;
        for (const row of rows) {
          if (col.required) total++;
          const comp = row.completions[col.id];
          if (comp?.status === 'complete' || comp?.status === 'waived') complete++;
        }
        columns[col.id] = { complete, total };
      }
      const completeUnits = rows.filter(r => r.overall_status === 'complete').length;
      return {
        building,
        total_units: rows.length,
        complete_units: completeUnits,
        columns,
      };
    }).sort((a, b) => a.building.localeCompare(b.building));
  }, [mode, projectRows, projectColumns]);

  return {
    mode,
    loading,
    buildings,
    allSubmissions,
    buildingStats,
    selectedBuilding,
    setSelectedBuilding,
    matrixRows,
    matrixStats,
    matrixLoading,
    submissions,
    duplicateGroups,
    pendingParkingRequests,
    parkingExpanded,
    setParkingExpanded,
    selectedRow,
    setSelectedRow,
    sidePanelSubmission,
    selectedIds,
    setSelectedIds,
    activeFilters,
    setActiveFilters,
    handleToggleFilter,
    portfolioStats,
    portfolioBuildingStats,
    filteredMatrixRows,
    missingSubmissions,
    handleRefreshAll,
    handleMergeSubmissions,
    handleMarkPrimary,
    handleDismissDuplicate,
    projectColumns,
    projectRows,
    filteredProjectRows,
    projectBuildingStats: projectBuildingStatsComputed,
    projectBuildings,
    projectName,
    handleStaffComplete,
    handleStaffUncomplete,
  };
}
