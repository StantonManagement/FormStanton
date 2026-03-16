'use client';

import { useState } from 'react';
import SubmissionEditModal from './SubmissionEditModal';

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
  pet_addendum_file?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiration_date?: string;
  insurance_file?: string;
  insurance_type?: 'renters' | 'car' | 'other';
  insurance_upload_pending: boolean;
  add_insurance_to_rent?: boolean;
  insurance_verified: boolean;
  pet_addendum_received?: boolean;
  pet_addendum_received_at?: string;
  pet_addendum_received_by?: string;
  vehicle_addendum_received?: boolean;
  vehicle_addendum_received_at?: string;
  vehicle_addendum_received_by?: string;
  vehicle_notes?: string;
  pet_notes?: string;
  insurance_notes?: string;
  admin_notes?: string;
  last_reviewed_at?: string;
  created_at: string;
}

interface TenantComplianceCardProps {
  submission: TenantSubmission;
  onVerify: (submissionId: string, itemType: 'vehicle' | 'pet' | 'insurance', verified: boolean) => void;
  onUpdateNotes: (submissionId: string, notes: string) => void;
  onIssuePermit?: (submissionId: string, admin: string) => void;
  onMarkPickedUp?: (submissionId: string) => void;
  onRefresh?: () => void;
}

const ADMIN_USERS = ['Alex', 'Dean', 'Dan', 'Tiff'];

