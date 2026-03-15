'use client';

import { useState, useEffect } from 'react';
import { FormPhoneInput } from '@/components/form';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScanExtraction {
  id: string;
  batch_id: string;
  page_number: number;
  scan_image_path: string;
  scan_pdf_path: string;
  extracted_data: any;
  confidence: string;
  reviewed: boolean;
  final_data: any;
}

interface ScanReviewInterfaceProps {
  batchId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

interface TenantVerification {
  found: boolean;
  tenants?: Array<{
    name: string;
    firstName: string;
    lastName: string;
    email: string | null;
  }>;
  property?: {
    name: string;
    address: string;
  };
  unit?: string;
  message?: string;
}

export default function ScanReviewInterface({ batchId, onClose, onImportComplete }: ScanReviewInterfaceProps) {
  const [extractions, setExtractions] = useState<ScanExtraction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [tenantVerification, setTenantVerification] = useState<TenantVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);

  useEffect(() => {
    fetchExtractions();
  }, [batchId]);

  useEffect(() => {
    if (extractions.length > 0) {
      loadCurrentExtraction();
    }
  }, [currentIndex, extractions]);

  const fetchExtractions = async () => {
    try {
      const response = await fetch(`/api/admin/scan-extractions?batchId=${batchId}`);
      const result = await response.json();
      if (result.success) {
        setExtractions(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch extractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentExtraction = async () => {
    const extraction = extractions[currentIndex];
    if (!extraction) return;

    // Load image
    const { data } = supabase.storage
      .from('submissions')
      .getPublicUrl(extraction.scan_image_path);
    
    setImageUrl(data.publicUrl);

    // Load form data (use final_data if reviewed, otherwise extracted_data)
    const data_to_use = extraction.final_data || extraction.extracted_data || {};
    setFormData({
      full_name: data_to_use.full_name || '',
      phone: data_to_use.phone || '',
      email: data_to_use.email || '',
      building_address: data_to_use.building_address || '',
      unit_number: data_to_use.unit_number || '',
      has_pets: data_to_use.has_pets || false,
      pets: data_to_use.pets || [],
      has_insurance: data_to_use.has_insurance || false,
      insurance_provider: data_to_use.insurance_provider || '',
      insurance_policy_number: data_to_use.insurance_policy_number || '',
      has_vehicle: data_to_use.has_vehicle || false,
      vehicle_make: data_to_use.vehicle_make || '',
      vehicle_model: data_to_use.vehicle_model || '',
      vehicle_year: data_to_use.vehicle_year || '',
      vehicle_color: data_to_use.vehicle_color || '',
      vehicle_plate: data_to_use.vehicle_plate || '',
    });

    // Lookup tenant verification if we have building and unit
    if (data_to_use.building_address && data_to_use.unit_number) {
      await lookupTenant(data_to_use.building_address, data_to_use.unit_number);
    } else {
      setTenantVerification(null);
    }
  };

  const lookupTenant = async (building: string, unit: string) => {
    setVerificationLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tenant-lookup?building=${encodeURIComponent(building)}&unit=${encodeURIComponent(unit)}`
      );
      const result = await response.json();
      if (result.success) {
        setTenantVerification(result);
      } else {
        setTenantVerification(null);
      }
    } catch (error) {
      console.error('Tenant lookup failed:', error);
      setTenantVerification(null);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleSave = async (markReviewed: boolean = false) => {
    setSaving(true);
    try {
      const extraction = extractions[currentIndex];
      const response = await fetch('/api/admin/scan-extractions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractionId: extraction.id,
          finalData: formData,
          reviewed: markReviewed,
          reviewedBy: 'admin',
        }),
      });

      if (response.ok) {
        // Update local state
        const updatedExtractions = [...extractions];
        updatedExtractions[currentIndex] = {
          ...updatedExtractions[currentIndex],
          final_data: formData,
          reviewed: markReviewed,
        };
        setExtractions(updatedExtractions);
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    await handleSave(true);
    if (currentIndex < extractions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleImportAll = async () => {
    if (!confirm('Import all reviewed submissions to the database?')) return;

    setImporting(true);
    try {
      const response = await fetch('/api/admin/import-scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`Successfully imported ${result.imported} submission(s)!`);
        onImportComplete();
      } else {
        alert(`Import failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading extractions...</div>;
  }

  if (extractions.length === 0) {
    return <div className="p-8 text-center">No extractions found</div>;
  }

  const currentExtraction = extractions[currentIndex];
  const reviewedCount = extractions.filter(e => e.reviewed).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Scan Review - Page {currentIndex + 1} of {extractions.length}</h2>
            <p className="text-sm text-gray-600">
              Reviewed: {reviewedCount} / {extractions.length}
              {currentExtraction.confidence && (
                <span className={`ml-4 px-2 py-1 rounded text-xs ${
                  currentExtraction.confidence === 'high' ? 'bg-green-100 text-green-800' :
                  currentExtraction.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Confidence: {currentExtraction.confidence}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Scanned Image */}
          <div className="w-1/2 p-4 border-r overflow-auto bg-gray-50">
            <div className="sticky top-0 bg-gray-50 pb-2">
              <h3 className="font-semibold mb-2">Scanned Form</h3>
            </div>
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt={`Page ${currentIndex + 1}`}
                className="w-full border shadow-sm"
              />
            )}
          </div>

          {/* Right: Extracted Data Form */}
          <div className="w-1/2 p-4 overflow-auto">
            <div className="sticky top-0 bg-white pb-2 mb-4 border-b">
              <h3 className="font-semibold">Extracted Data</h3>
              {currentExtraction.reviewed && (
                <span className="text-sm text-green-600">✓ Reviewed</span>
              )}
            </div>

            {/* Tenant Verification Section */}
            {formData && formData.building_address && formData.unit_number && (
              <div className="mb-4 p-3 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Tenant Verification</h4>
                {verificationLoading ? (
                  <div className="text-sm text-gray-500">Checking tenant roster...</div>
                ) : tenantVerification ? (
                  tenantVerification.found ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 font-bold text-lg">✓</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-700">Tenant Found</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {tenantVerification.property?.address} - Unit {tenantVerification.unit}
                          </div>
                          {tenantVerification.tenants && tenantVerification.tenants.map((tenant, idx) => {
                            const scannedName = formData.full_name?.toLowerCase().trim() || '';
                            const tenantName = tenant.name.toLowerCase().trim();
                            const isMatch = scannedName === tenantName || 
                                          scannedName.includes(tenant.lastName.toLowerCase()) ||
                                          tenantName.includes(scannedName);
                            return (
                              <div key={idx} className={`mt-2 p-2 rounded text-sm ${
                                isMatch ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                              }`}>
                                <div className="font-medium">
                                  {isMatch ? '✓' : '⚠️'} {tenant.name}
                                </div>
                                {tenant.email && (
                                  <div className="text-xs text-gray-600">{tenant.email}</div>
                                )}
                                {!isMatch && (
                                  <div className="text-xs text-yellow-700 mt-1">
                                    Name mismatch with scanned: "{formData.full_name}"
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-600 font-bold text-lg">⚠️</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-yellow-700">No Tenant Found</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {tenantVerification.message || 'No matching tenant in roster'}
                        </div>
                        {tenantVerification.property && (
                          <div className="text-xs text-gray-500 mt-1">
                            Property: {tenantVerification.property.address}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-sm text-gray-500">Unable to verify tenant</div>
                )}
              </div>
            )}

            {formData && (
              <div className="space-y-4">
                {/* Resident Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700">Resident Information</h4>
                  
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  />
                  
                  <FormPhoneInput
                    value={formData.phone}
                    onChange={(digits) => setFormData({...formData, phone: digits})}
                    placeholder="(860) 555-0123"
                  />
                  
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  />
                  
                  <input
                    type="text"
                    placeholder="Building Address"
                    value={formData.building_address}
                    onChange={(e) => setFormData({...formData, building_address: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  />
                  
                  <input
                    type="text"
                    placeholder="Unit Number"
                    value={formData.unit_number}
                    onChange={(e) => setFormData({...formData, unit_number: e.target.value})}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                {/* Pets */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-gray-700">Pets</h4>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.has_pets}
                      onChange={(e) => setFormData({...formData, has_pets: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Has Pets</span>
                  </label>
                  
                  {formData.has_pets && formData.pets && formData.pets.length > 0 && (
                    <div className="pl-4 space-y-2">
                      {formData.pets.map((pet: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded text-sm">
                          <div className="font-medium">{pet.pet_type}: {pet.pet_name}</div>
                          <div className="text-gray-600">
                            {pet.pet_breed}, {pet.pet_weight} lbs, {pet.pet_color}
                          </div>
                          <div className="text-gray-600">
                            Spayed: {pet.pet_spayed ? 'Yes' : 'No'}, 
                            Vaccinations: {pet.pet_vaccinations_current ? 'Current' : 'Not Current'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Insurance */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-gray-700">Insurance</h4>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.has_insurance}
                      onChange={(e) => setFormData({...formData, has_insurance: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Has Insurance</span>
                  </label>
                  
                  {formData.has_insurance && (
                    <>
                      <input
                        type="text"
                        placeholder="Insurance Provider"
                        value={formData.insurance_provider}
                        onChange={(e) => setFormData({...formData, insurance_provider: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="Policy Number"
                        value={formData.insurance_policy_number}
                        onChange={(e) => setFormData({...formData, insurance_policy_number: e.target.value})}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </>
                  )}
                </div>

                {/* Vehicle */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium text-sm text-gray-700">Vehicle</h4>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.has_vehicle}
                      onChange={(e) => setFormData({...formData, has_vehicle: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Has Vehicle</span>
                  </label>
                  
                  {formData.has_vehicle && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Make"
                        value={formData.vehicle_make}
                        onChange={(e) => setFormData({...formData, vehicle_make: e.target.value})}
                        className="px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="Model"
                        value={formData.vehicle_model}
                        onChange={(e) => setFormData({...formData, vehicle_model: e.target.value})}
                        className="px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="Year"
                        value={formData.vehicle_year}
                        onChange={(e) => setFormData({...formData, vehicle_year: e.target.value})}
                        className="px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="Color"
                        value={formData.vehicle_color}
                        onChange={(e) => setFormData({...formData, vehicle_color: e.target.value})}
                        className="px-3 py-2 border rounded"
                      />
                      <input
                        type="text"
                        placeholder="License Plate"
                        value={formData.vehicle_plate}
                        onChange={(e) => setFormData({...formData, vehicle_plate: e.target.value})}
                        className="col-span-2 px-3 py-2 border rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleImportAll}
              disabled={importing || reviewedCount === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import All Reviewed (${reviewedCount})`}
            </button>
            <button
              onClick={handleNext}
              disabled={saving || currentIndex === extractions.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {currentIndex === extractions.length - 1 ? 'Last Page' : 'Mark Reviewed & Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
