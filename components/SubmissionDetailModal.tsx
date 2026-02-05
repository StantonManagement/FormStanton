'use client';

import { useState, useEffect } from 'react';

interface Submission {
  id: string;
  created_at: string;
  language: string;
  full_name: string;
  phone: string;
  email: string;
  phone_is_new: boolean;
  building_address: string;
  unit_number: string;
  has_pets: boolean;
  pet_type?: string;
  pet_name?: string;
  pet_breed?: string;
  pet_weight?: number;
  pet_color?: string;
  pet_spayed?: boolean;
  pet_vaccinations_current?: boolean;
  pet_vaccination_file?: string;
  pet_photo_file?: string;
  pet_signature?: string;
  pet_signature_date?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  add_insurance_to_rent?: boolean;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  pet_addendum_file?: string;
  vehicle_addendum_file?: string;
  combined_pdf?: string;
  ip_address?: string;
  user_agent?: string;
}

interface SubmissionDetailModalProps {
  submission: Submission;
  onClose: () => void;
}

export default function SubmissionDetailModal({ submission, onClose }: SubmissionDetailModalProps) {
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadFileUrls = async () => {
      const urls: Record<string, string> = {};
      const files = [
        { key: 'pet_vaccination_file', path: submission.pet_vaccination_file },
        { key: 'pet_photo_file', path: submission.pet_photo_file },
        { key: 'pet_signature', path: submission.pet_signature },
        { key: 'insurance_file', path: submission.insurance_file },
        { key: 'vehicle_signature', path: submission.vehicle_signature },
        { key: 'pet_addendum_file', path: submission.pet_addendum_file },
        { key: 'vehicle_addendum_file', path: submission.vehicle_addendum_file },
      ];

      for (const file of files) {
        if (file.path) {
          urls[file.key] = `/api/admin/file?path=${encodeURIComponent(file.path)}`;
        }
      }

      setFileUrls(urls);
    };

    loadFileUrls();
  }, [submission]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Submission Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Submission Date</p>
                <p className="font-medium">{formatDate(submission.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Language</p>
                <p className="font-medium">{submission.language?.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-medium">{submission.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{submission.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{submission.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">New Phone Number?</p>
                <p className="font-medium">{submission.phone_is_new ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Building Address</p>
                <p className="font-medium">{submission.building_address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Unit Number</p>
                <p className="font-medium">{submission.unit_number}</p>
              </div>
            </div>
          </section>

          {submission.has_pets && (
            <section className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Pet Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Pet Type</p>
                  <p className="font-medium">{submission.pet_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pet Name</p>
                  <p className="font-medium">{submission.pet_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Breed</p>
                  <p className="font-medium">{submission.pet_breed}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight</p>
                  <p className="font-medium">{submission.pet_weight} lbs</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Color</p>
                  <p className="font-medium">{submission.pet_color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Spayed/Neutered</p>
                  <p className="font-medium">{submission.pet_spayed ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vaccinations Current</p>
                  <p className="font-medium">{submission.pet_vaccinations_current ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Signature Date</p>
                  <p className="font-medium">{submission.pet_signature_date}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {fileUrls.pet_vaccination_file && (
                  <a href={fileUrls.pet_vaccination_file} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                    📄 View Vaccination Records
                  </a>
                )}
                {fileUrls.pet_photo_file && (
                  <a href={fileUrls.pet_photo_file} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                    📷 View Pet Photo
                  </a>
                )}
                {fileUrls.pet_signature && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pet Addendum Signature</p>
                    <img src={fileUrls.pet_signature} alt="Pet signature" className="border border-gray-300 rounded max-w-md" />
                  </div>
                )}
                {fileUrls.pet_addendum_file && (
                  <a href={fileUrls.pet_addendum_file} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                    📝 Download Pet Addendum
                  </a>
                )}
              </div>
            </section>
          )}

          {submission.has_insurance && (
            <section className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Insurance Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Provider</p>
                  <p className="font-medium">{submission.insurance_provider || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Policy Number</p>
                  <p className="font-medium">{submission.insurance_policy_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Upload Status</p>
                  <p className="font-medium">
                    {submission.insurance_file ? 'Uploaded' : submission.insurance_upload_pending ? 'Pending' : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Add to Rent</p>
                  <p className="font-medium">{submission.add_insurance_to_rent ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {fileUrls.insurance_file && (
                <div className="mt-4">
                  <a href={fileUrls.insurance_file} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    📄 View Insurance Proof
                  </a>
                </div>
              )}
            </section>
          )}

          {submission.has_vehicle && (
            <section className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Make</p>
                  <p className="font-medium">{submission.vehicle_make}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Model</p>
                  <p className="font-medium">{submission.vehicle_model}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Year</p>
                  <p className="font-medium">{submission.vehicle_year}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Color</p>
                  <p className="font-medium">{submission.vehicle_color}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">License Plate</p>
                  <p className="font-medium">{submission.vehicle_plate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Signature Date</p>
                  <p className="font-medium">{submission.vehicle_signature_date}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {fileUrls.vehicle_signature && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Vehicle Addendum Signature</p>
                    <img src={fileUrls.vehicle_signature} alt="Vehicle signature" className="border border-gray-300 rounded max-w-md" />
                  </div>
                )}
                {fileUrls.vehicle_addendum_file && (
                  <a href={fileUrls.vehicle_addendum_file} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                    📝 Download Vehicle Addendum
                  </a>
                )}
              </div>
            </section>
          )}

          <section className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Technical Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Submission ID</p>
                <p className="font-mono text-xs">{submission.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">IP Address</p>
                <p className="font-mono text-xs">{submission.ip_address}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
