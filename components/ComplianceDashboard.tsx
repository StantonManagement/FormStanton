'use client';

import { useState, useEffect } from 'react';
import TenantComplianceCard from './TenantComplianceCard';
import { sortBuildingsByAssetId, buildingToAssetId } from '@/lib/buildingAssetIds';

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
  permit_issued: boolean;
  permit_issued_at?: string;
  permit_issued_by?: string;
  tenant_picked_up: boolean;
  tenant_picked_up_at?: string;
  has_pets: boolean;
  pets?: any;
  pet_verified: boolean;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  add_insurance_to_rent?: boolean;
  insurance_verified: boolean;
  admin_notes?: string;
  last_reviewed_at?: string;
  created_at: string;
}

interface ComplianceStats {
  totalSubmissions: number;
  vehicleCount: number;
  vehicleVerifiedCount: number;
  petCount: number;
  petVerifiedCount: number;
  insuranceCount: number;
  insuranceUploadedCount: number;
  insurancePendingCount: number;
  insuranceVerifiedCount: number;
}

export default function ComplianceDashboard() {
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [buildingSearch, setBuildingSearch] = useState<string>('');
  const [quickLookupQuery, setQuickLookupQuery] = useState<string>('');
  const [quickLookupResults, setQuickLookupResults] = useState<TenantSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TenantSubmission[]>([]);
  const [buildingProgress, setBuildingProgress] = useState<Record<string, { percent: number; status: string }>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [submissions, setSubmissions] = useState<TenantSubmission[]>([]);
  const [filter, setFilter] = useState<'all' | 'has_vehicle' | 'missing_vehicle' | 'has_pets' | 'missing_insurance'>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (selectedBuilding) {
      fetchBuildingSummary();
    }
  }, [selectedBuilding]);

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/admin/buildings');
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        const sortedBuildings = sortBuildingsByAssetId(data.data);
        setBuildings(sortedBuildings);
        setSelectedBuilding(sortedBuildings[0]);
      }
      
      // Fetch all submissions for quick lookup and progress calculation
      const subsResponse = await fetch('/api/admin/submissions');
      const subsData = await subsResponse.json();
      if (subsData.success) {
        setAllSubmissions(subsData.data);
        calculateBuildingProgress(subsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBuildingProgress = (subs: TenantSubmission[]) => {
    const progress: Record<string, { percent: number; status: string }> = {};
    
    buildings.forEach(building => {
      const buildingSubs = subs.filter(s => s.building_address === building);
      if (buildingSubs.length === 0) {
        progress[building] = { percent: 0, status: 'none' };
        return;
      }
      
      let totalItems = 0;
      let verifiedItems = 0;
      
      buildingSubs.forEach(sub => {
        if (sub.has_vehicle) {
          totalItems++;
          if (sub.vehicle_verified) verifiedItems++;
        }
        if (sub.has_pets) {
          totalItems++;
          if (sub.pet_verified) verifiedItems++;
        }
        if (sub.has_insurance) {
          totalItems++;
          if (sub.insurance_verified) verifiedItems++;
        }
      });
      
      const percent = totalItems > 0 ? Math.round((verifiedItems / totalItems) * 100) : 0;
      let status = 'not_started';
      if (percent === 100) status = 'complete';
      else if (percent > 0) status = 'partial';
      
      progress[building] = { percent, status };
    });
    
    setBuildingProgress(progress);
  };

  const fetchBuildingSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/compliance/building-summary?building=${encodeURIComponent(selectedBuilding)}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setSubmissions(data.submissions);
      }
    } catch (error) {
      console.error('Failed to fetch building summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (submissionId: string, itemType: 'vehicle' | 'pet' | 'insurance', verified: boolean) => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, itemType, verified }),
      });

      if (response.ok) {
        // Update local state
        setSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return {
              ...sub,
              [`${itemType}_verified`]: verified,
              last_reviewed_at: new Date().toISOString(),
            };
          }
          return sub;
        }));

        // Refresh stats
        await fetchBuildingSummary();
      }
    } catch (error) {
      console.error('Failed to update verification:', error);
    }
  };

  const handleUpdateNotes = async (submissionId: string, notes: string) => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, itemType: 'vehicle', notes }),
      });

      if (response.ok) {
        setSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return { ...sub, admin_notes: notes };
          }
          return sub;
        }));
      }
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  };

  // Quick Lookup search handler
  useEffect(() => {
    if (quickLookupQuery.trim().length < 2) {
      setQuickLookupResults([]);
      return;
    }

    const query = quickLookupQuery.toLowerCase();
    const results = allSubmissions.filter(sub =>
      sub.full_name?.toLowerCase().includes(query) ||
      sub.building_address?.toLowerCase().includes(query) ||
      sub.unit_number?.toLowerCase().includes(query) ||
      sub.phone?.includes(query) ||
      sub.email?.toLowerCase().includes(query)
    );
    setQuickLookupResults(results.slice(0, 10)); // Limit to 10 results
  }, [quickLookupQuery, allSubmissions]);

  // Recalculate progress when buildings or submissions change
  useEffect(() => {
    if (buildings.length > 0 && allSubmissions.length > 0) {
      calculateBuildingProgress(allSubmissions);
    }
  }, [buildings, allSubmissions]);

  const handleIssuePermit = async (submissionId: string, admin: string) => {
    try {
      const response = await fetch('/api/admin/compliance/permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, admin }),
      });

      if (response.ok) {
        // Update local state
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
        
        // Refresh all submissions for quick lookup
        const subsResponse = await fetch('/api/admin/submissions');
        const subsData = await subsResponse.json();
        if (subsData.success) {
          setAllSubmissions(subsData.data);
        }
      }
    } catch (error) {
      console.error('Failed to issue permit:', error);
      alert('Failed to issue permit');
    }
  };

  const handleMarkPickedUp = async (submissionId: string) => {
    try {
      const response = await fetch('/api/admin/compliance/permit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      });

      if (response.ok) {
        // Update local state
        setSubmissions(prev => prev.map(sub => {
          if (sub.id === submissionId) {
            return {
              ...sub,
              tenant_picked_up: true,
              tenant_picked_up_at: new Date().toISOString(),
            };
          }
          return sub;
        }));
        
        // Refresh all submissions for quick lookup
        const subsResponse = await fetch('/api/admin/submissions');
        const subsData = await subsResponse.json();
        if (subsData.success) {
          setAllSubmissions(subsData.data);
        }
      }
    } catch (error) {
      console.error('Failed to mark as picked up:', error);
      alert('Failed to mark as picked up');
    }
  };

  const handleExportVehicles = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/compliance/export-vehicles?building=${encodeURIComponent(selectedBuilding)}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicles_${selectedBuilding.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export vehicles:', error);
      alert('Failed to export vehicle data');
    } finally {
      setExporting(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'has_vehicle') return sub.has_vehicle;
    if (filter === 'missing_vehicle') return !sub.has_vehicle;
    if (filter === 'has_pets') return sub.has_pets;
    if (filter === 'missing_insurance') return !sub.has_insurance || sub.insurance_upload_pending;
    return true;
  });

  const getProgressPercentage = (count: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  const filteredBuildings = buildings.filter(building =>
    building.toLowerCase().includes(buildingSearch.toLowerCase())
  );

  if (loading && !selectedBuilding) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading buildings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Tenant Lookup */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border-2 border-blue-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-2xl">🔍</span>
          Quick Tenant Lookup
        </h2>
        <p className="text-sm text-gray-600 mb-3">Search across all buildings to quickly check if a tenant can get a permit</p>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, building, unit, phone, or email..."
            value={quickLookupQuery}
            onChange={(e) => setQuickLookupQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-lg border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Quick Lookup Results */}
        {quickLookupResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {quickLookupResults.map(result => (
              <div key={result.id} className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{result.full_name}</div>
                    <div className="text-sm text-gray-600">{result.building_address} - Unit {result.unit_number}</div>
                    {result.phone && <div className="text-sm text-gray-500">{result.phone}</div>}
                  </div>
                  <div className="ml-4">
                    {result.has_vehicle ? (
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.vehicle_verified && result.permit_issued
                            ? 'bg-green-100 text-green-800'
                            : result.vehicle_verified
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {result.permit_issued ? '🎫 Permit Issued' : result.vehicle_verified ? '✅ Can Issue Permit' : '⚠️ Needs Review'}
                        </div>
                        {result.has_vehicle && (
                          <div className="text-xs text-gray-600 mt-1">
                            {result.vehicle_year} {result.vehicle_make} {result.vehicle_model}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                        No Vehicle
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {quickLookupQuery.length >= 2 && quickLookupResults.length === 0 && (
          <div className="mt-4 text-center text-gray-500 py-4">
            No results found for "{quickLookupQuery}"
          </div>
        )}
      </div>

      {/* Building Selector with Progress */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Building to Review</h2>
        
        {/* Search Buildings */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Filter buildings..."
            value={buildingSearch}
            onChange={(e) => setBuildingSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={selectedBuilding}
          onChange={(e) => setSelectedBuilding(e.target.value)}
          className="w-full px-4 py-3 text-lg border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          size={10}
        >
          {filteredBuildings.map(building => {
            const progress = buildingProgress[building] || { percent: 0, status: 'none' };
            const assetId = buildingToAssetId[building] || '';
            const icon = progress.status === 'complete' ? '✅' : progress.status === 'partial' ? '🟡' : '⚪';
            return (
              <option key={building} value={building}>
                {icon} {assetId} - {building} ({progress.percent}%)
              </option>
            );
          })}
        </select>
        
        <div className="mt-2 text-sm text-gray-500">
          Showing {filteredBuildings.length} of {buildings.length} buildings
        </div>
      </div>

      {/* Progress Overview */}
      {stats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Compliance Overview: {selectedBuilding}
          </h2>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{stats.totalSubmissions}</div>
              <div className="text-sm text-gray-600">Total Submissions</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {stats.vehicleVerifiedCount + stats.petVerifiedCount + stats.insuranceVerifiedCount}
              </div>
              <div className="text-sm text-gray-600">Items Verified</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {(stats.vehicleCount - stats.vehicleVerifiedCount) + 
                 (stats.petCount - stats.petVerifiedCount) + 
                 (stats.insuranceCount - stats.insuranceVerifiedCount)}
              </div>
              <div className="text-sm text-gray-600">Needs Review</div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4">
            {/* Vehicles */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  🚗 Vehicles: {stats.vehicleCount}/{stats.totalSubmissions} ({getProgressPercentage(stats.vehicleCount, stats.totalSubmissions)}%)
                </span>
                <span className="text-xs text-gray-500">
                  {stats.vehicleVerifiedCount} verified
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${getProgressPercentage(stats.vehicleCount, stats.totalSubmissions)}%` }}
                />
              </div>
            </div>

            {/* Pets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  🐾 Pets: {stats.petCount}/{stats.totalSubmissions} ({getProgressPercentage(stats.petCount, stats.totalSubmissions)}%)
                </span>
                <span className="text-xs text-gray-500">
                  {stats.petVerifiedCount} verified
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all"
                  style={{ width: `${getProgressPercentage(stats.petCount, stats.totalSubmissions)}%` }}
                />
              </div>
            </div>

            {/* Insurance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  🛡️ Insurance: {stats.insuranceCount}/{stats.totalSubmissions} ({getProgressPercentage(stats.insuranceCount, stats.totalSubmissions)}%)
                </span>
                <span className="text-xs text-gray-500">
                  {stats.insuranceUploadedCount} uploaded, {stats.insurancePendingCount} pending
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${getProgressPercentage(stats.insuranceCount, stats.totalSubmissions)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleExportVehicles}
              disabled={exporting || stats.vehicleCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>📊</span>
              {exporting ? 'Exporting...' : 'Export Vehicle CSV for Printer'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          {[
            { value: 'all', label: 'All Tenants' },
            { value: 'has_vehicle', label: 'Has Vehicle' },
            { value: 'missing_vehicle', label: 'Missing Vehicle' },
            { value: 'has_pets', label: 'Has Pets' },
            { value: 'missing_insurance', label: 'Missing Insurance' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as any)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500">
            Showing {filteredSubmissions.length} of {submissions.length}
          </span>
        </div>
      </div>

      {/* Tenant List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-600">Loading submissions...</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            No submissions found for this building with the selected filter.
          </div>
        ) : (
          filteredSubmissions.map(submission => (
            <TenantComplianceCard
              key={submission.id}
              submission={submission}
              onVerify={handleVerify}
              onIssuePermit={handleIssuePermit}
              onMarkPickedUp={handleMarkPickedUp}
              onUpdateNotes={handleUpdateNotes}
            />
          ))
        )}
      </div>
    </div>
  );
}
