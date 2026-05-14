'use client';

import { useState, useEffect } from 'react';

interface SignatureData {
  id: string;
  document_label: string;
  signing_party: string;
  plain_language_description?: string | null;
  status: string;
  signature_method?: string | null;
  signed_pdf_uploaded_by_role?: string | null;
}

interface SignatureRowProps {
  signature: SignatureData;
  context: 'tenant' | 'staff';
  token?: string; // Tenant token (only for tenant context)
  onStatusChange?: () => void;
}

/**
 * SignatureRow component with "Sign in-app" and "Upload signed PDF" buttons.
 * 
 * PRD V Activation:
 * - The "Sign in-app" button is ACTIVE when:
 *   1. The PRD V API endpoint exists (detected via feature check), OR
 *   2. IN_APP_SIGNATURE_ENABLED env var is set
 * - Wet-sign upload path from PRD IV remains available.
 */
export default function SignatureRow({ 
  signature, 
  context, 
  token,
  onStatusChange 
}: SignatureRowProps) {
  const [inAppEnabled, setInAppEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if in-app signing is available
  useEffect(() => {
    const checkFeature = async () => {
      // Feature flag check
      if (process.env.NEXT_PUBLIC_IN_APP_SIGNATURE_ENABLED === 'true') {
        setInAppEnabled(true);
        return;
      }

      // API detection check (try to hit the consent endpoint with HEAD)
      if (context === 'tenant' && token) {
        try {
          const res = await fetch(`/api/tenant/signing/${token}/${signature.id}/consent`, {
            method: 'HEAD',
          });
          if (res.status !== 404) {
            setInAppEnabled(true);
          }
        } catch {
          // API not available
        }
      } else if (context === 'staff') {
        // For staff, assume enabled if component rendered in admin
        setInAppEnabled(true);
      }
    };

    checkFeature();
  }, [context, token, signature.id]);

  const isSigned = signature.status === 'signed' || signature.status === 'executed';
  const isPending = signature.status === 'pending' || signature.status === 'sent';

  // Determine if this user can sign
  const canSign = isPending && (
    (context === 'tenant' && signature.signing_party.includes('tenant')) ||
    (context === 'staff' && signature.signing_party.includes('stanton'))
  );

  const handleInAppSign = () => {
    if (!inAppEnabled || !canSign) return;
    
    if (context === 'tenant' && token) {
      window.location.href = `/tenant-signing/${token}/${signature.id}`;
    } else {
      window.location.href = `/signing/${signature.id}`;
    }
  };

  const handleUpload = () => {
    // Trigger upload dialog
    // This would integrate with the existing upload flow from PRD IV
    onStatusChange?.();
  };

  // Attribution text
  const getAttribution = () => {
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
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 ${
            isSigned 
              ? 'bg-green-100 text-green-700' 
              : isPending 
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
          }`}>
            {signature.status}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">
          {getAttribution()}
        </div>

        {canSign && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs border border-[var(--border)] bg-white hover:bg-[var(--paper)] transition-colors"
            >
              Upload signed PDF
            </button>

            <button
              onClick={handleInAppSign}
              disabled={isLoading || !inAppEnabled}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                inAppEnabled
                  ? 'bg-[var(--primary)] text-white hover:opacity-90'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
              title={inAppEnabled ? 'Sign electronically' : 'Coming soon'}
            >
              {inAppEnabled ? 'Sign in-app' : 'Sign in-app (soon)'}
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
