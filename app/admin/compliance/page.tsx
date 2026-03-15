'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { sortBuildingsByAssetId, buildingToAssetId, buildingParkingSpots } from '@/lib/buildingAssetIds';
import { buildingToPortfolio, portfolioOrder } from '@/lib/portfolios';
import { buildingUnits } from '@/lib/buildings';
import { normalizeAddress, filterByBuilding, unitsMatch } from '@/lib/addressNormalizer';
import ParkingManagementPanel from '@/components/ParkingManagementPanel';
import DuplicateSubmissionAccordion from '@/components/DuplicateSubmissionAccordion';
import { groupDuplicateSubmissions, SubmissionGroup } from '@/lib/duplicateDetection';
import VehicleExportCenter from '@/components/VehicleExportCenter';
import AddTenantModal from '@/components/AddTenantModal';
import SubmissionEditModal from '@/components/SubmissionEditModal';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import ExemptionStatusBadge from '@/components/ExemptionStatusBadge';
import AppFolioDocumentRow from '@/components/AppFolioDocumentRow';
import AppFolioFeeRow from '@/components/AppFolioFeeRow';
import AppFolioStatusFilter from '@/components/AppFolioStatusFilter';

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
  vehicle_addendum_file?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_type?: 'renters' | 'car' | 'other';
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  pet_addendum_received?: boolean;
  pet_addendum_received_at?: string;
  pet_addendum_received_by?: string;
  vehicle_addendum_received?: boolean;
  vehicle_addendum_received_at?: string;
  vehicle_addendum_received_by?: string;
  // Exemption fields
  exemption_status?: 'pending' | 'approved' | 'denied' | 'more_info_needed' | null;
  exemption_reason?: string;
  exemption_documents?: string[];
  exemption_reviewed_by?: string;
  exemption_reviewed_at?: string;
  exemption_notes?: string;
  has_fee_exemption?: boolean;
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
  // AppFolio tracking fields
  pet_addendum_uploaded_to_appfolio?: boolean;
  pet_addendum_uploaded_to_appfolio_at?: string;
  pet_addendum_uploaded_to_appfolio_by?: string;
  pet_addendum_upload_note?: string;
  vehicle_addendum_uploaded_to_appfolio?: boolean;
  vehicle_addendum_uploaded_to_appfolio_at?: string;
  vehicle_addendum_uploaded_to_appfolio_by?: string;
  vehicle_addendum_upload_note?: string;
  insurance_uploaded_to_appfolio?: boolean;
  insurance_uploaded_to_appfolio_at?: string;
  insurance_uploaded_to_appfolio_by?: string;
  insurance_upload_note?: string;
  pet_fee_added_to_appfolio?: boolean;
  pet_fee_added_to_appfolio_at?: string;
  pet_fee_added_to_appfolio_by?: string;
  pet_fee_amount?: number;
  permit_fee_added_to_appfolio?: boolean;
  permit_fee_added_to_appfolio_at?: string;
  permit_fee_added_to_appfolio_by?: string;
  permit_fee_amount?: number;
}

interface TenantData {
  unit_number: string;
  tenant_name: string;
  email?: string;
  phone?: string;
  building_address: string;
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
  missingSubmissions: Array<{
    unit: string;
    tenant: TenantData;
  }>;
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
  const [documentViewer, setDocumentViewer] = useState<{
    isOpen: boolean;
    documentPath: string | null;
    documentType: 'signature' | 'insurance' | 'addendum' | 'photo';
    title?: string;
    date?: string;
  }>({ isOpen: false, documentPath: null, documentType: 'insurance' });
  const [reviewingSubmission, setReviewingSubmission] = useState<TenantSubmission | null>(null);
  const [reviewAdmin, setReviewAdmin] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<{
    hasVehicle: boolean;
    hasPets: boolean;
    hasInsurance: boolean;
    needsReview: boolean;
    exportStatus: 'all' | 'exported' | 'not-exported';
    hasFeeExemption: boolean;
    appfolioStatus: 'all' | 'ready' | 'partial' | 'complete';
  }>({ hasVehicle: false, hasPets: false, hasInsurance: false, needsReview: false, exportStatus: 'all', hasFeeExemption: false, appfolioStatus: 'all' });
  const [adminName, setAdminName] = useState<string>('');
  const [showDuplicatesGrouped, setShowDuplicatesGrouped] = useState(true);
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<SubmissionGroup[]>([]);
  const [similarityThreshold, setSimilarityThreshold] = useState(85);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<TenantSubmission | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Keep editingSubmission in sync with refreshed data
  useEffect(() => {
    if (editingSubmission) {
      const refreshed = allSubmissions.find(s => s.id === editingSubmission.id);
      if (refreshed && refreshed !== editingSubmission) {
        setEditingSubmission(refreshed);
      }
    }
  }, [allSubmissions]);

