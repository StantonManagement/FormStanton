'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MatrixRow } from '@/types/compliance';
import DocumentViewerModal from '@/components/DocumentViewerModal';

interface TenantSidePanelProps {
  row: MatrixRow;
  /** Full submission object (fetched separately since matrix row is a projection) */
  submission: any | null;
  onClose: () => void;
  onRefresh: () => void;
  onEditSubmission: (submission: any) => void;
}

export default function TenantSidePanel({
  row,
  submission,
  onClose,
  onRefresh,
  onEditSubmission,
}: TenantSidePanelProps) {
  const [viewingDocument, setViewingDocument] = useState<{ path: string; type: 'signature' | 'insurance' | 'addendum' | 'photo'; title: string; date?: string } | null>(null);
  const [viewingSignature, setViewingSignature] = useState<{ path: string; type: string; date?: string } | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const getSignatureUrl = useCallback((path: string) => {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/submissions/${path}`;
  }, []);

  const sub = submission;

  if (row.missing) {
    return (
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-[var(--border)] shadow-lg z-40 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--divider)] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-[var(--primary)]">Unit {row.unit_number}</h3>
            <p className="text-xs text-[var(--error)] mt-0.5">Missing Submission</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)]/35">
            <div className="text-sm font-medium text-[var(--error)] mb-2">No submission on file</div>
            <div className="text-xs text-[var(--ink)]">
              {row.tenant_lookup_name && <div>Tenant: {row.tenant_lookup_name}</div>}
              {row.phone && <div>Phone: {row.phone}</div>}
              {row.email && <div>Email: {row.email}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-[var(--border)] shadow-lg z-40 flex items-center justify-center">
        <div className="text-sm text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white border-l border-[var(--border)] shadow-lg z-40 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--divider)] px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-serif text-lg text-[var(--primary)]">
              Unit {sub.unit_number} — {sub.full_name}
            </h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">{sub.phone} · {sub.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditSubmission(sub)}
              className="p-1.5 text-[var(--primary)] hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
              title="Edit submission"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Submission metadata */}
          <div className="text-xs text-[var(--muted)]">
            Submitted {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
          </div>

          {/* AppFolio Status Summary */}
          <div className="p-3 bg-[var(--bg-section)] border border-[var(--divider)]">
            <h4 className="text-xs font-semibold text-[var(--primary)] mb-2">AppFolio Status</h4>
            <div className="space-y-1">
              {sub.has_vehicle && (
                <StatusRow
                  label="Vehicle Doc"
                  done={row.vehicle_addendum_uploaded_to_appfolio}
                  by={row.vehicle_addendum_uploaded_to_appfolio_by}
                  at={row.vehicle_addendum_uploaded_to_appfolio_at}
                />
              )}
              {sub.has_pets && (
                <StatusRow
                  label="Pet Doc"
                  done={row.pet_addendum_uploaded_to_appfolio}
                  by={row.pet_addendum_uploaded_to_appfolio_by}
                  at={row.pet_addendum_uploaded_to_appfolio_at}
                />
              )}
              {sub.has_insurance && (
                <StatusRow
                  label="Insurance"
                  done={row.insurance_uploaded_to_appfolio}
                  by={row.insurance_uploaded_to_appfolio_by}
                  at={row.insurance_uploaded_to_appfolio_at}
                />
              )}
              {sub.has_pets && (
                <StatusRow
                  label="Pet Fee"
                  done={row.pet_fee_added_to_appfolio}
                  by={row.pet_fee_added_to_appfolio_by}
                  at={row.pet_fee_added_to_appfolio_at}
                  amount={row.pet_fee_amount}
                />
              )}
              {sub.has_vehicle && (
                <StatusRow
                  label="Permit Fee"
                  done={row.permit_fee_added_to_appfolio}
                  by={row.permit_fee_added_to_appfolio_by}
                  at={row.permit_fee_added_to_appfolio_at}
                  amount={row.permit_fee_amount}
                />
              )}
            </div>
          </div>

          {/* Vehicle Section */}
          {sub.has_vehicle && (
            <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h4 className="font-serif text-[var(--primary)] mb-3 text-sm">Vehicle Information</h4>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><span className="text-[var(--muted)]">Vehicle:</span> <span className="font-medium">{sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}</span></div>
                <div><span className="text-[var(--muted)]">Color:</span> {sub.vehicle_color}</div>
                <div><span className="text-[var(--muted)]">Plate:</span> <span className="font-mono">{sub.vehicle_plate}</span></div>
                <div><span className="text-[var(--muted)]">Verified:</span> <span className={sub.vehicle_verified ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{sub.vehicle_verified ? 'Yes' : 'No'}</span></div>
              </div>
              {sub.vehicle_signature && (
                <button
                  onClick={() => setViewingSignature({ path: sub.vehicle_signature, type: 'Vehicle', date: sub.vehicle_signature_date })}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                >
                  View Signature
                </button>
              )}
              {sub.vehicle_addendum_file && (
                <a
                  href={`/api/admin/file?path=${encodeURIComponent(sub.vehicle_addendum_file)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                >
                  View Addendum
                </a>
              )}
              {/* Permit status */}
              {sub.permit_issued && (
                <div className="mt-2 text-xs text-[var(--success)]">
                  Permit issued {sub.permit_issued_by && `by ${sub.permit_issued_by}`} {sub.permit_issued_at && `on ${new Date(sub.permit_issued_at).toLocaleDateString()}`}
                </div>
              )}
            </div>
          )}

          {/* Additional Vehicles */}
          {sub.additional_vehicles && sub.additional_vehicles.length > 0 && (
            <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h4 className="font-serif text-[var(--primary)] mb-2 text-sm">Additional Vehicles</h4>
              {sub.additional_vehicles.map((av: any, idx: number) => (
                <div key={idx} className="text-xs mb-1">
                  {av.vehicle_year} {av.vehicle_make} {av.vehicle_model} — {av.vehicle_color} — <span className="font-mono">{av.vehicle_plate}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pet Section */}
          {sub.has_pets && (
            <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h4 className="font-serif text-[var(--primary)] mb-3 text-sm">Pet Information</h4>
              {sub.pets && Array.isArray(sub.pets) && sub.pets.map((pet: any, idx: number) => (
                <div key={idx} className="text-xs mb-2">
                  <span className="font-medium">{pet.pet_name}</span> ({pet.pet_type}) — {pet.pet_breed}, {pet.pet_weight} lbs
                  <div className="flex gap-2 mt-1">
                    {pet.pet_photo_file && (
                      <button
                        onClick={() => setViewingDocument({ path: pet.pet_photo_file, type: 'photo', title: `${pet.pet_name} — Photo` })}
                        className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-[10px]"
                      >
                        Photo
                      </button>
                    )}
                    {pet.pet_vaccination_file && (
                      <button
                        onClick={() => setViewingDocument({ path: pet.pet_vaccination_file, type: 'photo', title: `${pet.pet_name} — Vaccination` })}
                        className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-[10px]"
                      >
                        Vaccination
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sub.pet_signature && (
                <button
                  onClick={() => setViewingSignature({ path: sub.pet_signature, type: 'Pet', date: sub.pet_signature_date })}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline mt-1"
                >
                  View Pet Signature
                </button>
              )}
              {sub.pet_addendum_file && (
                <a
                  href={`/api/admin/file?path=${encodeURIComponent(sub.pet_addendum_file)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                >
                  View Addendum
                </a>
              )}
              {/* Exemption */}
              {sub.exemption_status && (
                <div className="mt-2 pt-2 border-t border-[var(--divider)]">
                  <span className={`text-xs px-2 py-0.5 font-medium border ${
                    sub.exemption_status === 'approved' ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30' :
                    sub.exemption_status === 'denied' ? 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/30' :
                    'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30'
                  }`}>
                    Exemption: {sub.exemption_status.toUpperCase()}
                  </span>
                  {sub.exemption_reason && (
                    <span className="text-xs text-[var(--muted)] ml-2">({sub.exemption_reason})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Insurance Section */}
          {sub.has_insurance && (
            <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h4 className="font-serif text-[var(--primary)] mb-2 text-sm">Insurance</h4>
              <div className="text-xs space-y-1">
                <div><span className="text-[var(--muted)]">Provider:</span> {sub.insurance_provider}</div>
                {sub.insurance_policy_number && <div><span className="text-[var(--muted)]">Policy:</span> {sub.insurance_policy_number}</div>}
                {sub.insurance_expiration_date && <div><span className="text-[var(--muted)]">Expires:</span> {new Date(sub.insurance_expiration_date).toLocaleDateString()}</div>}
                {sub.insurance_type && <div><span className="text-[var(--muted)]">Type:</span> {sub.insurance_type === 'renters' ? 'Renters Insurance' : sub.insurance_type === 'car' ? 'Car Insurance' : sub.insurance_type}</div>}
              </div>
              <div className="flex gap-2 mt-2">
                {sub.insurance_file && (
                  <a
                    href={`/api/admin/file?path=${encodeURIComponent(sub.insurance_file)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                  >
                    View Insurance Doc
                  </a>
                )}
                {sub.insurance_authorization_signature && (
                  <button
                    onClick={() => setViewingSignature({ path: sub.insurance_authorization_signature, type: 'Insurance Auth' })}
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] underline"
                  >
                    View Auth Signature
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {(sub.vehicle_notes || sub.pet_notes || sub.insurance_notes || sub.admin_notes) && (
            <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h4 className="font-serif text-[var(--primary)] mb-2 text-sm">Notes</h4>
              <div className="text-xs space-y-1">
                {sub.vehicle_notes && <div><span className="text-[var(--muted)]">Vehicle:</span> {sub.vehicle_notes}</div>}
                {sub.pet_notes && <div><span className="text-[var(--muted)]">Pet:</span> {sub.pet_notes}</div>}
                {sub.insurance_notes && <div><span className="text-[var(--muted)]">Insurance:</span> {sub.insurance_notes}</div>}
                {sub.admin_notes && <div><span className="text-[var(--muted)]">Admin:</span> {sub.admin_notes}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature viewer overlay */}
      {viewingSignature && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-8"
          onClick={() => setViewingSignature(null)}
        >
          <div
            className="bg-white border border-[var(--border)] p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-[var(--primary)]">{viewingSignature.type} Signature</h3>
              <button onClick={() => setViewingSignature(null)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {viewingSignature.date && (
              <div className="text-sm text-[var(--muted)] mb-4">
                Signed: {new Date(viewingSignature.date).toLocaleString()}
              </div>
            )}
            <div className="border border-[var(--divider)] p-4 bg-[var(--bg-section)]">
              <img
                src={getSignatureUrl(viewingSignature.path)}
                alt={`${viewingSignature.type} Signature`}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Document viewer */}
      <DocumentViewerModal
        isOpen={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
        documentPath={viewingDocument?.path || null}
        documentType={viewingDocument?.type || 'addendum'}
        title={viewingDocument?.title}
        date={viewingDocument?.date}
      />
    </>
  );
}

/** Small helper row for the AppFolio status summary */
function StatusRow({ label, done, by, at, amount }: { label: string; done: boolean; by: string | null; at: string | null; amount?: number | null }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--muted)]">{label}</span>
      {done ? (
        <span className="text-[var(--success)] font-medium">
          ✓ {amount !== undefined && amount !== null ? `$${amount}` : 'Done'}
          {by && <span className="text-[var(--muted)] font-normal ml-1">({by}{at ? ` · ${new Date(at).toLocaleDateString()}` : ''})</span>}
        </span>
      ) : (
        <span className="text-[var(--warning)]">Pending</span>
      )}
    </div>
  );
}
