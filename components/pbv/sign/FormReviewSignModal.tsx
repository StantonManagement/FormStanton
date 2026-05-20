'use client';

/**
 * components/pbv/sign/FormReviewSignModal.tsx
 *
 * Per-form tap-to-confirm modal.
 * Shows: form name + PDF preview (iframe) + consent text + confirm checkbox + Sign button.
 *
 * If the ceremony has no signature yet: renders SignaturePadGate first.
 * If signature already captured: shows confirm-only flow.
 *
 * PDF render approach: iframe (same decision as summary doc — see build report).
 */

import { useState } from 'react';
import SignaturePadGate from './SignaturePadGate';
import ConsentText from './ConsentText';
import type { PreferredLanguage } from '@/types/compliance';
import type { FormDoc } from '@/lib/pbv/hooks/useFormStack';

interface Props {
  token: string;
  language: PreferredLanguage;
  form: FormDoc;
  hasSignature: boolean;
  hohName: string;
  submitting: boolean;
  error: string;
  onSign: (formDocId: string, sigDataUrl: string | null, typedName: string) => void;
  onClose: () => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    preview_label: 'Document Preview',
    confirm_label: 'I have reviewed this document and authorize my signature to be applied.',
    sign_btn: 'Sign this form',
    signing: 'Signing\u2026',
    cancel: 'Cancel',
    typed_name_label: 'Confirm your name:',
    typed_name_placeholder: 'Full legal name',
    preparing: 'Preparing document...',
  },
  es: {
    preview_label: 'Vista previa del documento',
    confirm_label: 'He revisado este documento y autorizo que se aplique mi firma.',
    sign_btn: 'Firmar este formulario',
    signing: 'Firmando\u2026',
    cancel: 'Cancelar',
    typed_name_label: 'Confirme su nombre:',
    typed_name_placeholder: 'Nombre legal completo',
    preparing: 'Preparando documento...',
  },
  pt: {
    // PT: tentative — review
    preview_label: 'Pr\u00e9via do documento',
    confirm_label: 'Revisei este documento e autorizo a aplica\u00e7\u00e3o da minha assinatura.',
    sign_btn: 'Assinar este formul\u00e1rio',
    signing: 'Assinando\u2026',
    cancel: 'Cancelar',
    typed_name_label: 'Confirme seu nome:',
    typed_name_placeholder: 'Nome legal completo',
    preparing: 'Preparando documento...',
  },
};

export default function FormReviewSignModal({
  token, language, form, hasSignature, hohName,
  submitting, error, onSign, onClose,
}: Props) {
  const c = copy[language] ?? copy.en;
  const [confirmed, setConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const pdfUrl = `/api/t/${token}/pbv-full-app/forms/${form.id}/preview`;

  // PR-3: Check if form PDF is ready before rendering iframe
  const isPdfReady = ['generated', 'signed', 'finalized'].includes(form.status);

  // If no signature yet, use SignaturePadGate flow
  if (!hasSignature) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
        <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
          <p className="font-semibold text-[var(--body)]">{form.display_name}</p>

          {/* PDF iframe — guarded by form status to prevent raw JSON display */}
          {isPdfReady ? (
            <div className="border border-[var(--border)]" style={{ height: '40vh' }}>
              <iframe src={pdfUrl} className="w-full h-full" title={form.display_name} />
            </div>
          ) : (
            <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center" style={{ height: '40vh' }}>
              <p className="text-sm text-[var(--muted)]">{c.preparing}</p>
            </div>
          )}

          <ConsentText language={language} />

          <SignaturePadGate
            language={language}
            consentText=""
            expectedName={hohName}
            submitting={submitting}
            error={error}
            onSubmit={(sigDataUrl, typedNameVal) => onSign(form.id, sigDataUrl, typedNameVal)}
            onCancel={onClose}
          />
        </div>
      </div>
    );
  }

  // Signature already captured — confirm-only flow
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <p className="font-semibold text-[var(--body)]">{form.display_name}</p>

        {/* PDF iframe — guarded by form status to prevent raw JSON display */}
        {isPdfReady ? (
          <div className="border border-[var(--border)]" style={{ height: '40vh' }}>
            <iframe src={pdfUrl} className="w-full h-full" title={form.display_name} />
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center" style={{ height: '40vh' }}>
            <p className="text-sm text-[var(--muted)]">{c.preparing}</p>
          </div>
        )}

        <ConsentText language={language} />

        {/* Typed name */}
        <div>
          <label className="block text-sm font-medium text-[var(--body)] mb-1">
            {c.typed_name_label}
          </label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={c.typed_name_placeholder}
            className="block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          />
        </div>

        {/* Confirm checkbox */}
        <label className="flex items-start gap-3 min-h-[44px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 mt-0.5 flex-shrink-0"
          />
          <span className="text-sm text-[var(--body)]">{c.confirm_label}</span>
        </label>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm font-medium hover:bg-[var(--paper)] transition-colors"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSign(form.id, null, typedName)}
            disabled={!confirmed || !typedName.trim() || submitting}
            className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {submitting ? c.signing : c.sign_btn}
          </button>
        </div>
      </div>
    </div>
  );
}
