'use client';

import SignatureRow from './SignatureRow';

interface Signature {
  id: string;
  document_label: string;
  signing_party: string;
  plain_language_description?: string | null;
  status: string;
  signature_method?: string | null;
  signed_pdf_uploaded_by_role?: string | null;
  conditional_note?: string | null;
  is_required: boolean;
}

interface SigningChecklistProps {
  signatures: Signature[];
  context: 'tenant' | 'staff';
  token?: string;
  onUploadClick?: (signatureId: string) => void;
  disabled?: boolean;
}

export default function SigningChecklist({
  signatures,
  context,
  token,
  onUploadClick,
  disabled = false,
}: SigningChecklistProps) {
  // Sort: required first, then by status (pending first)
  const sortedSignatures = [...signatures].sort((a, b) => {
    if (a.is_required !== b.is_required) {
      return a.is_required ? -1 : 1;
    }
    if (a.status === 'pending' && b.status !== 'pending') {
      return -1;
    }
    if (b.status === 'pending' && a.status !== 'pending') {
      return 1;
    }
    return 0;
  });

  const requiredCount = signatures.filter(s => s.is_required).length;
  const completedCount = signatures.filter(
    s => s.status === 'signed' || s.status === 'executed' || s.status === 'waived'
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--ink)] uppercase tracking-wide">
          Required Signatures
        </h3>
        <span className="text-xs text-[var(--muted)]">
          {completedCount} of {signatures.length} completed
          {requiredCount > 0 && ` (${requiredCount} required)`}
        </span>
      </div>

      <div className="space-y-3">
        {sortedSignatures.map((signature) => (
          <SignatureRow
            key={signature.id}
            signature={signature}
            context={context}
            token={token}
            onUploadClick={() => onUploadClick?.(signature.id)}
            disabled={disabled}
          />
        ))}
      </div>

      {signatures.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)] text-sm">
          No signatures required.
        </div>
      )}
    </div>
  );
}
