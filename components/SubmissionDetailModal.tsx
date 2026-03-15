'use client';

import { useState, useEffect } from 'react';
import DocumentViewerModal from './DocumentViewerModal';

interface SubmissionPet {
  pet_type: string;
  pet_name: string;
  pet_breed: string;
  pet_weight: number | string;
  pet_color: string;
  pet_spayed: boolean;
  pet_vaccinations_current: boolean;
  pet_vaccination_file?: string | null;
  pet_photo_file?: string | null;
}

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
  pets?: SubmissionPet[] | null;
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
  additional_vehicles?: { vehicle_make: string; vehicle_model: string; vehicle_year: number | string; vehicle_color: string; vehicle_plate: string; requested_at: string }[] | null;
  pet_addendum_file?: string;
  vehicle_addendum_file?: string;
  combined_pdf?: string;
  ip_address?: string;
  user_agent?: string;
}

interface SubmissionDetailModalProps {
  submission: Submission;
  onClose: () => void;
  onUpdate?: (updated: Submission) => void;
}

function EditableField({ label, value, fieldKey, edits, setEdits }: {
  label: string;
  value: string | number | undefined;
  fieldKey: string;
  edits: Record<string, any>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const [editing, setEditing] = useState(false);
  const currentValue = fieldKey in edits ? edits[fieldKey] : (value ?? '');

  if (editing) {
    return (
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <input
          autoFocus
          type="text"
          value={currentValue}
          onChange={(e) => setEdits(prev => ({ ...prev, [fieldKey]: e.target.value }))}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); if (e.key === 'Escape') { setEdits(prev => { const copy = { ...prev }; delete copy[fieldKey]; return copy; }); setEditing(false); } }}
          className="w-full px-2 py-1 border border-blue-400 rounded-none text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="group">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`font-medium ${fieldKey in edits ? 'text-blue-700' : ''}`}>{currentValue || 'N/A'}</p>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-gray-400 hover:text-blue-600 p-0.5"
          title={`Edit ${label}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
      </div>
    </div>
  );
}

function EditablePetField({ label, value, petIndex, petKey, edits, setEdits, pets }: {
  label: string;
  value: string | number | undefined;
  petIndex: number;
  petKey: string;
  edits: Record<string, any>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  pets: SubmissionPet[];
}) {
  const [editing, setEditing] = useState(false);
  const editedPets: SubmissionPet[] | undefined = edits.pets;
  const currentValue = editedPets ? (editedPets[petIndex] as any)?.[petKey] ?? '' : (value ?? '');

  const updatePetField = (newVal: string) => {
    const base = edits.pets ? [...edits.pets] : pets.map(p => ({ ...p }));
    (base[petIndex] as any)[petKey] = newVal;
    setEdits(prev => ({ ...prev, pets: base }));
  };

  if (editing) {
    return (
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <input
          autoFocus
          type="text"
          value={currentValue}
          onChange={(e) => updatePetField(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
          className="w-full px-2 py-1 border border-blue-400 rounded-none text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    );
  }

  const isEdited = editedPets && (editedPets[petIndex] as any)?.[petKey] !== (value ?? '');

  return (
    <div className="group">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={`font-medium ${isEdited ? 'text-blue-700' : ''} ${petKey === 'pet_type' ? 'capitalize' : ''}`}>{currentValue || 'N/A'}</p>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-gray-400 hover:text-blue-600 p-0.5"
          title={`Edit ${label}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function SubmissionDetailModal({ submission, onClose, onUpdate }: SubmissionDetailModalProps) {
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [documentViewer, setDocumentViewer] = useState<{
    isOpen: boolean;
    documentPath: string | null;
    documentType: 'signature' | 'insurance' | 'addendum' | 'photo';
    title?: string;
    date?: string;
  }>({ isOpen: false, documentPath: null, documentType: 'signature' });

  const hasEdits = Object.keys(edits).length > 0;

  useEffect(() => {
    const loadFileUrls = async () => {
      const urls: Record<string, string> = {};
      const files = [
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

      if (submission.pets) {
        submission.pets.forEach((pet, i) => {
          if (pet.pet_vaccination_file) {
            urls[`pet_${i}_vaccination`] = `/api/admin/file?path=${encodeURIComponent(pet.pet_vaccination_file)}`;
          }
          if (pet.pet_photo_file) {
            urls[`pet_${i}_photo`] = `/api/admin/file?path=${encodeURIComponent(pet.pet_photo_file)}`;
          }
        });
      }

      setFileUrls(urls);
    };

    loadFileUrls();
  }, [submission]);

  const handleSave = async () => {
    if (!hasEdits) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submission.id, updates: edits }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...submission, ...edits } as Submission;
        onUpdate?.(updated);
        setEdits({});
        alert('Saved.');
      } else {
        alert(data.message || 'Failed to save.');
      }
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Submission Details</h2>
            {hasEdits && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Unsaved changes</span>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            &times;
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
              <EditableField label="Full Name" value={submission.full_name} fieldKey="full_name" edits={edits} setEdits={setEdits} />
              <EditableField label="Email" value={submission.email} fieldKey="email" edits={edits} setEdits={setEdits} />
              <EditableField label="Phone" value={submission.phone} fieldKey="phone" edits={edits} setEdits={setEdits} />
              <div>
                <p className="text-sm text-gray-600">New Phone Number?</p>
                <p className="font-medium">{submission.phone_is_new ? 'Yes' : 'No'}</p>
              </div>
              <EditableField label="Building Address" value={submission.building_address} fieldKey="building_address" edits={edits} setEdits={setEdits} />
              <EditableField label="Unit Number" value={submission.unit_number} fieldKey="unit_number" edits={edits} setEdits={setEdits} />
            </div>
          </section>

          <section className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Pet Information
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                submission.has_pets ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {submission.has_pets ? `${submission.pets?.length || 0} pet${(submission.pets?.length || 0) !== 1 ? 's' : ''}` : 'No Pets'}
              </span>
            </h3>

            {submission.has_pets && submission.pets && submission.pets.map((pet, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Pet #{idx + 1}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <EditablePetField label="Pet Type" value={pet.pet_type} petIndex={idx} petKey="pet_type" edits={edits} setEdits={setEdits} pets={submission.pets!} />
                  <EditablePetField label="Pet Name" value={pet.pet_name} petIndex={idx} petKey="pet_name" edits={edits} setEdits={setEdits} pets={submission.pets!} />
                  <EditablePetField label="Breed" value={pet.pet_breed} petIndex={idx} petKey="pet_breed" edits={edits} setEdits={setEdits} pets={submission.pets!} />
                  <EditablePetField label="Weight" value={pet.pet_weight} petIndex={idx} petKey="pet_weight" edits={edits} setEdits={setEdits} pets={submission.pets!} />
                  <EditablePetField label="Color" value={pet.pet_color} petIndex={idx} petKey="pet_color" edits={edits} setEdits={setEdits} pets={submission.pets!} />
                  <div>
                    <p className="text-sm text-gray-600">Spayed/Neutered</p>
                    <p className="font-medium">{pet.pet_spayed ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Vaccinations Current</p>
                    <p className="font-medium">{pet.pet_vaccinations_current ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {fileUrls[`pet_${idx}_vaccination`] && (
                    <button
                      onClick={() => setDocumentViewer({
                        isOpen: true,
                        documentPath: fileUrls[`pet_${idx}_vaccination`].split('/api/admin/file?path=')[1],
                        documentType: 'addendum',
                        title: `${pet.pet_name} - Vaccination Record`
                      })}
                      className="block text-blue-600 hover:underline text-sm"
                    >
                      View Vaccination Records
                    </button>
                  )}
                  {fileUrls[`pet_${idx}_photo`] && (
                    <button
                      onClick={() => setDocumentViewer({
                        isOpen: true,
                        documentPath: fileUrls[`pet_${idx}_photo`].split('/api/admin/file?path=')[1],
                        documentType: 'photo',
                        title: `${pet.pet_name} - Pet Photo`
                      })}
                      className="block text-blue-600 hover:underline text-sm"
                    >
                      View Pet Photo
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!submission.has_pets && (
              <p className="text-sm text-gray-700 mb-3">Tenant confirmed they do not have any pets.</p>
            )}

            <div className="mt-2 space-y-2">
              <div>
                <p className="text-sm text-gray-600">Signature Date</p>
                <p className="font-medium">{submission.pet_signature_date || 'N/A'}</p>
              </div>
              {fileUrls.pet_signature && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">{submission.has_pets ? 'Pet Addendum Signature' : 'No-Pet Confirmation Signature'}</p>
                  <button
                    onClick={() => setDocumentViewer({
                      isOpen: true,
                      documentPath: submission.pet_signature!,
                      documentType: 'signature',
                      title: submission.has_pets ? 'Pet Addendum Signature' : 'No-Pet Confirmation Signature',
                      date: submission.pet_signature_date
                    })}
                    className="text-blue-600 hover:underline"
                  >
                    View Signature
                  </button>
                </div>
              )}
              {fileUrls.pet_addendum_file && (
                <button
                  onClick={() => setDocumentViewer({
                    isOpen: true,
                    documentPath: submission.pet_addendum_file!,
                    documentType: 'addendum',
                    title: 'Pet Addendum Document'
                  })}
                  className="block text-blue-600 hover:underline"
                >
                  View Pet Addendum (PDF)
                </button>
              )}
            </div>
          </section>

          {submission.has_insurance && (
            <section className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Insurance Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Provider" value={submission.insurance_provider} fieldKey="insurance_provider" edits={edits} setEdits={setEdits} />
                <EditableField label="Policy Number" value={submission.insurance_policy_number} fieldKey="insurance_policy_number" edits={edits} setEdits={setEdits} />
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
                  <button
                    onClick={() => setDocumentViewer({
                      isOpen: true,
                      documentPath: submission.insurance_file!,
                      documentType: 'insurance',
                      title: 'Insurance Proof Document'
                    })}
                    className="text-blue-600 hover:underline"
                  >
                    View Insurance Proof
                  </button>
                </div>
              )}
            </section>
          )}

          {submission.has_vehicle && (
            <section className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Make" value={submission.vehicle_make} fieldKey="vehicle_make" edits={edits} setEdits={setEdits} />
                <EditableField label="Model" value={submission.vehicle_model} fieldKey="vehicle_model" edits={edits} setEdits={setEdits} />
                <EditableField label="Year" value={submission.vehicle_year} fieldKey="vehicle_year" edits={edits} setEdits={setEdits} />
                <EditableField label="Color" value={submission.vehicle_color} fieldKey="vehicle_color" edits={edits} setEdits={setEdits} />
                <EditableField label="License Plate" value={submission.vehicle_plate} fieldKey="vehicle_plate" edits={edits} setEdits={setEdits} />
                <div>
                  <p className="text-sm text-gray-600">Signature Date</p>
                  <p className="font-medium">{submission.vehicle_signature_date}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {fileUrls.vehicle_signature && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Vehicle Addendum Signature</p>
                    <button
                      onClick={() => setDocumentViewer({
                        isOpen: true,
                        documentPath: submission.vehicle_signature!,
                        documentType: 'signature',
                        title: 'Vehicle Addendum Signature',
                        date: submission.vehicle_signature_date
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      View Signature
                    </button>
                  </div>
                )}
                {fileUrls.vehicle_addendum_file && (
                  <button
                    onClick={() => setDocumentViewer({
                      isOpen: true,
                      documentPath: submission.vehicle_addendum_file!,
                      documentType: 'addendum',
                      title: 'Vehicle Addendum Document'
                    })}
                    className="block text-blue-600 hover:underline"
                  >
                    View Vehicle Addendum
                  </button>
                )}
              </div>

              {submission.additional_vehicles && submission.additional_vehicles.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-orange-700 mb-3">Additional Vehicles (Waitlisted)</h4>
                  {submission.additional_vehicles.map((av, index) => (
                    <div key={index} className="bg-orange-50 border border-orange-200 rounded p-3 mb-3">
                      <p className="text-sm font-semibold text-orange-800 mb-2">Additional Vehicle #{index + 1}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-sm text-gray-600">Make</p>
                          <p className="font-medium">{av.vehicle_make}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Model</p>
                          <p className="font-medium">{av.vehicle_model}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Year</p>
                          <p className="font-medium">{av.vehicle_year}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Color</p>
                          <p className="font-medium">{av.vehicle_color}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">License Plate</p>
                          <p className="font-medium">{av.vehicle_plate}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Requested At</p>
                          <p className="font-medium">{new Date(av.requested_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          {hasEdits && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-700 text-white px-6 py-3 rounded-none hover:bg-blue-800 transition-colors duration-200 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <button
            onClick={onClose}
            className={`${hasEdits ? 'flex-1' : 'w-full'} bg-gray-900 text-white px-6 py-3 rounded-none hover:bg-gray-800 transition-colors duration-200 font-medium`}
          >
            {hasEdits ? 'Discard & Close' : 'Close'}
          </button>
        </div>
      </div>

      <DocumentViewerModal
        isOpen={documentViewer.isOpen}
        onClose={() => setDocumentViewer({ isOpen: false, documentPath: null, documentType: 'signature' })}
        documentPath={documentViewer.documentPath}
        documentType={documentViewer.documentType}
        title={documentViewer.title}
        date={documentViewer.date}
      />
    </div>
  );
}
