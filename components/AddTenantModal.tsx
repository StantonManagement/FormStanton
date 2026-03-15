'use client';

import { useState, useEffect } from 'react';
import { FormPhoneInput } from '@/components/form';
import BuildingAutocomplete from './BuildingAutocomplete';
import { buildings as buildingsList, buildingUnits } from '@/lib/buildings';

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledBuilding?: string;
}

export default function AddTenantModal({ isOpen, onClose, onSuccess, prefilledBuilding }: AddTenantModalProps) {
  const [formData, setFormData] = useState({
    buildingAddress: prefilledBuilding || '',
    unitNumber: '',
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customUnit, setCustomUnit] = useState(false);

  useEffect(() => {
    if (prefilledBuilding) {
      setFormData(prev => ({ ...prev, buildingAddress: prefilledBuilding }));
    }
  }, [prefilledBuilding]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        buildingAddress: prefilledBuilding || '',
        unitNumber: '',
        name: '',
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
      });
      setError('');
      setSuccess('');
      setCustomUnit(false);
    }
  }, [isOpen, prefilledBuilding]);

  // Build full name from first + last if name is empty
  const getFullName = () => {
    if (formData.name) return formData.name;
    return `${formData.firstName} ${formData.lastName}`.trim();
  };

  const availableUnits = formData.buildingAddress ? (buildingUnits[formData.buildingAddress] || []) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const fullName = getFullName();
    if (!fullName) {
      setError('Tenant name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/compliance/add-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          email: formData.email || null,
          unitNumber: formData.unitNumber,
          buildingAddress: formData.buildingAddress,
          status: 'Current',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(data.message || 'Failed to add tenant');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Add Tenant</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Building */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Building Address <span className="text-red-500">*</span>
            </label>
            <BuildingAutocomplete
              value={formData.buildingAddress}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, buildingAddress: value, unitNumber: '' }));
                setCustomUnit(false);
              }}
              buildings={buildingsList}
              required
            />
          </div>

          {/* Unit Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Number <span className="text-red-500">*</span>
            </label>
            {availableUnits.length > 0 && !customUnit ? (
              <div>
                <select
                  value={formData.unitNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitNumber: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select unit...</option>
                  {availableUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCustomUnit(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                >
                  Unit not listed? Enter manually
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  required
                  value={formData.unitNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. 101"
                />
                {availableUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setCustomUnit(false); setFormData(prev => ({ ...prev, unitNumber: '' })); }}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Select from list instead
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Smith"
            />
            <p className="text-xs text-gray-500 mt-1">Or use First/Last below for structured entry</p>
          </div>

          {/* First + Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Smith"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <FormPhoneInput
              value={formData.phone}
              onChange={(digits) => setFormData(prev => ({ ...prev, phone: digits }))}
              placeholder="(860) 555-0123"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
