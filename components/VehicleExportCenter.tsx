'use client';

import { useState, useMemo } from 'react';
import { buildingToAssetId } from '@/lib/buildingAssetIds';
import { buildingToPortfolio, portfolioOrder } from '@/lib/portfolios';
import { normalizeAddress, filterByBuilding } from '@/lib/addressNormalizer';

interface TenantSubmission {
  id: string;
  full_name: string;
  unit_number: string;
  building_address: string;
  has_vehicle: boolean;
  vehicle_verified: boolean;
  vehicle_exported?: boolean;
  vehicle_exported_at?: string;
  vehicle_exported_by?: string;
  merged_into?: string;
  [key: string]: any;
}

interface VehicleExportCenterProps {
  allSubmissions: TenantSubmission[];
  buildings: string[];
  onClose: () => void;
  onExportComplete: () => void;
}

const ADMIN_NAMES = ['Alex', 'Dean', 'Dan', 'Tiff'];

interface BuildingExportInfo {
  address: string;
  assetId: string;
  portfolio: string;
  totalVehicles: number;
  verifiedVehicles: number;
  exportedCount: number;
  unexportedVerifiedCount: number;
  lastExportedAt: string | null;
  lastExportedBy: string | null;
}

export default function VehicleExportCenter({
  allSubmissions,
  buildings,
  onClose,
  onExportComplete,
}: VehicleExportCenterProps) {
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [adminName, setAdminName] = useState<string>(ADMIN_NAMES[0]);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);

  const buildingInfos = useMemo(() => {
    const infos: BuildingExportInfo[] = [];

    for (const building of buildings) {
      const subs = filterByBuilding(allSubmissions, building).filter(s => !s.merged_into);
      const vehicleSubs = subs.filter(s => s.has_vehicle);
      const verifiedSubs = vehicleSubs.filter(s => s.vehicle_verified);
      const exportedSubs = vehicleSubs.filter(s => s.vehicle_exported);
      const unexportedVerified = verifiedSubs.filter(s => !s.vehicle_exported);

      const lastExported = exportedSubs
        .filter(s => s.vehicle_exported_at)
        .sort((a, b) => new Date(b.vehicle_exported_at!).getTime() - new Date(a.vehicle_exported_at!).getTime())[0];

      infos.push({
        address: building,
        assetId: buildingToAssetId[building] || '',
        portfolio: buildingToPortfolio[building] || 'Other',
        totalVehicles: vehicleSubs.length,
        verifiedVehicles: verifiedSubs.length,
        exportedCount: exportedSubs.length,
        unexportedVerifiedCount: unexportedVerified.length,
        lastExportedAt: lastExported?.vehicle_exported_at || null,
        lastExportedBy: lastExported?.vehicle_exported_by || null,
      });
    }

    return infos;
  }, [allSubmissions, buildings]);

  const groupedByPortfolio = useMemo(() => {
    const groups: Record<string, BuildingExportInfo[]> = {};
    for (const portfolio of portfolioOrder) {
      const items = buildingInfos.filter(b => b.portfolio === portfolio);
      if (items.length > 0) {
        groups[portfolio] = items;
      }
    }
    // Any remaining buildings not in portfolioOrder
    const covered = new Set(portfolioOrder);
    const other = buildingInfos.filter(b => !covered.has(b.portfolio));
    if (other.length > 0) {
      groups['Other'] = other;
    }
    return groups;
  }, [buildingInfos]);

  const selectableBuildings = useMemo(
    () => new Set(buildingInfos.filter(b => b.verifiedVehicles > 0).map(b => b.address)),
    [buildingInfos]
  );

  const selectedSummary = useMemo(() => {
    let totalVerified = 0;
    for (const addr of selectedBuildings) {
      const info = buildingInfos.find(b => b.address === addr);
      if (info) totalVerified += info.verifiedVehicles;
    }
    return { buildingCount: selectedBuildings.size, vehicleCount: totalVerified };
  }, [selectedBuildings, buildingInfos]);

  const toggleBuilding = (address: string) => {
    if (!selectableBuildings.has(address)) return;
    setSelectedBuildings(prev => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedBuildings(new Set(selectableBuildings));
  };

  const selectUnexported = () => {
    const unexported = buildingInfos
      .filter(b => b.unexportedVerifiedCount > 0)
      .map(b => b.address);
    setSelectedBuildings(new Set(unexported));
  };

  const clearSelection = () => {
    setSelectedBuildings(new Set());
  };

  const handleExport = async () => {
    if (selectedBuildings.size === 0) return;
    setExporting(true);
    setExportResult(null);

    try {
      const buildingsParam = Array.from(selectedBuildings).join(',');
      const url = `/api/admin/compliance/export-vehicles?buildings=${encodeURIComponent(buildingsParam)}&admin=${encodeURIComponent(adminName)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `vehicles_${selectedBuildings.size}_buildings_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setExportResult({
        success: true,
        message: `Exported ${selectedSummary.vehicleCount} vehicles from ${selectedSummary.buildingCount} buildings`,
      });

      onExportComplete();
    } catch (error: any) {
      setExportResult({
        success: false,
        message: error.message || 'Export failed',
      });
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Vehicle Export Center</h2>
            <p className="text-xs text-gray-500 mt-0.5">Only verified vehicles are included in exports</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-700">Admin:</label>
            <select
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="text-sm border border-gray-300 px-2 py-1 rounded-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ADMIN_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs px-2.5 py-1 border border-gray-300 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Select All
            </button>
            <button
              onClick={selectUnexported}
              className="text-xs px-2.5 py-1 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors font-medium text-amber-800"
            >
              Select Unexported
            </button>
            {selectedBuildings.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Building List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {Object.entries(groupedByPortfolio).map(([portfolio, infos]) => (
            <div key={portfolio} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">
                {portfolio}
              </h3>
              <div className="space-y-1">
                {infos.map(info => {
                  const isSelectable = info.verifiedVehicles > 0;
                  const isSelected = selectedBuildings.has(info.address);
                  const hasUnexported = info.unexportedVerifiedCount > 0;

                  return (
                    <button
                      key={info.address}
                      onClick={() => toggleBuilding(info.address)}
                      disabled={!isSelectable}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50'
                          : isSelectable
                            ? 'border-gray-200 bg-white hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Checkbox */}
                      <span className={`text-base flex-shrink-0 ${
                        isSelected ? 'text-blue-600' : isSelectable ? 'text-gray-400' : 'text-gray-300'
                      }`}>
                        {isSelected ? '☑' : '☐'}
                      </span>

                      {/* Building info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${isSelectable ? 'text-gray-900' : 'text-gray-400'}`}>
                            {info.address}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{info.assetId}</span>
                        </div>
                      </div>

                      {/* Vehicle counts */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-medium ${
                          info.verifiedVehicles > 0 ? 'text-emerald-700' : 'text-gray-400'
                        }`}>
                          {info.verifiedVehicles} verified
                          {info.totalVehicles > info.verifiedVehicles && (
                            <span className="text-gray-400 font-normal"> / {info.totalVehicles} total</span>
                          )}
                        </span>

                        {/* Export status */}
                        {info.totalVehicles === 0 ? (
                          <span className="text-xs text-gray-400 w-28 text-right">No vehicles</span>
                        ) : info.unexportedVerifiedCount > 0 ? (
                          <span className="text-xs text-amber-700 font-medium w-28 text-right">
                            ⚠️ {info.unexportedVerifiedCount} new
                          </span>
                        ) : info.exportedCount > 0 ? (
                          <span className="text-xs text-emerald-600 w-28 text-right" title={
                            info.lastExportedAt ? `Last: ${formatDate(info.lastExportedAt)} by ${info.lastExportedBy}` : ''
                          }>
                            ✓ All exported
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 w-28 text-right">Not exported</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Export result message */}
        {exportResult && (
          <div className={`px-6 py-2 text-sm font-medium ${
            exportResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}>
            {exportResult.success ? '✓' : '✕'} {exportResult.message}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="text-sm text-gray-700">
            {selectedBuildings.size > 0 ? (
              <span>
                <span className="font-semibold">{selectedSummary.buildingCount}</span> building{selectedSummary.buildingCount !== 1 ? 's' : ''} · <span className="font-semibold">{selectedSummary.vehicleCount}</span> verified vehicle{selectedSummary.vehicleCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-gray-400">Select buildings to export</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedBuildings.size === 0 || exporting}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                selectedBuildings.size === 0 || exporting
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {exporting ? 'Exporting...' : 'Export Selected as CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
