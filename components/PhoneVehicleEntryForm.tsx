'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { FormPhoneInput } from '@/components/form';
import BuildingAutocomplete from './BuildingAutocomplete';
import TenantAutocomplete from './TenantAutocomplete';

interface PhoneVehicleEntryFormProps {
  onSuccess?: () => void;
}

interface Tenant {
  full_name: string;
  phone: string;
  email: string;
  building_address: string;
  unit_number: string;
}

export default function PhoneVehicleEntryForm({ onSuccess }: PhoneVehicleEntryFormProps) {
  const { user } = useAdminAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    buildingAddress: '',
    unitNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [buildings, setBuildings] = useState<string[]>([]);
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'multiple' | 'not-found'>('idle');
  const [matchingTenants, setMatchingTenants] = useState<Tenant[]>([]);
  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (formData.buildingAddress && formData.unitNumber) {
      setLookupStatus('searching');
      debounceTimer.current = setTimeout(() => {
        lookupTenantByLocation(formData.buildingAddress, formData.unitNumber);
      }, 500);
    } else {
      setLookupStatus('idle');
      setMatchingTenants([]);
      setShowTenantDropdown(false);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData.buildingAddress, formData.unitNumber]);

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/admin/buildings');
      const data = await response.json();
      if (data.success) {
        setBuildings(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
    }
  };

  const lookupTenantByLocation = async (building: string, unit: string) => {
    try {
      const response = await fetch(`/api/lookup?building=${encodeURIComponent(building)}&unit=${encodeURIComponent(unit)}`);
      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        setMatchingTenants(data.results);
        
        if (data.results.length === 1) {
          const tenant = data.results[0];
          setFormData(prev => ({
            ...prev,
            fullName: tenant.full_name || '',
            phone: tenant.phone || '',
            email: tenant.email || '',
          }));
          setLookupStatus('found');
          setShowTenantDropdown(false);
        } else {
          setLookupStatus('multiple');
          setShowTenantDropdown(true);
        }
      } else {
        setLookupStatus('not-found');
        setMatchingTenants([]);
        setShowTenantDropdown(false);
      }
    } catch (error) {
      console.error('Tenant lookup error:', error);
      setLookupStatus('idle');
      setMatchingTenants([]);
      setShowTenantDropdown(false);
    }
  };

  const selectTenantFromDropdown = (tenant: Tenant) => {
    setFormData(prev => ({
      ...prev,
      fullName: tenant.full_name || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
    }));
    setLookupStatus('found');
    setShowTenantDropdown(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError('');
    setSubmitSuccess('');
    
    if (field === 'fullName' || field === 'phone' || field === 'email') {
      setLookupStatus('idle');
    }
  };

  const handleSelectTenant = (tenant: any) => {
    setFormData(prev => ({
      ...prev,
      fullName: tenant.full_name || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      buildingAddress: tenant.building_address || '',
      unitNumber: tenant.unit_number || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      const response = await fetch('/api/admin/phone-vehicle-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitSuccess(data.message);
        setFormData({
          fullName: '',
          phone: '',
          email: '',
          buildingAddress: '',
          unitNumber: '',
          vehicleMake: '',
          vehicleModel: '',
          vehicleYear: '',
          vehicleColor: '',
          vehiclePlate: '',
        });
        if (onSuccess) onSuccess();
      } else {
        setSubmitError(data.message || 'Submission failed');
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to submit vehicle information');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      fullName: '',
      phone: '',
      email: '',
      buildingAddress: '',
      unitNumber: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleColor: '',
      vehiclePlate: '',
    });
    setSubmitError('');
    setSubmitSuccess('');
    setLookupStatus('idle');
    setMatchingTenants([]);
    setShowTenantDropdown(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Phone Vehicle Entry</h2>
          <p className="text-sm text-gray-600">Enter vehicle information for tenants who call in</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tenant Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Tenant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <TenantAutocomplete
                  value={formData.fullName}
                  onChange={(value) => handleInputChange('fullName', value)}
                  onSelectTenant={handleSelectTenant}
                  placeholder="Start typing tenant name..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number (Optional)
                </label>
                <FormPhoneInput
                  value={formData.phone}
                  onChange={(digits) => handleInputChange('phone', digits)}
                  placeholder="(860) 555-0123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Building Address <span className="text-red-500">*</span>
                </label>
                <BuildingAutocomplete
                  value={formData.buildingAddress}
                  onChange={(value) => handleInputChange('buildingAddress', value)}
                  buildings={buildings}
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.unitNumber}
                  onChange={(e) => handleInputChange('unitNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="101"
                />
                
                {/* Tenant Lookup Status Indicators */}
                {lookupStatus === 'searching' && (
                  <div className="absolute right-3 top-9 flex items-center gap-1 text-xs text-gray-500">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Searching...</span>
                  </div>
                )}
                {lookupStatus === 'found' && (
                  <div className="absolute right-3 top-9 flex items-center gap-1 text-xs text-green-600 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>✓ Tenant found</span>
                  </div>
                )}
                {lookupStatus === 'not-found' && (
                  <div className="absolute right-3 top-9 flex items-center gap-1 text-xs text-amber-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>No tenant found</span>
                  </div>
                )}
                {lookupStatus === 'multiple' && (
                  <div className="absolute right-3 top-9 flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span>Select tenant below</span>
                  </div>
                )}
                
                {/* Tenant Selection Dropdown */}
                {showTenantDropdown && matchingTenants.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-700">Multiple tenants found - select one:</p>
                    </div>
                    {matchingTenants.map((tenant, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectTenantFromDropdown(tenant)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{tenant.full_name}</div>
                        <div className="text-sm text-gray-600">
                          {tenant.phone && <span>{tenant.phone}</span>}
                          {tenant.phone && tenant.email && <span className="mx-1">•</span>}
                          {tenant.email && <span>{tenant.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleMake}
                  onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Toyota"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleModel}
                  onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Camry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  value={formData.vehicleYear}
                  onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleColor}
                  onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Silver"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Plate <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehiclePlate}
                  onChange={(e) => handleInputChange('vehiclePlate', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ABC1234"
                />
              </div>
            </div>
          </div>

          {/* Staff Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Staff Information</h3>
            <div className="max-w-md">
              <div className="text-sm text-[var(--muted)]">Submitting as</div>
              <div className="text-base font-medium text-[var(--primary)]">{user?.displayName || 'Admin'}</div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {submitError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{submitError}</span>
              </div>
            </div>
          )}

          {submitSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="font-medium">{submitSuccess}</div>
                  <div className="text-sm mt-1">
                    The vehicle will appear in the compliance dashboard for verification and permit issuance.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Vehicle Information'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
            >
              Clear Form
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">📋 Next Steps</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Vehicle information will be recorded with today's date</li>
            <li>• Submission will appear in the Compliance Dashboard</li>
            <li>• Vehicle must be verified before permit can be issued</li>
            <li>• No signature is required for phone submissions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
