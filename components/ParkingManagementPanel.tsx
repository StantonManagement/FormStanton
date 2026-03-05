'use client';

import { useState, useEffect } from 'react';
import { ParkingAvailability, AdditionalVehicleRequest, getParkingStatusIndicator } from '@/lib/parkingAnalytics';

interface ParkingManagementPanelProps {
  buildingAddress: string;
  onRefresh?: () => void;
}

export default function ParkingManagementPanel({ buildingAddress, onRefresh }: ParkingManagementPanelProps) {
  const [availability, setAvailability] = useState<ParkingAvailability | null>(null);
  const [requests, setRequests] = useState<AdditionalVehicleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [denyingId, setDenyingId] = useState<string | null>(null);

  useEffect(() => {
    if (buildingAddress) {
      fetchParkingData();
    }
  }, [buildingAddress]);

  const fetchParkingData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/compliance/parking-availability?building=${encodeURIComponent(buildingAddress)}`);
      const data = await response.json();

      if (data.success) {
        setAvailability(data.availability);
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch parking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submissionId: string) => {
    if (!adminName.trim()) {
      alert('Please enter your name before approving');
      return;
    }

    setProcessing(submissionId);
    try {
      const response = await fetch('/api/admin/compliance/approve-additional-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, admin: adminName }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Additional vehicle approved successfully!');
        await fetchParkingData();
        if (onRefresh) onRefresh();
      } else {
        alert(`Failed to approve: ${data.message}`);
      }
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve additional vehicle');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeny = async (submissionId: string) => {
    if (!denialReason.trim()) {
      alert('Please enter a reason for denial');
      return;
    }

    setProcessing(submissionId);
    try {
      const response = await fetch('/api/admin/compliance/deny-additional-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, reason: denialReason }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Additional vehicle request denied');
        setDenyingId(null);
        setDenialReason('');
        await fetchParkingData();
        if (onRefresh) onRefresh();
      } else {
        alert(`Failed to deny: ${data.message}`);
      }
    } catch (error) {
      console.error('Denial error:', error);
      alert('Failed to deny additional vehicle');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return null; // Don't show loading state
  }

  if (!availability) {
    return null; // Don't render if no availability data
  }

  const statusIndicator = getParkingStatusIndicator(availability);
  const pendingRequests = requests.filter(r => !r.approved && !r.denied);
  const approvedRequests = requests.filter(r => r.approved);
  const deniedRequests = requests.filter(r => r.denied);

  // Don't render if there are no requests at all
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Parking Availability Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">🅿️ Parking Availability</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-xs text-gray-500 mb-1">Total Spots</div>
            <div className="text-2xl font-bold text-gray-900">
              {availability.isStreetParking ? 'Street' : availability.totalSpots}
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-xs text-blue-600 mb-1">Primary Permits</div>
            <div className="text-2xl font-bold text-blue-900">{availability.primaryPermitsIssued}</div>
          </div>
          
          <div className="bg-green-50 p-3 rounded">
            <div className="text-xs text-green-600 mb-1">Additional Approved</div>
            <div className="text-2xl font-bold text-green-900">{availability.additionalPermitsApproved}</div>
          </div>
          
          <div className={`bg-${statusIndicator.color}-50 p-3 rounded`}>
            <div className={`text-xs text-${statusIndicator.color}-600 mb-1`}>Available</div>
            <div className={`text-2xl font-bold text-${statusIndicator.color}-900`}>
              {statusIndicator.emoji} {availability.isStreetParking ? '∞' : availability.availableSpots}
            </div>
          </div>
        </div>

        {/* Capacity Bar */}
        {!availability.isStreetParking && typeof availability.totalSpots === 'number' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Capacity</span>
              <span>{availability.primaryPermitsIssued + availability.additionalPermitsApproved} / {availability.totalSpots}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  availability.availableSpots === 0 ? 'bg-red-500' :
                  availability.availableSpots <= 2 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min(100, ((availability.primaryPermitsIssued + availability.additionalPermitsApproved) / availability.totalSpots) * 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Admin Name Input */}
      {pendingRequests.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Admin Name (for approvals)
          </label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            ⏳ Pending Additional Vehicle Requests ({pendingRequests.length})
          </h4>
          
          <div className="space-y-3">
            {pendingRequests.map((request, index) => (
              <div key={request.submissionId} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {request.tenantName} - Unit {request.unitNumber}
                    </div>
                    <div className="text-sm text-gray-600">
                      Requested: {new Date(request.requestedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Position in queue: #{index + 1}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Primary Vehicle:</div>
                  <div className="text-sm text-gray-700">
                    {request.primaryVehicle.year} {request.primaryVehicle.make} {request.primaryVehicle.model} ({request.primaryVehicle.plate})
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Additional Vehicle(s) Requested:</div>
                  {request.additionalVehicles.map((av, idx) => (
                    <div key={idx} className="text-sm text-gray-700 bg-white p-2 rounded mb-1">
                      {av.vehicle_year} {av.vehicle_make} {av.vehicle_model} - {av.vehicle_color} ({av.vehicle_plate})
                    </div>
                  ))}
                </div>

                {denyingId === request.submissionId ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={denialReason}
                      onChange={(e) => setDenialReason(e.target.value)}
                      placeholder="Reason for denial"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeny(request.submissionId)}
                        disabled={processing === request.submissionId}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm"
                      >
                        Confirm Deny
                      </button>
                      <button
                        onClick={() => {
                          setDenyingId(null);
                          setDenialReason('');
                        }}
                        className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.submissionId)}
                      disabled={!availability.canApproveMore || processing === request.submissionId}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                    >
                      {processing === request.submissionId ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={() => setDenyingId(request.submissionId)}
                      disabled={processing === request.submissionId}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
                    >
                      ✗ Deny
                    </button>
                  </div>
                )}

                {!availability.canApproveMore && !availability.isStreetParking && (
                  <div className="mt-2 text-xs text-red-600 font-medium">
                    ⚠️ No parking spots available. Cannot approve at this time.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            ✅ Approved Additional Vehicles ({approvedRequests.length})
          </h4>
          <div className="space-y-2">
            {approvedRequests.map((request) => (
              <div key={request.submissionId} className="bg-green-50 border border-green-200 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {request.tenantName} - Unit {request.unitNumber}
                    </div>
                    <div className="text-sm text-gray-600">
                      {request.additionalVehicles.length} additional vehicle(s)
                    </div>
                  </div>
                  <div className="text-xs text-green-600">
                    ✓ Approved
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Denied Requests */}
      {deniedRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            ✗ Denied Requests ({deniedRequests.length})
          </h4>
          <div className="space-y-2">
            {deniedRequests.map((request) => (
              <div key={request.submissionId} className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {request.tenantName} - Unit {request.unitNumber}
                    </div>
                    {request.denialReason && (
                      <div className="text-sm text-gray-600 mt-1">
                        Reason: {request.denialReason}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-red-600">
                    ✗ Denied
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length === 0 && approvedRequests.length === 0 && deniedRequests.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-lg mb-2">🚗</div>
          <div className="text-gray-600">No additional vehicle requests for this building</div>
        </div>
      )}
    </div>
  );
}