export default function TenantComplianceCard({ submission, onVerify, onUpdateNotes, onIssuePermit, onMarkPickedUp, onRefresh }: TenantComplianceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(submission.admin_notes || '');
  const [editingVehicleNotes, setEditingVehicleNotes] = useState(false);
  const [vehicleNotes, setVehicleNotes] = useState(submission.vehicle_notes || '');
  const [editingPetNotes, setEditingPetNotes] = useState(false);
  const [petNotes, setPetNotes] = useState(submission.pet_notes || '');
  const [editingInsuranceNotes, setEditingInsuranceNotes] = useState(false);
  const [insuranceNotes, setInsuranceNotes] = useState(submission.insurance_notes || '');
  const [showPermitModal, setShowPermitModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isTogglingExport, setIsTogglingExport] = useState(false);

  const handleSaveNotes = () => {
    onUpdateNotes(submission.id, notes);
    setEditingNotes(false);
  };

  const handleSaveVehicleNotes = async () => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          itemType: 'vehicle',
          vehicleNotes: vehicleNotes,
        }),
      });
      if (response.ok && onRefresh) {
        onRefresh();
      }
      setEditingVehicleNotes(false);
    } catch (error) {
      console.error('Error saving vehicle notes:', error);
    }
  };

  const handleSavePetNotes = async () => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          itemType: 'pet',
          petNotes: petNotes,
        }),
      });
      if (response.ok && onRefresh) {
        onRefresh();
      }
      setEditingPetNotes(false);
    } catch (error) {
      console.error('Error saving pet notes:', error);
    }
  };

  const handleSaveInsuranceNotes = async () => {
    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          itemType: 'insurance',
          insuranceNotes: insuranceNotes,
        }),
      });
      if (response.ok && onRefresh) {
        onRefresh();
      }
      setEditingInsuranceNotes(false);
    } catch (error) {
      console.error('Error saving insurance notes:', error);
    }
  };

  const handleToggleExport = async () => {
    setIsTogglingExport(true);
    try {
      const response = await fetch('/api/admin/compliance/toggle-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          exported: !submission.vehicle_exported,
          adminName: selectedAdmin || 'Admin'
        }),
      });

      const data = await response.json();
      if (data.success && onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error toggling export status:', error);
    } finally {
      setIsTogglingExport(false);
    }
  };

  const getInsuranceStatus = () => {
    if (submission.insurance_file) return 'Uploaded';
    if (submission.insurance_upload_pending) return 'Pending';
    if (submission.add_insurance_to_rent) return 'Added to Rent';
    return 'N/A';
  };

  const isInsuranceExpired = () => {
    if (!submission.insurance_expiration_date) return false;
    const expirationDate = new Date(submission.insurance_expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expirationDate < today;
  };

  const isInsuranceExpiringSoon = () => {
    if (!submission.insurance_expiration_date) return false;
    const expirationDate = new Date(submission.insurance_expiration_date);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    return expirationDate >= today && expirationDate <= thirtyDaysFromNow;
  };

  const getPetCount = () => {
    if (!submission.pets) return 0;
    return Array.isArray(submission.pets) ? submission.pets.length : 0;
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header - Always Visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Unit {submission.unit_number}
              </h3>
              <span className="text-sm text-gray-600">
                {submission.full_name}
              </span>
            </div>

            {/* Quick Status Summary */}
            <div className="flex items-center gap-4 text-sm">
              {/* Vehicle */}
              <div className="flex items-center gap-1">
                {submission.has_vehicle ? (
                  <>
                    <span className={`${submission.vehicle_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                      {submission.vehicle_verified ? '✅' : '⚠️'}
                    </span>
                    <span className="text-gray-700">
                      🚗 {submission.vehicle_make} {submission.vehicle_model}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">🚗 No vehicle</span>
                )}
              </div>

              {/* Pets */}
              <div className="flex items-center gap-1">
                {submission.has_pets ? (
                  <>
                    <span className={`${submission.pet_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                      {submission.pet_verified ? '✅' : '⚠️'}
                    </span>
                    <span className="text-gray-700">
                      🐾 {getPetCount()} pet{getPetCount() !== 1 ? 's' : ''}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">🐾 No pets</span>
                )}
              </div>

              {/* Insurance */}
              <div className="flex items-center gap-1">
                {submission.has_insurance ? (
                  <>
                    <span className={`${submission.insurance_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                      {submission.insurance_verified ? '✅' : '⚠️'}
                    </span>
                    <span className="text-gray-700">
                      🛡️ {getInsuranceStatus()}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">🛡️ No insurance</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }}
              className="text-blue-600 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded transition-colors"
              title="Edit submission"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <svg 
                className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Phone:</span>
              <span className="ml-2 text-gray-900">{submission.phone}</span>
            </div>
            <div>
              <span className="text-gray-500">Email:</span>
              <span className="ml-2 text-gray-900">{submission.email}</span>
            </div>
          </div>

          {/* Vehicle Details */}
          {submission.has_vehicle && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">🚗 Vehicle Information</h4>
                  {submission.vehicle_submitted_by_phone && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                      📞 Phone Entry
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerify(submission.id, 'vehicle', !submission.vehicle_verified);
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      submission.vehicle_verified
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {submission.vehicle_verified ? '✓ Verified' : 'Mark Verified'}
                  </button>
                  
                  {submission.vehicle_verified && !submission.permit_issued && onIssuePermit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPermitModal(true);
                      }}
                      className="px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      🎫 Issue Permit
                    </button>
                  )}
                  
                  {submission.permit_issued && !submission.tenant_picked_up && onMarkPickedUp && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkPickedUp(submission.id);
                      }}
                      className="px-3 py-1 rounded text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      Mark Picked Up
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div><span className="text-gray-500">Make:</span> <span className="ml-1">{submission.vehicle_make}</span></div>
                <div><span className="text-gray-500">Model:</span> <span className="ml-1">{submission.vehicle_model}</span></div>
                <div><span className="text-gray-500">Year:</span> <span className="ml-1">{submission.vehicle_year}</span></div>
                <div><span className="text-gray-500">Color:</span> <span className="ml-1">{submission.vehicle_color}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Plate:</span> <span className="ml-1 font-mono">{submission.vehicle_plate}</span></div>
              </div>
              
              {/* Phone Submission Info */}
              {submission.vehicle_submitted_by_phone && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">📞 Submitted by phone</span>
                    {submission.vehicle_phone_submission_by && (
                      <span className="text-gray-600"> • Entered by {submission.vehicle_phone_submission_by}</span>
                    )}
                    {submission.vehicle_phone_submission_date && (
                      <span className="text-gray-500 text-xs ml-2">
                        {new Date(submission.vehicle_phone_submission_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    No signature required for phone submissions
                  </div>
                </div>
              )}
              
              {/* Permit Status */}
              {submission.permit_issued && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">🎫 Permit Issued</span>
                    {submission.permit_issued_by && (
                      <span className="text-gray-500">by {submission.permit_issued_by}</span>
                    )}
                    {submission.permit_issued_at && (
                      <span className="text-gray-400 text-xs">
                        {new Date(submission.permit_issued_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {submission.tenant_picked_up && (
                    <div className="text-sm text-purple-600 mt-1">
                      ✓ Picked up {submission.tenant_picked_up_at && `on ${new Date(submission.tenant_picked_up_at).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              )}
              
              {/* Export Status */}
              {submission.has_vehicle && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {submission.vehicle_exported ? (
                        <>
                          <span className="text-blue-600 font-medium">📤 Exported</span>
                          {submission.vehicle_exported_by && (
                            <span className="text-gray-500">by {submission.vehicle_exported_by}</span>
                          )}
                          {submission.vehicle_exported_at && (
                            <span className="text-gray-400 text-xs">
                              {new Date(submission.vehicle_exported_at).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-600 font-medium">⚠️ Not exported</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExport();
                      }}
                      disabled={isTogglingExport}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors disabled:opacity-50"
                    >
                      {isTogglingExport ? 'Updating...' : (submission.vehicle_exported ? 'Mark Not Exported' : 'Mark Exported')}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Vehicle Notes */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-medium text-gray-700">Vehicle Notes</h5>
                  {!editingVehicleNotes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVehicleNotes(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {vehicleNotes ? 'Edit' : 'Add Note'}
                    </button>
                  )}
                </div>
                {editingVehicleNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={vehicleNotes}
                      onChange={(e) => setVehicleNotes(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Add notes about vehicle compliance..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveVehicleNotes();
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVehicleNotes(submission.vehicle_notes || '');
                          setEditingVehicleNotes(false);
                        }}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    {vehicleNotes || 'No notes'}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Permit Issuance Modal */}
          {showPermitModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPermitModal(false)}>
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Issue Parking Permit</h3>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Tenant: <span className="font-medium">{submission.full_name}</span></p>
                  <p className="text-sm text-gray-600 mb-2">Vehicle: <span className="font-medium">{submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}</span></p>
                  <p className="text-sm text-gray-600">Plate: <span className="font-mono font-medium">{submission.vehicle_plate}</span></p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issued by:
                  </label>
                  <select
                    value={selectedAdmin}
                    onChange={(e) => setSelectedAdmin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select admin...</option>
                    {ADMIN_USERS.map(admin => (
                      <option key={admin} value={admin}>{admin}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPermitModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedAdmin && onIssuePermit) {
                        onIssuePermit(submission.id, selectedAdmin);
                        setShowPermitModal(false);
                        setSelectedAdmin('');
                      }
                    }}
                    disabled={!selectedAdmin}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Issue Permit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pet Details */}
          {submission.has_pets && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">🐾 Pet Information</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerify(submission.id, 'pet', !submission.pet_verified);
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    submission.pet_verified
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {submission.pet_verified ? '✓ Verified' : 'Mark Verified'}
                </button>
              </div>
              {submission.pets && Array.isArray(submission.pets) && submission.pets.map((pet: any, idx: number) => (
                <div key={idx} className="text-sm mb-2 pb-2 border-b border-gray-100 last:border-0">
                  <div className="font-medium">{pet.pet_name} ({pet.pet_type})</div>
                  <div className="text-gray-600">
                    {pet.pet_breed} • {pet.pet_weight} lbs • {pet.pet_color}
                  </div>
                </div>
              ))}
              
              {/* Pet Notes */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-medium text-gray-700">Pet Notes</h5>
                  {!editingPetNotes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPetNotes(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {petNotes ? 'Edit' : 'Add Note'}
                    </button>
                  )}
                </div>
                {editingPetNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={petNotes}
                      onChange={(e) => setPetNotes(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Add notes about pet compliance..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavePetNotes();
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPetNotes(submission.pet_notes || '');
                          setEditingPetNotes(false);
                        }}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    {petNotes || 'No notes'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Insurance Details */}
          {submission.has_insurance && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">🛡️ Insurance Information</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerify(submission.id, 'insurance', !submission.insurance_verified);
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    submission.insurance_verified
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {submission.insurance_verified ? '✓ Verified' : 'Mark Verified'}
                </button>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-gray-500">Provider:</span> <span className="ml-1">{submission.insurance_provider}</span></div>
                <div><span className="text-gray-500">Policy:</span> <span className="ml-1">{submission.insurance_policy_number}</span></div>
                {submission.insurance_expiration_date && (
                  <div>
                    <span className="text-gray-500">Expires:</span> 
                    <span className={`ml-1 ${isInsuranceExpired() ? 'text-red-600 font-medium' : isInsuranceExpiringSoon() ? 'text-yellow-600 font-medium' : ''}`}>
                      {new Date(submission.insurance_expiration_date).toLocaleDateString()}
                      {isInsuranceExpired() && ' ⚠️ EXPIRED'}
                      {!isInsuranceExpired() && isInsuranceExpiringSoon() && ' ⚠️ Expiring Soon'}
                    </span>
                  </div>
                )}
                <div><span className="text-gray-500">Status:</span> <span className="ml-1">{getInsuranceStatus()}</span></div>
              </div>
              
              {/* Insurance Notes */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-medium text-gray-700">Insurance Notes</h5>
                  {!editingInsuranceNotes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingInsuranceNotes(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {insuranceNotes ? 'Edit' : 'Add Note'}
                    </button>
                  )}
                </div>
                {editingInsuranceNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={insuranceNotes}
                      onChange={(e) => setInsuranceNotes(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Add notes about insurance compliance..."
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveInsuranceNotes();
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInsuranceNotes(submission.insurance_notes || '');
                          setEditingInsuranceNotes(false);
                        }}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    {insuranceNotes || 'No notes'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">📝 Admin Notes</h4>
              {!editingNotes && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingNotes(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {submission.admin_notes ? 'Edit' : 'Add Note'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add notes about this tenant..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveNotes();
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotes(submission.admin_notes || '');
                      setEditingNotes(false);
                    }}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                {submission.admin_notes || <span className="italic text-gray-400">No notes yet</span>}
              </div>
            )}
          </div>

          {/* Submission Date */}
          <div className="text-xs text-gray-500">
            Submitted: {new Date(submission.created_at).toLocaleString()}
            {submission.last_reviewed_at && (
              <span className="ml-3">
                Last reviewed: {new Date(submission.last_reviewed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <SubmissionEditModal
          submission={submission}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
