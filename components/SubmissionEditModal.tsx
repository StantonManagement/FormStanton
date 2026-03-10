'use client';

import { useState } from 'react';

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
  has_pets: boolean;
  pet_addendum_file?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
}

interface SubmissionEditModalProps {
  submission: TenantSubmission;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmissionEditModal({ submission, onClose, onSuccess }: SubmissionEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [fullName, setFullName] = useState(submission.full_name || '');
  const [phone, setPhone] = useState(submission.phone || '');
  const [email, setEmail] = useState(submission.email || '');

  const [vehicleData, setVehicleData] = useState({
    make: submission.vehicle_make || '',
    model: submission.vehicle_model || '',
    year: submission.vehicle_year?.toString() || '',
    color: submission.vehicle_color || '',
    plate: submission.vehicle_plate || '',
  });

  const [insuranceData, setInsuranceData] = useState({
    provider: submission.insurance_provider || '',
    policyNumber: submission.insurance_policy_number || '',
  });

  const [staffName, setStaffName] = useState('');
  const [petDocFile, setPetDocFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [petDocPreview, setPetDocPreview] = useState<string | null>(null);
  const [insurancePreview, setInsurancePreview] = useState<string | null>(null);

  const handleVehicleChange = (field: string, value: string) => {
    setVehicleData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleInsuranceChange = (field: string, value: string) => {
    setInsuranceData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handlePetDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Pet document file size must be less than 10MB');
        return;
      }
      setPetDocFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPetDocPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPetDocPreview(null);
      }
      setError('');
    }
  };

  const handleInsuranceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Insurance file size must be less than 10MB');
        return;
      }
      setInsuranceFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setInsurancePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setInsurancePreview(null);
      }
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('submissionId', submission.id);

      // Tenant info
      if (fullName && fullName !== submission.full_name) {
        formData.append('fullName', fullName);
      }
      if (phone !== (submission.phone || '')) {
        formData.append('phone', phone);
      }
      if (email !== (submission.email || '')) {
        formData.append('email', email);
      }
      
      // Vehicle data
      const hasVehicleData = vehicleData.make || vehicleData.model || vehicleData.year || vehicleData.color || vehicleData.plate;
      if (hasVehicleData) {
        if (!vehicleData.make || !vehicleData.model || !vehicleData.year || !vehicleData.color || !vehicleData.plate) {
          setError('All vehicle fields are required if adding vehicle information');
          setIsSubmitting(false);
          return;
        }
        if (!staffName) {
          setError('Staff name is required when adding vehicle information');
          setIsSubmitting(false);
          return;
        }
        formData.append('vehicleMake', vehicleData.make);
        formData.append('vehicleModel', vehicleData.model);
        formData.append('vehicleYear', vehicleData.year);
        formData.append('vehicleColor', vehicleData.color);
        formData.append('vehiclePlate', vehicleData.plate);
        formData.append('staffName', staffName);
      }

      // Insurance data
      if (insuranceData.provider || insuranceData.policyNumber || insuranceFile) {
        if (insuranceData.provider) formData.append('insuranceProvider', insuranceData.provider);
        if (insuranceData.policyNumber) formData.append('insurancePolicyNumber', insuranceData.policyNumber);
      }

      // Files
      if (petDocFile) {
        formData.append('petDocument', petDocFile);
      }
      if (insuranceFile) {
        formData.append('insuranceDocument', insuranceFile);
      }

      const response = await fetch('/api/admin/update-submission', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Submission updated successfully');
        onSuccess();
      } else {
        setError(data.message || 'Failed to update submission');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Submission</h2>
            <p className="text-sm text-gray-600 mt-1">
              {submission.full_name} - Unit {submission.unit_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Tenant Information Section */}
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tenant full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1234567890"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tenant@email.com"
                />
              </div>
            </div>
          </section>

          {/* Vehicle Information Section */}
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🚗 Vehicle Information
              {submission.has_vehicle && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Has Vehicle
                </span>
              )}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  value={vehicleData.make}
                  onChange={(e) => handleVehicleChange('make', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Toyota"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  value={vehicleData.model}
                  onChange={(e) => handleVehicleChange('model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Camry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="text"
                  value={vehicleData.year}
                  onChange={(e) => handleVehicleChange('year', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 2020"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={vehicleData.color}
                  onChange={(e) => handleVehicleChange('color', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Silver"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Plate
                </label>
                <input
                  type="text"
                  value={vehicleData.plate}
                  onChange={(e) => handleVehicleChange('plate', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="e.g., ABC123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
            </div>
          </section>

          {/* Pet Documents Section */}
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🐾 Pet Documents
              {submission.has_pets && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Has Pets
                </span>
              )}
            </h3>

            {submission.pet_addendum_file && (
              <div className="mb-3 text-sm text-gray-600">
                Current file: <span className="font-mono text-xs">{submission.pet_addendum_file}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Pet Addendum (PDF or Photo)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                onChange={handlePetDocChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Accepted formats: PDF, JPG, PNG, HEIC (max 10MB)
              </p>
            </div>

            {petDocPreview && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <img src={petDocPreview} alt="Pet document preview" className="max-w-xs rounded border border-gray-300" />
              </div>
            )}

            {petDocFile && !petDocPreview && (
              <div className="mt-3 text-sm text-green-600">
                ✓ {petDocFile.name} selected
              </div>
            )}
          </section>

          {/* Insurance Documents Section */}
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              🛡️ Insurance Documents
              {submission.has_insurance && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Has Insurance
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
                </label>
                <input
                  type="text"
                  value={insuranceData.provider}
                  onChange={(e) => handleInsuranceChange('provider', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., State Farm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={insuranceData.policyNumber}
                  onChange={(e) => handleInsuranceChange('policyNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Policy number"
                />
              </div>
            </div>

            {submission.insurance_file && (
              <div className="mb-3 text-sm text-gray-600">
                Current file: <span className="font-mono text-xs">{submission.insurance_file}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Insurance Proof (PDF or Photo)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                onChange={handleInsuranceFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Accepted formats: PDF, JPG, PNG, HEIC (max 10MB)
              </p>
            </div>

            {insurancePreview && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <img src={insurancePreview} alt="Insurance document preview" className="max-w-xs rounded border border-gray-300" />
              </div>
            )}

            {insuranceFile && !insurancePreview && (
              <div className="mt-3 text-sm text-green-600">
                ✓ {insuranceFile.name} selected
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
