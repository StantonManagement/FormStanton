'use client';

/**
 * components/pbv/sign/IdentityCapturePanel.tsx
 *
 * Typed-name entry with soft-match validation (PRD-27 § 4).
 * On submit: calls onIdentityConfirmed(typedName).
 * If soft-match mismatch: shows warning with [Use my typed name] / [Edit] options.
 * Does NOT block on mismatch — warning only.
 */

import { useState } from 'react';
import { softMatchName } from '@/lib/pbv/nameMatch';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language: PreferredLanguage;
  expectedName: string;
  onConfirmed: (typedName: string) => void;
  onCancel: () => void;
}

interface CopyMap {
  title: string;
  instruction: string;
  placeholder: string;
  required_error: string;
  mismatch_warning: (expected: string) => string;
  use_typed: string;
  edit_btn: string;
  continue_btn: string;
  cancel: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    title: 'Confirm Your Identity',
    instruction: 'Please type your full legal name exactly as it appears on your ID.',
    placeholder: 'Full legal name',
    required_error: 'Please enter your full name before continuing.',
    mismatch_warning: (expected) =>
      `The name you entered does not match our records (${expected}). Are you sure you want to use the name you typed?`,
    use_typed: 'Use my typed name',
    edit_btn: 'Edit',
    continue_btn: 'Continue',
    cancel: 'Cancel',
  },
  es: {
    title: 'Confirme su Identidad',
    instruction: 'Por favor escriba su nombre legal completo tal como aparece en su identificaci\u00f3n.',
    placeholder: 'Nombre legal completo',
    required_error: 'Por favor ingrese su nombre completo antes de continuar.',
    mismatch_warning: (expected) =>
      `El nombre ingresado no coincide con nuestros registros (${expected}). \u00bfEst\u00e1 seguro de que desea usar el nombre que escribi\u00f3?`,
    use_typed: 'Usar mi nombre escrito',
    edit_btn: 'Editar',
    continue_btn: 'Continuar',
    cancel: 'Cancelar',
  },
  pt: {
    // PT: tentative — review
    title: 'Confirme sua Identidade',
    instruction: 'Por favor, digite seu nome legal completo exatamente como aparece em seu documento.',
    placeholder: 'Nome legal completo',
    required_error: 'Por favor, insira seu nome completo antes de continuar.',
    mismatch_warning: (expected) =>
      `O nome inserido n\u00e3o corresponde aos nossos registros (${expected}). Tem certeza de que deseja usar o nome digitado?`,
    use_typed: 'Usar meu nome digitado',
    edit_btn: 'Editar',
    continue_btn: 'Continuar',
    cancel: 'Cancelar',
  },
};

export default function IdentityCapturePanel({ language, expectedName, onConfirmed, onCancel }: Props) {
  const c = copy[language] ?? copy.en;
  const [typedName, setTypedName] = useState('');
  const [error, setError] = useState('');
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);

  const handleContinue = () => {
    setError('');
    const trimmed = typedName.trim();
    if (trimmed.length < 2) { setError(c.required_error); return; }
    const result = softMatchName(trimmed, expectedName);
    if (result === 'mismatch') {
      setShowMismatchWarning(true);
      return;
    }
    onConfirmed(trimmed);
  };

  if (showMismatchWarning) {
    return (
      <div className="space-y-4">
        <div className="border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{c.mismatch_warning(expectedName)}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowMismatchWarning(false)}
            className="flex-1 min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm font-medium hover:bg-[var(--paper)]"
          >
            {c.edit_btn}
          </button>
          <button
            type="button"
            onClick={() => onConfirmed(typedName.trim())}
            className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {c.use_typed}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl text-[var(--primary)] mb-1">{c.title}</h2>
        <p className="text-sm text-[var(--muted)]">{c.instruction}</p>
      </div>
      <input
        type="text"
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        placeholder={c.placeholder}
        autoComplete="name"
        className="block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
      />
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm font-medium hover:bg-[var(--paper)]"
        >
          {c.cancel}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {c.continue_btn}
        </button>
      </div>
    </div>
  );
}