  // Keyboard shortcuts for power users
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search name"]') as HTMLInputElement;
        searchInput?.focus();
      }
      
      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      
      // Escape: Clear search
      if (e.key === 'Escape' && quickLookupQuery) {
        setQuickLookupQuery('');
        setQuickLookupResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [quickLookupQuery]);

  useEffect(() => {
    if (selectedBuilding) {
      loadBuildingSubmissions();
    }
  }, [selectedBuilding, filters]);

  useEffect(() => {
    if (submissions.length > 0 && showDuplicatesGrouped) {
      const groups = groupDuplicateSubmissions(submissions, similarityThreshold);
      setDuplicateGroups(groups);
    } else {
      setDuplicateGroups([]);
    }
  }, [submissions, showDuplicatesGrouped, similarityThreshold]);

  useEffect(() => {
    if (selectedBuilding && allSubmissions.length > 0) {
      loadBuildingSubmissions();
    }
  }, [allSubmissions]);

  // Debounced search to reduce API calls - searches ALL current tenants, not just those with submissions
  useEffect(() => {
    if (quickLookupQuery.trim().length < 2) {
      setQuickLookupResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      const query = quickLookupQuery.toLowerCase();
      
      // Fetch unified tenants (includes both submitted and non-submitted tenants)
      try {
        const response = await fetch('/api/admin/unified-tenants');
        const result = await response.json();
        
        if (result.success) {
          const allTenants = result.data;
          const matchedTenants = allTenants.filter((t: any) =>
            t.name?.toLowerCase().includes(query) ||
            t.building_address?.toLowerCase().includes(query) ||
            t.unit_number?.toLowerCase().includes(query) ||
            (t.phone && t.phone.includes(query)) ||
            (t.email && t.email?.toLowerCase().includes(query))
          );
          
          // Convert to submission format for display compatibility
          const results = matchedTenants
            .filter((t: any) => t.hasSubmission)
            .map((t: any) => t.submissionData)
            .slice(0, 10);
          
          setQuickLookupResults(results);
        }
      } catch (error) {
        console.error('Quick lookup error:', error);
        // Fallback to searching existing submissions
        const results = allSubmissions.filter(sub =>
          sub.full_name?.toLowerCase().includes(query) ||
          sub.building_address?.toLowerCase().includes(query) ||
          sub.unit_number?.toLowerCase().includes(query) ||
          sub.phone?.includes(query) ||
          sub.email?.toLowerCase().includes(query)
        );
        setQuickLookupResults(results.slice(0, 10));
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [quickLookupQuery, allSubmissions]);

  const fetchData = async () => {
    try {
      // Fetch submissions via API route (respects authentication)
      const submissionsResponse = await fetch('/api/admin/submissions');
      const submissionsResult = await submissionsResponse.json();

      if (!submissionsResult.success) {
        console.error('Submissions API error:', submissionsResult.message);
        throw new Error(submissionsResult.message);
      }

      const submissions = submissionsResult.data || [];
      setAllSubmissions(submissions);

      // Fetch tenant data from tenant_lookup table
      const tenantResponse = await fetch('/api/admin/compliance/tenant-data');
      const tenantDataResult = await tenantResponse.json();
      const tenantDataList: BuildingTenantData[] = tenantDataResult.success ? tenantDataResult.data : [];
      setTenantData(tenantDataList);

      // Calculate building stats with tenant data
      const stats: Record<string, BuildingStats> = {};
      const buildingList = Object.keys(buildingUnits);

      buildingList.forEach(building => {
        const units = buildingUnits[building] || [];
        const buildingSubs = filterByBuilding(submissions, building);
        const normalizedBuilding = normalizeAddress(building);
        
        // Find tenant data for this building
        const buildingTenants = tenantDataList.find(
          td => td.building_address_normalized === normalizedBuilding
        );
        
        const occupiedUnits = (buildingTenants?.occupied_units || []) as Array<{
          unit_number: string;
          tenant_name: string;
          email?: string;
          phone?: string;
          building_address: string;
        }>;
        
        // Find missing submissions (occupied units without submissions)
        const missingSubmissions = occupiedUnits.filter((tenant: any) => {
          const hasSubmission = buildingSubs.some(sub => 
            // @ts-ignore - TypeScript incorrectly infers type, but unit_number exists at runtime
            unitsMatch(sub.unit_number, tenant.unit_number)
          );
          return !hasSubmission;
        }).map((tenant: any) => ({
          unit: tenant.unit_number,
          tenant: tenant
        })).sort((a, b) => {
          // Custom sort: Retail units first, then numeric units 1-10
          const aIsRetail = a.unit.toLowerCase().includes('retail');
          const bIsRetail = b.unit.toLowerCase().includes('retail');
          
          if (aIsRetail && !bIsRetail) return -1;
          if (!aIsRetail && bIsRetail) return 1;
          
          // Both retail or both non-retail - sort by unit number
          const aNum = parseInt(a.unit.match(/\d+/)?.[0] || '999');
          const bNum = parseInt(b.unit.match(/\d+/)?.[0] || '999');
          
          return aNum - bNum;
        });
        
        // Calculate vacant units
        const vacantCount = units.length - occupiedUnits.length;
        
        stats[building] = {
          totalUnits: units.length,
          occupiedUnits: occupiedUnits.length,
          submissionCount: buildingSubs.length,
          percentComplete: occupiedUnits.length > 0 
            ? Math.round((buildingSubs.length / occupiedUnits.length) * 100) 
            : 0,
          missingUnits: units.filter(u =>
            // @ts-ignore - TypeScript incorrectly infers type, but unit_number exists at runtime
            !buildingSubs.some(sub => unitsMatch(sub.unit_number, u))
          ),
          missingSubmissions: missingSubmissions,
          vacantUnits: vacantCount > 0 ? vacantCount : 0,
        };
      });

      setBuildingStats(stats);

      // Sort buildings by Asset ID
      const sortedBuildings = sortBuildingsByAssetId(buildingList);
      setBuildings(sortedBuildings);
      if (sortedBuildings.length > 0) {
        setSelectedBuilding((currentBuilding) => {
          if (currentBuilding && sortedBuildings.includes(currentBuilding)) {
            return currentBuilding;
          }
          return sortedBuildings[0];
        });
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuildingSubmissions = () => {
    let buildingSubs = filterByBuilding(allSubmissions, selectedBuilding);
    
    // Filter out merged submissions
    buildingSubs = buildingSubs.filter(sub => !sub.merged_into);
    
    // Apply filters
    if (filters.hasVehicle || filters.hasPets || filters.hasInsurance || filters.needsReview || filters.exportStatus !== 'all' || filters.hasFeeExemption || filters.appfolioStatus !== 'all') {
      buildingSubs = buildingSubs.filter(sub => {
        const matchesVehicle = !filters.hasVehicle || sub.has_vehicle;
        const matchesPets = !filters.hasPets || sub.has_pets;
        const matchesInsurance = !filters.hasInsurance || sub.has_insurance;
        const matchesFeeExemption = !filters.hasFeeExemption || sub.has_fee_exemption;
        const matchesNeedsReview = !filters.needsReview || 
          (sub.has_vehicle && !sub.vehicle_verified) ||
          (sub.has_pets && !sub.pet_verified) ||
          (sub.has_insurance && !sub.insurance_verified);
        const matchesExportStatus = filters.exportStatus === 'all' ||
          (filters.exportStatus === 'exported' && sub.vehicle_exported) ||
          (filters.exportStatus === 'not-exported' && !sub.vehicle_exported);
        
        // AppFolio status filter
        let matchesAppfolioStatus = true;
        if (filters.appfolioStatus !== 'all') {
          const allVerified = sub.vehicle_verified && sub.pet_verified && sub.insurance_verified && sub.permit_issued;
          const docsUploaded = (sub.pet_addendum_uploaded_to_appfolio === true) && (sub.vehicle_addendum_uploaded_to_appfolio === true) && (sub.insurance_uploaded_to_appfolio === true);
          const feesAdded = (!sub.has_pets || sub.pet_fee_added_to_appfolio === true) && (!sub.has_vehicle || sub.permit_fee_added_to_appfolio === true);
          const someDocsUploaded = (sub.pet_addendum_uploaded_to_appfolio === true) || (sub.vehicle_addendum_uploaded_to_appfolio === true) || (sub.insurance_uploaded_to_appfolio === true);
          
          if (filters.appfolioStatus === 'ready') {
            matchesAppfolioStatus = allVerified && !docsUploaded;
          } else if (filters.appfolioStatus === 'partial') {
            matchesAppfolioStatus = someDocsUploaded && !docsUploaded;
          } else if (filters.appfolioStatus === 'complete') {
            matchesAppfolioStatus = docsUploaded && feesAdded;
          }
        }
        
        return matchesVehicle && matchesPets && matchesInsurance && matchesFeeExemption && matchesNeedsReview && matchesExportStatus && matchesAppfolioStatus;
      });
    }
    
    setSubmissions(buildingSubs);
  };

  const handleVerify = async (submissionId: string, itemType: 'vehicle' | 'pet' | 'insurance', verified: boolean) => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, itemType, verified }),
      });

      if (response.ok) {
        // Update local submissions state
        setSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return { ...sub, [`${itemType}_verified`]: verified };
          }
          return sub;
        }));
        // Update allSubmissions to keep portfolio stats in sync
        setAllSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return { ...sub, [`${itemType}_verified`]: verified };
          }
          return sub;
        }));
      }
    } catch (error) {
      console.error('Failed to update verification:', error);
    }
  };

  const markReadyForReview = async (submissionId: string) => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          submissionId, 
          itemType: 'vehicle',
          notes: 'Ready for review'
        }),
      });

      if (response.ok) {
        // Update local submissions state
        setSubmissions(prev => prev.map(sub => 
          sub.id === submissionId ? { ...sub, ready_for_review: true } : sub
        ));
        // Update allSubmissions to keep portfolio stats in sync
        setAllSubmissions(prev => prev.map(sub => 
          sub.id === submissionId ? { ...sub, ready_for_review: true } : sub
        ));
      }
    } catch (error) {
      console.error('Failed to mark ready for review:', error);
    }
  };

  const approveForPermit = async () => {
    if (!reviewingSubmission || !reviewAdmin) return;

    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: reviewingSubmission.id,
          itemType: 'vehicle',
          notes: `Reviewed by ${reviewAdmin}`
        }),
      });

      if (response.ok) {
        const updatedData = { reviewed_for_permit: true, reviewed_by: reviewAdmin, reviewed_at: new Date().toISOString() };
        // Update local submissions state
        setSubmissions(prev => prev.map(sub => 
          sub.id === reviewingSubmission.id 
            ? { ...sub, ...updatedData }
            : sub
        ));
        // Update allSubmissions to keep portfolio stats in sync
        setAllSubmissions(prev => prev.map(sub => 
          sub.id === reviewingSubmission.id 
            ? { ...sub, ...updatedData }
            : sub
        ));
        setReviewingSubmission(null);
        setReviewAdmin('');
      }
    } catch (error) {
      console.error('Failed to approve for permit:', error);
    }
  };

  const handleIssuePermit = async (submissionId: string, admin: string) => {
    try {
      const response = await fetch('/api/admin/compliance/permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, admin }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return {
              ...sub,
              permit_issued: true,
              permit_issued_at: new Date().toISOString(),
              permit_issued_by: admin,
            };
          }
          return sub;
        }));
        await fetchData();
        alert('Permit issued successfully!');
      } else {
        // Show validation error message
        alert(data.message || 'Failed to issue permit');
      }
    } catch (error) {
      console.error('Failed to issue permit:', error);
      alert('Failed to issue permit. Please try again.');
    }
  };

  const viewSignature = (path: string, type: string, date?: string) => {
    setDocumentViewer({
      isOpen: true,
      documentPath: path,
      documentType: 'signature',
      title: `${type} Signature`,
      date
    });
  };

  const handleMergeSubmissions = async (primaryId: string, duplicateIds: string[]) => {
    try {
      const response = await fetch('/api/admin/compliance/merge-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateIds, mergeStrategy: 'keep_newest' }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully merged ${duplicateIds.length} submission(s)`);
        await fetchData();
      } else {
        throw new Error(data.message || 'Failed to merge submissions');
      }
    } catch (error) {
      console.error('Failed to merge submissions:', error);
      throw error;
    }
  };

  const handleMarkPrimary = async (submissionId: string, groupId: string) => {
    try {
      const response = await fetch('/api/admin/compliance/merge-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, groupId, action: 'mark_primary' }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
      } else {
        throw new Error(data.message || 'Failed to mark as primary');
      }
    } catch (error) {
      console.error('Failed to mark as primary:', error);
      throw error;
    }
  };

  const handleDismissDuplicate = async (groupId: string, duplicateId: string) => {
    try {
      const response = await fetch('/api/admin/compliance/merge-submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: duplicateId, groupId, action: 'dismiss' }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
      } else {
        throw new Error(data.message || 'Failed to dismiss duplicate');
      }
    } catch (error) {
      console.error('Failed to dismiss duplicate:', error);
      throw error;
    }
  };

  const handleExemptionReview = async (submissionId: string, action: 'approve' | 'deny' | 'request_more_info', notes?: string) => {
    const reviewerName = prompt('Enter your name for the audit trail:') || 'Admin';
    if (!reviewerName) return;

    try {
      const response = await fetch('/api/admin/compliance/exemption-review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          submissionId, 
          action, 
          notes: notes || '',
          reviewerName 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
        alert(`Exemption ${action}d successfully`);
      } else {
        throw new Error(data.message || 'Failed to update exemption');
      }
    } catch (error) {
      console.error('Failed to update exemption:', error);
      alert('Failed to update exemption. Please try again.');
    }
  };

  const handleMarkDocumentUploaded = async (submissionId: string, documentType: 'pet_addendum' | 'vehicle_addendum' | 'insurance', note: string) => {
    if (!adminName) {
      const name = prompt('Enter your name:');
      if (!name) return;
      setAdminName(name);
    }

    const uploaderName = adminName || prompt('Enter your name:');
    if (!uploaderName) return;

    try {
      const response = await fetch('/api/admin/compliance/mark-appfolio-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          documentType,
          uploadedBy: uploaderName,
          note: note || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
      } else {
        throw new Error(data.message || 'Failed to mark document uploaded');
      }
    } catch (error) {
      console.error('Failed to mark document uploaded:', error);
      alert('Failed to mark document uploaded');
    }
  };

  const handleMarkFeeAdded = async (submissionId: string, feeType: 'pet_rent' | 'permit_fee', amount: number) => {
    if (!adminName) {
      const name = prompt('Enter your name:');
      if (!name) return;
      setAdminName(name);
    }

    const adderName = adminName || prompt('Enter your name:');
    if (!adderName) return;

    try {
      const response = await fetch('/api/admin/compliance/mark-fee-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          feeType,
          amount,
          addedBy: adderName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
      } else {
        throw new Error(data.message || 'Failed to mark fee added');
      }
    } catch (error) {
      console.error('Failed to mark fee added:', error);
      alert('Failed to mark fee added');
    }
  };

  const filteredBuildings = buildings.filter(building => {
    const matchesSearch = building.toLowerCase().includes(buildingSearch.toLowerCase());
    const matchesPortfolio = selectedPortfolio === 'all' || buildingToPortfolio[building] === selectedPortfolio;
    return matchesSearch && matchesPortfolio;
  });

  const portfolioStats = useMemo(() => {
    console.log('=== PORTFOLIO STATS CALCULATION ===');
    console.log('All submissions:', allSubmissions.length);
    const vehicleSubmissions = allSubmissions.filter(s => s.has_vehicle);
    console.log('Submissions with vehicles:', vehicleSubmissions.length);
    if (vehicleSubmissions.length > 0) {
      console.log('Sample vehicle submission:', {
        building: vehicleSubmissions[0].building_address,
        unit: vehicleSubmissions[0].unit_number,
        vehicle: `${vehicleSubmissions[0].vehicle_year} ${vehicleSubmissions[0].vehicle_make} ${vehicleSubmissions[0].vehicle_model}`
      });
    }
    console.log('Buildings:', buildings.length);
    console.log('BuildingStats keys:', Object.keys(buildingStats).length);
    
    return portfolioOrder.map(portfolio => {
      const buildingsInPortfolio = buildings.filter(b => buildingToPortfolio[b] === portfolio);
      const totalUnits = buildingsInPortfolio.reduce((sum, b) => sum + (buildingStats[b]?.totalUnits || 0), 0);
      const occupiedUnits = buildingsInPortfolio.reduce((sum, b) => sum + (buildingStats[b]?.occupiedUnits || 0), 0);
      const totalSubmissions = buildingsInPortfolio.reduce((sum, b) => sum + (buildingStats[b]?.submissionCount || 0), 0);
      
      // Count vehicles in this portfolio
      const vehiclesInPortfolio = allSubmissions.filter(s => {
        if (!s.has_vehicle) return false;
        const normalizedAddress = normalizeAddress(s.building_address);
        const matches = buildingsInPortfolio.some(b => normalizeAddress(b) === normalizedAddress);
        return matches;
      });
      const vehicleCount = vehiclesInPortfolio.length;
      
      console.log(`${portfolio}:`, {
        buildings: buildingsInPortfolio.length,
        totalUnits,
        occupiedUnits,
        submissions: totalSubmissions,
        vehicles: vehicleCount
      });

      return {
        name: portfolio,
        buildingCount: buildingsInPortfolio.length,
        totalUnits,
        occupiedUnits,
        totalSubmissions,
        vehicleCount,
      };
    });
  }, [allSubmissions, buildings, buildingStats]);

  useEffect(() => {
    console.log('=== portfolioStats RECALCULATED ===');
    console.log(portfolioStats.map(p => ({
      name: p.name,
      buildings: p.buildingCount,
      vehicles: p.vehicleCount
    })));
  }, [portfolioStats]);

  const ui = {
    page: 'min-h-screen bg-[var(--paper)] text-[var(--ink)]',
    panel: 'bg-white border border-[var(--border)] shadow-sm',
    panelSoft: 'bg-[var(--bg-section)] border border-[var(--divider)]',
    title: 'font-serif text-[var(--primary)]',
    input: 'w-full px-3 py-2 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out',
    primaryButton: 'px-3 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
    secondaryButton: 'px-3 py-2 bg-white text-[var(--primary)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap',
  };

  const selectedStats = buildingStats[selectedBuilding] || {
    totalUnits: 0,
    occupiedUnits: 0,
    submissionCount: 0,
    percentComplete: 0,
    missingUnits: [],
    missingSubmissions: [],
    vacantUnits: 0,
  };
  const buildingSubmissionPool = selectedBuilding
    ? filterByBuilding(allSubmissions, selectedBuilding)
    : [];
  const completeTenants = buildingSubmissionPool.filter(sub =>
    (!sub.has_vehicle || sub.vehicle_verified) &&
    (!sub.has_pets || sub.pet_verified) &&
    (!sub.has_insurance || sub.insurance_verified)
  ).length;
  const incompleteTenants = Math.max(buildingSubmissionPool.length - completeTenants, 0);
  const completionRate = buildingSubmissionPool.length > 0
    ? Math.round((completeTenants / buildingSubmissionPool.length) * 100)
    : 0;
  const occupiedRate = selectedStats.totalUnits > 0
    ? Math.round((selectedStats.occupiedUnits / selectedStats.totalUnits) * 100)
    : 0;
  const missingCount = selectedStats.missingSubmissions?.length || 0;
  const buildingReadiness: 'good' | 'attention' | 'critical' = missingCount > 0
    ? 'critical'
    : incompleteTenants > 0
      ? 'attention'
      : 'good';
  const tone = {
    good: 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/35',
    attention: 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/35',
    critical: 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/35',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-[var(--muted)]">Loading compliance data...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Compliance Dashboard - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className={ui.page}>
      {/* Header */}
      <div className="bg-white border-b border-[var(--divider)] shadow-sm">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <h1 className={`text-3xl ${ui.title}`}>Compliance Dashboard</h1>
              <p className="text-sm text-[var(--muted)] mt-1 tracking-wide">Building-by-building review and verification</p>
            </div>
            
            {/* Portfolio Overview - Horizontal */}
            <div className="flex gap-3 flex-1 justify-center">
              {portfolioStats.map(stat => (
                <div key={`${stat.name}-${stat.vehicleCount}`} className="px-3 py-2 bg-[var(--bg-section)] border border-[var(--divider)]">
                  <div className="text-xs font-semibold text-[var(--primary)]">{stat.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {stat.buildingCount} bldgs
                  </div>
                  <div className="text-xs text-[var(--ink)] mt-0.5 font-medium">
                    {stat.totalUnits} units | {stat.occupiedUnits} occ | {stat.totalSubmissions} sub
                  </div>
                  <div className="text-xs text-[var(--primary)] mt-0.5 font-medium">
                    🚗 {stat.vehicleCount}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <a
                href="/admin"
                className={ui.secondaryButton}
              >
                ← Back
              </a>
              <a
                href="/admin?view=onboarding"
                className={ui.secondaryButton}
              >
                📋 Raw Data
              </a>
              <button
                onClick={() => setShowExportCenter(true)}
                className={ui.primaryButton}
              >
                📊 Export Center
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Sidebar - Collapsible */}
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
                      <div className="flex items-center gap-2 mt-1">
                        {result.has_vehicle && (
                          <span className={`text-xs px-1.5 py-0.5 border ${result.vehicle_verified ? 'bg-[var(--bg-section)] text-[var(--success)] border-[var(--success)]/30' : 'bg-[var(--bg-section)] text-[var(--warning)] border-[var(--warning)]/30'}`}>
                            V: {result.vehicle_verified ? 'Yes' : 'No'}
                          </span>
                        )}
                        {result.has_pets && (
                          <span className={`text-xs px-1.5 py-0.5 border ${result.pet_verified ? 'bg-[var(--bg-section)] text-[var(--success)] border-[var(--success)]/30' : 'bg-[var(--bg-section)] text-[var(--warning)] border-[var(--warning)]/30'}`}>
                            P: {result.pet_verified ? 'Yes' : 'No'}
                          </span>
                        )}
                        {result.has_insurance && (
                          <span className={`text-xs px-1.5 py-0.5 border ${result.insurance_verified ? 'bg-[var(--bg-section)] text-[var(--success)] border-[var(--success)]/30' : 'bg-[var(--bg-section)] text-[var(--warning)] border-[var(--warning)]/30'}`}>
                            I: {result.insurance_verified ? 'Yes' : 'No'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-Select Filters */}
            <div className={`${ui.panelSoft} p-3`}>
              <h3 className="text-sm font-semibold text-[var(--primary)] mb-2 border-b border-[var(--divider)] pb-2">Filters</h3>
              <div className="space-y-2 mb-3">
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasVehicle}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasVehicle: e.target.checked }))}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Has Vehicle
                </label>
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasPets}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasPets: e.target.checked }))}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Has Pets
                </label>
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasFeeExemption}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasFeeExemption: e.target.checked }))}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Fee Exempt
                </label>
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasInsurance}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasInsurance: e.target.checked }))}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Has Insurance
                </label>
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.needsReview}
                    onChange={(e) => setFilters(prev => ({ ...prev, needsReview: e.target.checked }))}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Needs Review
                </label>
              </div>
              
              <div className="mt-3 pt-3 border-t border-[var(--divider)]">
                <h4 className="text-xs font-semibold text-[var(--muted)] mb-2">Export Status</h4>
                <div className="space-y-1">
                  <label className="flex items-center text-xs cursor-pointer">
                    <input
                      type="radio"
                      checked={filters.exportStatus === 'all'}
                      onChange={() => setFilters(prev => ({ ...prev, exportStatus: 'all' }))}
                      className="mr-2 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                    />
                    All Units
                  </label>
                  <label className="flex items-center text-xs cursor-pointer">
                    <input
                      type="radio"
                      checked={filters.exportStatus === 'exported'}
                      onChange={() => setFilters(prev => ({ ...prev, exportStatus: 'exported' }))}
                      className="mr-2 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                    />
                    📤 Exported
                  </label>
                  <label className="flex items-center text-xs cursor-pointer">
                    <input
                      type="radio"
                      checked={filters.exportStatus === 'not-exported'}
                      onChange={() => setFilters(prev => ({ ...prev, exportStatus: 'not-exported' }))}
                      className="mr-2 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                    />
                    ⚠️ Not Exported
                  </label>
                </div>
              </div>

              {/* AppFolio Status Filter */}
              <div className="border-t border-[var(--divider)] pt-3 mt-3">
                <AppFolioStatusFilter
                  value={filters.appfolioStatus}
                  onChange={(value) => setFilters(prev => ({ ...prev, appfolioStatus: value }))}
                />
              </div>
              
              <div className="mt-3">
                {(filters.hasVehicle || filters.hasPets || filters.hasInsurance || filters.needsReview || filters.exportStatus !== 'all' || filters.hasFeeExemption || filters.appfolioStatus !== 'all') && (
                  <button
                    onClick={() => setFilters({ hasVehicle: false, hasPets: false, hasInsurance: false, needsReview: false, exportStatus: 'all', hasFeeExemption: false, appfolioStatus: 'all' })}
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Duplicate Detection Controls */}
            <div className={`${ui.panelSoft} p-3`}>
              <h3 className="text-sm font-semibold text-[var(--primary)] mb-2 border-b border-[var(--divider)] pb-2">Duplicate Detection</h3>
              <div className="space-y-2 mb-3">
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDuplicatesGrouped}
                    onChange={(e) => setShowDuplicatesGrouped(e.target.checked)}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Group Duplicates
                </label>
                <label className="flex items-center text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyDuplicates}
                    onChange={(e) => setShowOnlyDuplicates(e.target.checked)}
                    className="mr-2 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  Show Only Duplicates
                </label>
                {duplicateGroups.length > 0 && (
                  <div className="text-xs text-[var(--warning)] font-medium mt-2">
                    {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? 's' : ''} found
                  </div>
                )}
              </div>
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


            {/* Building Search */}
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
                  const icon = stats.percentComplete === 100 ? '✅' : stats.percentComplete > 0 ? '🟡' : '⚪';
                  
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
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 relative">
          {/* Sidebar Toggle Button */}
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
          <div className={sidebarCollapsed ? 'ml-0' : 'ml-0'}>
          {selectedBuilding && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="relative py-4">
                <div className="absolute left-0 top-1/2 w-full h-px bg-[var(--divider)]" />
                <h2 className="relative inline-block bg-[var(--paper)] pr-4 font-serif text-xl text-[var(--primary)]">
                  Building Review
                </h2>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 bg-[var(--paper)] pl-4 text-sm text-[var(--muted)] font-medium">
                  Operational Summary
                </span>
              </div>
              {/* Building Header */}
              <div className={`${ui.panel} p-6`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className={`text-2xl ${ui.title}`}>{selectedBuilding}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-[var(--muted)]">
                      <span>Asset ID: {buildingToAssetId[selectedBuilding]}</span>
                      <span>•</span>
                      <span>Portfolio: {buildingToPortfolio[selectedBuilding]}</span>
                      <span>•</span>
                      <span>🅿️ Parking: {buildingParkingSpots[selectedBuilding] || 'N/A'} {typeof buildingParkingSpots[selectedBuilding] === 'number' ? 'spots' : ''}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddTenant(true)}
                      className="px-4 py-2 bg-[var(--success)] text-white border border-[var(--success)] rounded-none hover:opacity-90 transition-colors duration-200 ease-out text-sm font-medium"
                    >
                      + Add Tenant
                    </button>
                    <button
                      onClick={async () => {
                        const adminName = prompt('Enter your name:') || 'Admin';
                        const response = await fetch(`/api/admin/compliance/export-vehicles?building=${encodeURIComponent(selectedBuilding)}&admin=${encodeURIComponent(adminName)}`);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `vehicles_${selectedBuilding.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        fetchData();
                      }}
                      className="px-4 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-sm font-medium"
                    >
                      Export Vehicles
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-2.5 bg-[var(--bg-section)] border border-[var(--divider)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-[var(--ink)] flex-wrap">
                    <span className="px-1.5 py-0.5 bg-white border border-[var(--success)]/30 text-[var(--success)]">{completeTenants} Complete</span>
                    <span className="px-1.5 py-0.5 bg-white border border-[var(--warning)]/30 text-[var(--warning)]">{incompleteTenants} Incomplete</span>
                    <span className="px-1.5 py-0.5 bg-white border border-[var(--error)]/30 text-[var(--error)]">{missingCount} Missing Submissions</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 ${tone[buildingReadiness]}`}>
                    {buildingReadiness === 'good' ? 'Building Ready' : buildingReadiness === 'attention' ? 'Needs Verification' : 'Blocked by Missing Items'}
                  </span>
                </div>

                {/* Building Stats - Responsive Grid */}
                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-white border border-[var(--success)]/35">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Collection Complete</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-white border border-[var(--success)]/30 text-[var(--success)]">{completionRate}%</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--success)] leading-none">
                      {completeTenants}
                    </div>
                    <div className="text-xs text-[var(--ink)] font-medium mt-1">Complete Tenants</div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">All required items verified</div>
                  </div>
                  <div className="p-2.5 bg-[var(--bg-section)] border border-[var(--warning)]/35">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Needs Verification</span>
                      <span className={`text-[10px] px-1.5 py-0.5 ${incompleteTenants > 0 ? tone.attention : tone.good}`}>
                        {incompleteTenants > 0 ? 'Action' : 'Clear'}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-[var(--warning)] leading-none">
                      {incompleteTenants}
                    </div>
                    <div className="text-xs text-[var(--ink)] font-medium mt-1">Incomplete Tenants</div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">Missing one or more verifications</div>
                  </div>
                  <div className="p-2.5 bg-white border border-[var(--error)]/35">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Missing Submission</span>
                      <span className={`text-[10px] px-1.5 py-0.5 ${missingCount > 0 ? tone.critical : tone.good}`}>
                        {missingCount > 0 ? 'Blocked' : 'Clear'}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-[var(--error)] leading-none">
                      {missingCount}
                    </div>
                    <div className="text-xs text-[var(--ink)] font-medium mt-1">Missing Submissions</div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">Occupied units with no submission</div>
                  </div>
                  <div className="p-2.5 bg-white border border-[var(--divider)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Occupancy Context</span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-[var(--divider)] bg-[var(--bg-section)] text-[var(--muted)]">Secondary</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--ink)] leading-none">
                      {selectedStats.occupiedUnits}
                    </div>
                    <div className="text-xs text-[var(--ink)] font-medium mt-1">Occupied Units</div>
                    <div className="text-[11px] text-[var(--muted)] mt-0.5">{occupiedRate}% of {selectedStats.totalUnits} total units</div>
                  </div>
                </div>

                {/* Missing Submissions - Occupied Units Without Forms */}
                {selectedStats.missingSubmissions && selectedStats.missingSubmissions.length > 0 && (
                  <div className="mt-3 p-3 bg-[var(--error)]/10 border border-[var(--error)]/35">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-sm font-semibold text-[var(--error)]">
                        🚨 Missing Submissions: {selectedStats.missingSubmissions.length} occupied units
                      </div>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-white border border-[var(--error)]/35 text-[var(--error)]">
                        Action Required
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--warning)] mb-2">
                      These units are occupied but blocked because no onboarding submission is on file.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {selectedStats.missingSubmissions.map((missing, idx) => (
                        <div key={idx} className="text-sm text-[var(--ink)] bg-white p-2 border border-[var(--error)]/25">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-[var(--error)]">Unit {missing.unit}</div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20">Missing</span>
                          </div>
                          <div className="text-[var(--ink)]">{missing.tenant.tenant_name}</div>
                          {missing.tenant.email && <div className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{missing.tenant.email}</div>}
                          {missing.tenant.phone && <div className="text-[11px] text-[var(--muted)]">{missing.tenant.phone}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vacant Units Info */}
                {buildingStats[selectedBuilding]?.vacantUnits > 0 && (
                  <div className="mt-4 p-3 bg-[var(--bg-section)] border border-[var(--divider)]">
                    <div className="text-sm font-medium text-[var(--muted)]">
                      ℹ️ Vacant Units: {buildingStats[selectedBuilding].vacantUnits}
                    </div>
                  </div>
                )}
              </div>

              {/* Parking Management Panel */}
              <ParkingManagementPanel 
                buildingAddress={selectedBuilding}
                onRefresh={fetchData}
              />

              {/* Filter Summary */}
              {(filters.hasVehicle || filters.hasPets || filters.hasInsurance || filters.needsReview || filters.exportStatus !== 'all' || filters.hasFeeExemption) && (
                <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[var(--ink)]">
                      <span className="font-medium">Active Filters:</span>
                      {filters.hasVehicle && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">Has Vehicle</span>}
                      {filters.hasPets && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">Has Pets</span>}
                      {filters.hasFeeExemption && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">Fee Exempt</span>}
                      {filters.hasInsurance && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">Has Insurance</span>}
                      {filters.needsReview && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">Needs Review</span>}
                      {filters.exportStatus === 'exported' && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">📤 Exported</span>}
                      {filters.exportStatus === 'not-exported' && <span className="ml-2 px-2 py-0.5 border border-[var(--divider)] bg-white text-xs">⚠️ Not Exported</span>}
                    </div>
                    <button
                      onClick={() => setFilters({ hasVehicle: false, hasPets: false, hasInsurance: false, needsReview: false, exportStatus: 'all', hasFeeExemption: false, appfolioStatus: 'all' })}
                      className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}

              <div className="relative py-3">
                <div className="absolute left-0 top-1/2 w-full h-px bg-[var(--divider)]" />
                <h3 className="relative inline-block bg-[var(--paper)] pr-4 font-serif text-lg text-[var(--primary)]">
                  Tenant Records
                </h3>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 bg-[var(--paper)] pl-4 text-sm text-[var(--muted)] font-medium">
                  Review Queue
                </span>
              </div>

              {/* Tenant Cards */}
              <div className="space-y-4">
                {submissions.length === 0 ? (
                  <div className="bg-white border border-[var(--border)] shadow-sm p-8 text-center text-[var(--muted)]">
                    No submissions for this building yet.
                  </div>
                ) : (() => {
                  // Determine which submissions to show
                  const groupedSubmissionIds = new Set(
                    duplicateGroups.flatMap(g => [g.primarySubmission.id, ...g.duplicates.map(d => d.id)])
                  );
                  
                  const uniqueSubmissions = showOnlyDuplicates 
                    ? [] 
                    : submissions.filter(s => !groupedSubmissionIds.has(s.id));
                  
                  const displayGroups = showOnlyDuplicates || !showDuplicatesGrouped 
                    ? duplicateGroups 
                    : duplicateGroups;

                  return (
                    <>
                      {/* Duplicate Groups */}
                      {showDuplicatesGrouped && displayGroups.map(group => (
                        <DuplicateSubmissionAccordion
                          key={group.id}
                          group={group}
                          onMerge={handleMergeSubmissions}
                          onMarkPrimary={handleMarkPrimary}
                          onDismiss={handleDismissDuplicate}
                          onViewSignature={viewSignature}
                        />
                      ))}

                      {/* Unique Submissions (not in duplicate groups) */}
                      {!showOnlyDuplicates && uniqueSubmissions.map(submission => {
                        const hasReviewItems = submission.has_vehicle || submission.has_pets || submission.has_insurance;
                        const unmetChecks = [
                          submission.has_vehicle && !submission.vehicle_verified ? 'Vehicle' : null,
                          submission.has_pets && !submission.pet_verified ? 'Pet' : null,
                          submission.has_insurance && !submission.insurance_verified ? 'Insurance' : null,
                        ].filter(Boolean) as string[];
                        const readyForPermit = submission.has_vehicle && submission.vehicle_verified && submission.pet_verified && submission.insurance_verified;

                        return (
                    <div key={submission.id} className="bg-white border border-[var(--border)] shadow-sm p-4">
                      {/* Tenant Header */}
                      <div className="flex items-start justify-between mb-3 border-b border-[var(--divider)] pb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-[var(--primary)]">
                              Unit {submission.unit_number} - {submission.full_name}
                            </h3>
                            {hasReviewItems && (
                              <span className={`text-[10px] px-1.5 py-0.5 ${readyForPermit ? tone.good : unmetChecks.length > 1 ? tone.critical : tone.attention}`}>
                                {readyForPermit ? 'Ready for Permit' : `${unmetChecks.length} Check${unmetChecks.length === 1 ? '' : 's'} Missing`}
                              </span>
                            )}
                            {submission.ready_for_review && !submission.reviewed_for_permit && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)]/12 text-[var(--accent)] border border-[var(--accent)]/35">
                                Awaiting Admin Review
                              </span>
                            )}
                            {submission.reviewed_for_permit && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/35">
                                Reviewed
                              </span>
                            )}
                            {submission.has_fee_exemption && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-800 border border-green-300 font-bold">
                                FEE EXEMPT
                              </span>
                            )}
                            <button
                              onClick={() => setEditingSubmission(submission)}
                              className="text-[var(--primary)] hover:text-[var(--primary-light)] p-1 hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                              title="Edit submission"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                          <div className="text-xs text-[var(--muted)] mt-1">
                            {submission.phone} • {submission.email}
                          </div>
                          {hasReviewItems && unmetChecks.length > 0 && (
                            <div className="text-[11px] text-[var(--warning)] mt-1">
                              Missing verification: {unmetChecks.join(', ')}
                            </div>
                          )}
                        </div>
                        
                        {/* Verification Status Panel */}
                        {(submission.has_vehicle || submission.has_pets || submission.has_insurance) && (() => {
                          const canIssuePermit = submission.vehicle_verified && submission.pet_verified && submission.insurance_verified;
                          const verifiedCount = [
                            submission.vehicle_verified,
                            submission.pet_verified,
                            submission.insurance_verified
                          ].filter(Boolean).length;
                          const totalCount = 3;
                          const progressPercent = Math.round((verifiedCount / totalCount) * 100);
                          
                          return (
                          <div className="ml-4 border border-[var(--divider)] bg-[var(--bg-section)] p-3 shadow-sm min-w-[220px]">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-[var(--primary)]">Verification Status</span>
                              <span className={`text-xs font-medium ${
                                verifiedCount === totalCount ? 'text-[var(--success)]' : 'text-[var(--muted)]'
                              }`}>
                                {verifiedCount}/{totalCount}
                              </span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="w-full bg-[var(--divider)] h-2">
                                <div
                                  className={`h-2 transition-all duration-300 ease-out ${
                                    progressPercent === 100 ? 'bg-[var(--success)]' : 
                                    progressPercent > 0 ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]/40'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Checkbox Checklist */}
                            <div className="flex flex-col mb-2">
                              <button
                                onClick={() => handleVerify(submission.id, 'vehicle', !submission.vehicle_verified)}
                                className="flex items-center gap-2 text-xs leading-tight px-1 hover:bg-white transition-colors duration-200 ease-out text-left"
                              >
                                <span className={`text-base ${
                                  submission.vehicle_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'
                                }`}>
                                  {submission.vehicle_verified ? '☑' : '☐'}
                                </span>
                                <span className={submission.vehicle_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                                  Vehicle
                                </span>
                              </button>
                              
                              <button
                                onClick={() => handleVerify(submission.id, 'pet', !submission.pet_verified)}
                                className="flex items-center gap-2 text-xs leading-tight px-1 hover:bg-white transition-colors duration-200 ease-out text-left"
                              >
                                <span className={`text-base ${
                                  submission.pet_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'
                                }`}>
                                  {submission.pet_verified ? '☑' : '☐'}
                                </span>
                                <span className={submission.pet_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                                  Pet
                                </span>
                              </button>
                              
                              <button
                                onClick={() => handleVerify(submission.id, 'insurance', !submission.insurance_verified)}
                                className="flex items-center gap-2 text-xs leading-tight px-1 hover:bg-white transition-colors duration-200 ease-out text-left"
                              >
                                <span className={`text-base ${
                                  submission.insurance_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'
                                }`}>
                                  {submission.insurance_verified ? '☑' : '☐'}
                                </span>
                                <span className={submission.insurance_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                                  Insurance
                                </span>
                              </button>
                            </div>
                            
                            {/* Permit Eligibility Indicator */}
                            {submission.has_vehicle && (
                              <div className={`text-xs px-2.5 py-1.5 font-medium border text-center ${
                                canIssuePermit 
                                  ? 'bg-white text-[var(--success)] border-[var(--success)]/30'
                                  : 'bg-white text-[var(--warning)] border-[var(--warning)]/30'
                              }`}>
                                {canIssuePermit ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="text-[var(--success)]">✓</span>
                                    <span>Ready for Permit</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span>⚠️</span>
                                    <span>Verify all items first</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          );
                        })()}
                      </div>

                      {/* Vehicle Section */}
                      {submission.has_vehicle && (
                        <div className="mb-5 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                          <h4 className="font-serif text-[var(--primary)] mb-3">Vehicle Information</h4>
                          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                            <div><span className="text-[var(--muted)]">Vehicle:</span> <span className="ml-1 font-medium">{submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}</span></div>
                            <div><span className="text-[var(--muted)]">Color:</span> <span className="ml-1">{submission.vehicle_color}</span></div>
                            <div><span className="text-[var(--muted)]">Plate:</span> <span className="ml-1 font-mono">{submission.vehicle_plate}</span></div>
                          </div>
                          {submission.vehicle_signature && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-[var(--success)]">✅ Signature Captured</span>
                              {submission.vehicle_signature_date && (
                                <span className="text-[var(--muted)]">({new Date(submission.vehicle_signature_date).toLocaleDateString()})</span>
                              )}
                              <button
                                onClick={() => viewSignature(submission.vehicle_signature!, 'Vehicle', submission.vehicle_signature_date)}
                                className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                              >
                                View Signature
                              </button>
                            </div>
                          )}
                          {submission.vehicle_addendum_file && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <button
                                onClick={() => setDocumentViewer({
                                  isOpen: true,
                                  documentPath: submission.vehicle_addendum_file || null,
                                  documentType: 'addendum',
                                  title: 'Vehicle Addendum Document'
                                })}
                                className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                              >
                                View Addendum Document
                              </button>
                            </div>
                          )}
                          {!submission.vehicle_signature && (
                            <div className="text-sm text-[var(--error)]">❌ No signature captured</div>
                          )}
                          
                          {/* Review Workflow Buttons */}
                          <div className="mt-3 pt-3 border-t border-[var(--divider)] flex gap-2">
                            {submission.vehicle_verified && !submission.ready_for_review && (
                              <button
                                onClick={() => markReadyForReview(submission.id)}
                                className="px-3 py-1 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none text-xs font-medium hover:bg-[var(--primary-light)]"
                              >
                                Mark Ready for Review
                              </button>
                            )}
                            
                            {submission.ready_for_review && !submission.reviewed_for_permit && (
                              <button
                                onClick={() => setReviewingSubmission(submission)}
                                className="px-3 py-1 bg-[var(--accent)] text-white border border-[var(--accent)] rounded-none text-xs font-medium hover:opacity-90"
                              >
                                Review for Permit
                              </button>
                            )}
                            
                            {submission.reviewed_for_permit && (
                              <div className="text-sm text-[var(--success)]">
                                ✅ Reviewed by {submission.reviewed_by} {submission.reviewed_at && `on ${new Date(submission.reviewed_at).toLocaleDateString()}`}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Vehicles Section */}
                      {submission.additional_vehicles && submission.additional_vehicles.length > 0 && (
                        <div className="mb-5 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                          <h4 className="font-serif text-[var(--primary)] mb-3 flex items-center gap-2">
                            🚗+ Additional Vehicle{submission.additional_vehicles.length > 1 ? 's' : ''}
                            {submission.additional_vehicle_approved && (
                              <span className="text-xs bg-white text-[var(--success)] px-2 py-0.5 border border-[var(--success)]/30">Approved</span>
                            )}
                            {submission.additional_vehicle_denied && (
                              <span className="text-xs bg-white text-[var(--error)] px-2 py-0.5 border border-[var(--error)]/30">Denied</span>
                            )}
                            {!submission.additional_vehicle_approved && !submission.additional_vehicle_denied && (
                              <span className="text-xs bg-white text-[var(--warning)] px-2 py-0.5 border border-[var(--warning)]/30">Pending</span>
                            )}
                          </h4>
                          {submission.additional_vehicles.map((av, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-3 text-sm mb-2">
                              <div><span className="text-[var(--muted)]">Vehicle:</span> <span className="ml-1 font-medium">{av.vehicle_year} {av.vehicle_make} {av.vehicle_model}</span></div>
                              <div><span className="text-[var(--muted)]">Color:</span> <span className="ml-1">{av.vehicle_color}</span></div>
                              <div><span className="text-[var(--muted)]">Plate:</span> <span className="ml-1 font-mono">{av.vehicle_plate}</span></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pet Section */}
                      {submission.has_pets && (
                        <div className="mb-5 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-serif text-[var(--primary)]">Pet Information</h4>
                            {submission.exemption_status && (
                              <ExemptionStatusBadge 
                                status={submission.exemption_status} 
                                reason={submission.exemption_reason}
                                compact
                              />
                            )}
                          </div>
                          {submission.pets && Array.isArray(submission.pets) && submission.pets.map((pet: any, idx: number) => (
                            <div key={idx} className="text-sm mb-3 p-2 bg-white border border-[var(--divider)]">
                              <div className="font-medium mb-1">{pet.pet_name} ({pet.pet_type}) - {pet.pet_breed}, {pet.pet_weight} lbs</div>
                              {pet.pet_photo_file && (
                                <button
                                  onClick={() => setDocumentViewer({
                                    isOpen: true,
                                    documentPath: pet.pet_photo_file,
                                    documentType: 'photo',
                                    title: `${pet.pet_name} - Pet Photo`
                                  })}
                                  className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-xs"
                                >
                                  View Photo
                                </button>
                              )}
                              {pet.pet_vaccination_file && (
                                <span className="ml-3">
                                  <button
                                    onClick={() => setDocumentViewer({
                                      isOpen: true,
                                      documentPath: pet.pet_vaccination_file,
                                      documentType: 'addendum',
                                      title: `${pet.pet_name} - Vaccination Record`
                                    })}
                                    className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-xs"
                                  >
                                    View Vaccination
                                  </button>
                                </span>
                              )}
                            </div>
                          ))}
                          {submission.pet_signature && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <span className="text-[var(--success)]">✅ Signature Captured</span>
                              {submission.pet_signature_date && (
                                <span className="text-[var(--muted)]">({new Date(submission.pet_signature_date).toLocaleDateString()})</span>
                              )}
                              <button
                                onClick={() => viewSignature(submission.pet_signature!, 'Pet', submission.pet_signature_date)}
                                className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                              >
                                View Signature
                              </button>
                            </div>
                          )}
                          {submission.pet_addendum_file && (
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <button
                                onClick={() => setDocumentViewer({
                                  isOpen: true,
                                  documentPath: submission.pet_addendum_file || null,
                                  documentType: 'addendum',
                                  title: 'Pet Addendum Document'
                                })}
                                className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                              >
                                View Addendum Document
                              </button>
                            </div>
                          )}
                          {!submission.pet_signature && (
                            <div className="text-sm text-[var(--error)]">❌ No signature captured</div>
                          )}
                          
                          {/* Exemption Documents */}
                          {submission.exemption_status && submission.exemption_documents && submission.exemption_documents.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[var(--divider)]">
                              <h5 className="text-sm font-semibold text-[var(--primary)] mb-2">Exemption Documents</h5>
                              <div className="space-y-2">
                                {submission.exemption_documents.map((docUrl, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setDocumentViewer({
                                      isOpen: true,
                                      documentPath: docUrl,
                                      documentType: 'addendum',
                                      title: `Exemption Document ${idx + 1}`
                                    })}
                                    className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-sm block"
                                  >
                                    View Document {idx + 1}
                                  </button>
                                ))}
                              </div>
                              {submission.exemption_reviewed_at && (
                                <div className="text-xs text-[var(--muted)] mt-2">
                                  Reviewed by {submission.exemption_reviewed_by} on {new Date(submission.exemption_reviewed_at).toLocaleDateString()}
                                  {submission.exemption_notes && (
                                    <div className="mt-1 text-[var(--ink)]">Notes: {submission.exemption_notes}</div>
                                  )}
                                </div>
                              )}
                              
                              {/* Review Actions */}
                              {submission.exemption_status === 'pending' && (
                                <div className="mt-3 pt-3 border-t border-[var(--divider)] flex gap-2">
                                  <button
                                    onClick={() => {
                                      const notes = prompt('Enter approval notes (optional):');
                                      handleExemptionReview(submission.id, 'approve', notes || undefined);
                                    }}
                                    className="px-3 py-1 bg-[var(--success)] text-white border border-[var(--success)] rounded-none text-xs font-medium hover:bg-[var(--success)]/90"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      const notes = prompt('Enter denial reason (required):');
                                      if (notes) {
                                        handleExemptionReview(submission.id, 'deny', notes);
                                      }
                                    }}
                                    className="px-3 py-1 bg-[var(--error)] text-white border border-[var(--error)] rounded-none text-xs font-medium hover:bg-[var(--error)]/90"
                                  >
                                    Deny
                                  </button>
                                  <button
                                    onClick={() => {
                                      const notes = prompt('Enter information request details:');
                                      if (notes) {
                                        handleExemptionReview(submission.id, 'request_more_info', notes);
                                      }
                                    }}
                                    className="px-3 py-1 bg-[var(--warning)] text-white border border-[var(--warning)] rounded-none text-xs font-medium hover:bg-[var(--warning)]/90"
                                  >
                                    Request More Info
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Insurance Section */}
                      {submission.has_insurance && (
                        <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                          <h4 className="font-serif text-[var(--primary)] mb-2">Insurance Information</h4>
                          <div className="text-sm">
                            <span className="text-[var(--muted)]">Provider:</span> <span className="ml-1">{submission.insurance_provider}</span>
                            {submission.insurance_policy_number && (
                              <span className="ml-3"><span className="text-[var(--muted)]">Policy:</span> <span className="ml-1">{submission.insurance_policy_number}</span></span>
                            )}
                            {submission.insurance_file && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setDocumentViewer({
                                    isOpen: true,
                                    documentPath: submission.insurance_file || null,
                                    documentType: 'insurance',
                                    title: 'Insurance Document'
                                  })}
                                  className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-sm"
                                >
                                  View Insurance Document
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AppFolio Documents Section - Only show when permit issued */}
                      {submission.permit_issued && (
                        <div className="mt-5 p-4 bg-white border-2 border-[var(--primary)]/20">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-serif text-[var(--primary)]">AppFolio Documents</h4>
                            <div className="text-xs text-[var(--muted)]">
                              {submission.pet_addendum_uploaded_to_appfolio && submission.vehicle_addendum_uploaded_to_appfolio && submission.insurance_uploaded_to_appfolio ? (
                                <span className="text-[var(--success)] font-medium">✓ All Uploaded</span>
                              ) : (
                                <span>Ready for upload</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-0">
                            <AppFolioDocumentRow
                              documentType="Pet Addendum"
                              documentPath={submission.pet_addendum_file}
                              uploadedToAppfolio={submission.pet_addendum_uploaded_to_appfolio || false}
                              uploadedAt={submission.pet_addendum_uploaded_to_appfolio_at}
                              uploadedBy={submission.pet_addendum_uploaded_to_appfolio_by}
                              uploadNote={submission.pet_addendum_upload_note}
                              onMarkUploaded={(note) => handleMarkDocumentUploaded(submission.id, 'pet_addendum', note)}
                            />

                            {submission.has_vehicle && (
                              <AppFolioDocumentRow
                                documentType="Vehicle Addendum"
                                documentPath={submission.vehicle_addendum_file}
                                uploadedToAppfolio={submission.vehicle_addendum_uploaded_to_appfolio || false}
                                uploadedAt={submission.vehicle_addendum_uploaded_to_appfolio_at}
                                uploadedBy={submission.vehicle_addendum_uploaded_to_appfolio_by}
                                uploadNote={submission.vehicle_addendum_upload_note}
                                onMarkUploaded={(note) => handleMarkDocumentUploaded(submission.id, 'vehicle_addendum', note)}
                              />
                            )}

                            <AppFolioDocumentRow
                              documentType="Insurance"
                              documentPath={submission.insurance_file}
                              uploadedToAppfolio={submission.insurance_uploaded_to_appfolio || false}
                              uploadedAt={submission.insurance_uploaded_to_appfolio_at}
                              uploadedBy={submission.insurance_uploaded_to_appfolio_by}
                              uploadNote={submission.insurance_upload_note}
                              onMarkUploaded={(note) => handleMarkDocumentUploaded(submission.id, 'insurance', note)}
                            />
                          </div>

                          {/* Fees Section */}
                          <div className="mt-4 pt-4 border-t border-[var(--divider)]">
                            <h5 className="text-sm font-medium text-[var(--ink)] mb-2">Fees Added to AppFolio</h5>
                            <div className="space-y-0">
                              {submission.has_pets && !submission.has_fee_exemption && (
                                <AppFolioFeeRow
                                  feeType="Pet Rent"
                                  feeAdded={submission.pet_fee_added_to_appfolio || false}
                                  amount={submission.pet_fee_amount}
                                  addedAt={submission.pet_fee_added_to_appfolio_at}
                                  addedBy={submission.pet_fee_added_to_appfolio_by}
                                  onMarkAdded={(amount) => handleMarkFeeAdded(submission.id, 'pet_rent', amount)}
                                />
                              )}

                              {submission.has_vehicle && (
                                <AppFolioFeeRow
                                  feeType="Permit Fee"
                                  feeAdded={submission.permit_fee_added_to_appfolio || false}
                                  amount={submission.permit_fee_amount}
                                  addedAt={submission.permit_fee_added_to_appfolio_at}
                                  addedBy={submission.permit_fee_added_to_appfolio_by}
                                  onMarkAdded={(amount) => handleMarkFeeAdded(submission.id, 'permit_fee', amount)}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>


      {/* Review Modal */}
      {reviewingSubmission && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-8"
          onClick={() => setReviewingSubmission(null)}
        >
          <div
            className="bg-white border border-[var(--border)] p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl ${ui.title}`}>Review for Permit Approval</h3>
              <button
                onClick={() => setReviewingSubmission(null)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="text-lg font-medium text-[var(--ink)] mb-2">
                {reviewingSubmission.full_name} - Unit {reviewingSubmission.unit_number}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {reviewingSubmission.building_address}
              </div>
            </div>

            {/* Vehicle Details */}
            {reviewingSubmission.has_vehicle && (
              <div className="mb-6 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                <h4 className="font-serif text-[var(--primary)] mb-3">Vehicle Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div><span className="text-[var(--muted)]">Vehicle:</span> <span className="ml-1 font-medium">{reviewingSubmission.vehicle_year} {reviewingSubmission.vehicle_make} {reviewingSubmission.vehicle_model}</span></div>
                  <div><span className="text-[var(--muted)]">Color:</span> <span className="ml-1">{reviewingSubmission.vehicle_color}</span></div>
                  <div><span className="text-[var(--muted)]">Plate:</span> <span className="ml-1 font-mono">{reviewingSubmission.vehicle_plate}</span></div>
                  <div>
                    <span className="text-[var(--muted)]">Verified:</span> 
                    <span className={`ml-1 font-medium ${reviewingSubmission.vehicle_verified ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                      {reviewingSubmission.vehicle_verified ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                </div>
                {reviewingSubmission.vehicle_signature ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--success)]">✅ Signature Captured</span>
                    <button
                      onClick={() => viewSignature(reviewingSubmission.vehicle_signature!, 'Vehicle', reviewingSubmission.vehicle_signature_date)}
                      className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                    >
                      View Signature
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--error)]">❌ No signature captured</div>
                )}
              </div>
            )}

            {/* Pet Details */}
            {reviewingSubmission.has_pets && (
              <div className="mb-6 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                <h4 className="font-serif text-[var(--primary)] mb-3">Pet Information</h4>
                {reviewingSubmission.pets && Array.isArray(reviewingSubmission.pets) && reviewingSubmission.pets.map((pet: any, idx: number) => (
                  <div key={idx} className="text-sm mb-2">
                    <span className="font-medium">{pet.pet_name}</span> ({pet.pet_type}) - {pet.pet_breed}, {pet.pet_weight} lbs
                  </div>
                ))}
                <div className="mt-2">
                  <span className="text-[var(--muted)] text-sm">Verified:</span> 
                  <span className={`ml-1 font-medium text-sm ${reviewingSubmission.pet_verified ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                    {reviewingSubmission.pet_verified ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
                {reviewingSubmission.pet_signature && (
                  <div className="flex items-center gap-2 text-sm mt-2">
                    <span className="text-[var(--success)]">✅ Signature Captured</span>
                    <button
                      onClick={() => viewSignature(reviewingSubmission.pet_signature!, 'Pet', reviewingSubmission.pet_signature_date)}
                      className="text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                    >
                      View Signature
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Admin Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                Reviewed by:
              </label>
              <select
                value={reviewAdmin}
                onChange={(e) => setReviewAdmin(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none bg-[var(--bg-input)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
              >
                <option value="">Select admin...</option>
                <option value="Alex">Alex</option>
                <option value="Dean">Dean</option>
                <option value="Dan">Dan</option>
                <option value="Tiff">Tiff</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setReviewingSubmission(null);
                  setReviewAdmin('');
                }}
                className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
              >
                Cancel
              </button>
              <button
                onClick={approveForPermit}
                disabled={!reviewAdmin}
                className="flex-1 px-4 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:bg-[var(--muted)] disabled:border-[var(--muted)] disabled:cursor-not-allowed"
              >
                Approve for Permit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Center Modal */}
      {showExportCenter && (
        <VehicleExportCenter
          allSubmissions={allSubmissions}
          buildings={buildings}
          onClose={() => setShowExportCenter(false)}
          onExportComplete={() => {
            fetchData();
          }}
        />
      )}

      {/* Edit Submission Modal */}
      {editingSubmission && (
        <SubmissionEditModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Add Tenant Modal */}
      <AddTenantModal
        isOpen={showAddTenant}
        onClose={() => setShowAddTenant(false)}
        onSuccess={() => fetchData()}
        prefilledBuilding={selectedBuilding}
      />

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={documentViewer.isOpen}
        onClose={() => setDocumentViewer({ isOpen: false, documentPath: null, documentType: 'insurance' })}
        documentPath={documentViewer.documentPath}
        documentType={documentViewer.documentType}
        title={documentViewer.title}
        date={documentViewer.date}
      />
    </div>
    </>
  );
}
