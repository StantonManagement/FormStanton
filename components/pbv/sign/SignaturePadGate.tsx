'use client';

/**
 * components/pbv/sign/SignaturePadGate.tsx
 *
 * Wraps SignatureCanvas with:
 *   - Typed-name identity confirmation
 *   - Consent text (versioned, from lib/pbv/consent-text.ts)
 *   - Cancel / Submit buttons
 *
 * On Submit: calls onSubmit(signatureDataUrl, typedName).
 * Caller is responsible for the API calls.
 */

import { useState } from 'react';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language: PreferredLanguage;
  consentText: string;
  expectedName?: string;
  submitting: boolean;
  error?: string;
  onSubmit: (signatureDataUrl: string, typedName: string) => void;
  onCancel: () => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    typed_name_label: 'Type your full name to confirm your identity:',
    typed_name_placeholder: 'Full legal name',
    name_mismatch: 'The name you entered does not match our records. Please try again.',
    sig_label: 'Draw your signature below:',
    clear: 'Clear',
    cancel: 'Cancel',
    submit: 'Sign',
    submitting: 'Signing\u2026',
    sig_required: 'Please draw your signature before continuing.',
    name_required: 'Please type your full name before signing.',
  },
  es: {
    typed_name_label: 'Escriba su nombre completo para confirmar su identidad:',
    typed_name_placeholder: 'Nombre legal completo',
    name_mismatch: 'El nombre ingresado no coincide con nuestros registros. Por favor intente de nuevo.',
    sig_label: 'Dibuje su firma a continuaci\u00f3n:',
    clear: 'Borrar',
    cancel: 'Cancelar',
    submit: 'Firmar',
    submitting: 'Firmando\u2026',
    sig_required: 'Por favor dibuje su firma antes de continuar.',
    name_required: 'Por favor escriba su nombre completo antes de firmar.',
  },
  pt: {
    // PT: tentative — review
    typed_name_label: 'Digite seu nome completo para confirmar sua identidade:',
    typed_name_placeholder: 'Nome legal completo',
    name_mismatch: 'O nome inserido n\u00e3o corresponde aos nossos registros. Por favor, tente novamente.',
    sig_label: 'Desenhe sua assinatura abaixo:',
    clear: 'Limpar',
    cancel: 'Cancelar',
    submit: 'Assinar',
    submitting: 'Assinando\u2026',
    sig_required: 'Por favor desenhe sua assinatura antes de continuar.',
    name_required: 'Por favor digite seu nome completo antes de assinar.',
  },
};

export default function SignaturePadGate({
  language, consentText, expectedName, submitting, error, onSubmit, onCancel,
}: Props) {
  const c = copy[language] ?? copy.en;
  const [typedName, setTypedName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = () => {
    setLocalError('');
    if (!typedName.trim()) { setLocalError(c.name_required); return; }
    if (expectedName) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalize(typedName) !== normalize(expectedName)) {
        setLocalError(c.name_mismatch);
        return;
      }
    }
    if (!signatureData) { setLocalError(c.sig_required); return; }
    onSubmit(signatureData, typedName.trim());
  };

  const displayError = error || localError;

  return (
    <div className="space-y-5">
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
          autoComplete="name"
        />
      </div>

      {/* Consent text */}
      <div className="bg-[var(--paper)] border border-[var(--border)] p-4">
        <p className="text-xs text-[var(--body)] leading-relaxed">{consentText}</p>
      </div>

      {/* Signature canvas */}
      <SignatureCanvasComponent
        label={c.sig_label}
        value={signatureData}
        onSave={(dataUrl) => setSignatureData(dataUrl)}
      />

      {displayError && (
        <p className="text-sm text-[var(--error)]">{displayError}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm font-medium hover:bg-[var(--paper)] transition-colors"
        >
          {c.cancel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !signatureData || !typedName.trim()}
          className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {submitting ? c.submitting : c.submit}
        </button>
      </div>
    </div>
  );
}
