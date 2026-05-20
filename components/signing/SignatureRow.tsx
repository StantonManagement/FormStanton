'use client';

import { useState } from 'react';

interface SignatureData {
  id: string;
  document_label: string;
  signing_party: string;
  plain_language_description?: string | null;
  status: string;
  signature_method?: string | null;
  signed_pdf_uploaded_by_role?: string | null;
  conditional_note?: string | null;
}

interface SignatureRowProps {
  signature: SignatureData;
  context: 'tenant' | 'staff';
  token?: string;
  onUploadClick?: () => void;
  disabled?: boolean;
}

/**
 * SignatureRow component with "Sign in-app" and "Upload signed PDF" buttons.
 *
 * PRD IV (Post-Approval Execution): "Sign in-app" button is DISABLED with tooltip.
 * PRD V (In-App Signature Capture) will activate this button when it ships.
 */
export default function SignatureRow({
  signature,
  context,
  onUploadClick,
  disabled = false,
}: SignatureRowProps) {
  const [isLoading] = useState(false);

  const isSigned = signature.status === 'signed' || signature.status === 'executed';
  const isPending = signature.status === 'pending' || signature.status === 'sent';
  const isWaived = signature.status === 'waived';

  // Determine if this user can interact
  const canInteract = isPending && !disabled && (
    (context === 'tenant' && signature.signing_party.includes('tenant')) ||
    (context === 'staff' && signature.signing_party.includes('stanton'))
  );

  // Attribution text
  const getAttribution = () => {
    if (isWaived) return 'Waived';
    if (!isSigned) return null;

    if (signature.signature_method === 'in_app') {
      if (signature.signed_pdf_uploaded_by_role === 'tenant') {
        return 'Signed in-app by tenant';
      } else if (signature.signed_pdf_uploaded_by_role === 'stanton') {
        return 'Signed in-app by Stanton staff';
      }
    }

    return signature.signed_pdf_uploaded_by_role
      ? `Uploaded by ${signature.signed_pdf_uploaded_by_role}`
      : 'Signed';
  };

  const getStatusBadge = () => {
    if (isSigned) {
      return 'bg-green-100 text-green-700';
    }
    if (isWaived) {
      return 'bg-indigo-100 text-indigo-700';
    }
    if (isPending) {
      return 'bg-yellow-100 text-yellow-700';
    }
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="border border-[var(--border)] bg-white">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h4 className="font-medium text-[var(--ink)]">{signature.document_label}</h4>
          {signature.plain_language_description && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {signature.plain_language_description}
            </p>
          )}
          {signature.conditional_note && (
            <p className="text-xs text-amber-600 mt-0.5 italic">
              {signature.conditional_note}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 ${getStatusBadge()}`}>
            {signature.status}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">
          {getAttribution()}
        </div>

        {canInteract && (
          <div className="flex items-center gap-2">
            <button
              onClick={onUploadClick}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs border border-[var(--border)] bg-white hover:bg-[var(--paper)] transition-colors"
            >
              Upload signed PDF
            </button>

            {/* PRD IV: Sign in-app button is disabled with tooltip */}
            <button
              disabled={true}
              className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-500 cursor-not-allowed"
              title="Coming soon — in-app signing capability"
            >
              Sign in-app
            </button>
          </div>
        )}

        {isSigned && (
          <button
            onClick={() => {/* View audit trail */}}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            View audit trail
          </button>
        )}
      </div>
    </div>
  );
}
