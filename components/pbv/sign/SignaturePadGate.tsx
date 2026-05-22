'use client';

/**
 * components/pbv/sign/SignaturePadGate.tsx
 *
 * Wraps SignatureCanvas with:
 *   - Typed-name identity confirmation
 *   - Consent text (versioned, from lib/pbv/consent-text.ts)
 *   - Cancel / Submit buttons
 *
 * PRP-006 / A1: a keyboard-reachable typed-signature fallback. Users who
 * can't draw (keyboard-only, motor-impaired) toggle into "Type my
 * signature" mode; their typed name is rendered to an offscreen canvas in
 * a script font and exported to the same PNG data-URL the draw path
 * produces. The downstream `signature/capture` endpoint is unchanged.
 *
 * PRP-006 / A3 + A4: errors are wrapped in an aria-live="polite" status
 * region with a stable id; the typed-name input declares aria-describedby
 * pointing at that region so SR users hear the error when validation fails.
 *
 * On Submit: calls onSubmit(signatureDataUrl, typedName).
 * Caller is responsible for the API calls.
 */

import { useEffect, useRef, useState } from 'react';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import AssistedHandoffPrompt from '@/components/pbv/AssistedHandoffPrompt';
import type { PreferredLanguage } from '@/types/compliance';

interface AssistedModeProps {
  staffDisplayName: string;
  tenantName: string;
}

interface Props {
  language: PreferredLanguage;
  consentText: string;
  expectedName?: string;
  submitting: boolean;
  error?: string;
  onSubmit: (signatureDataUrl: string, typedName: string) => void;
  onCancel: () => void;
  assistedMode?: AssistedModeProps | null;
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
    submitting: 'Signing…',
    sig_required: 'Please draw your signature before continuing.',
    name_required: 'Please type your full name before signing.',
    toggle_to_typed: 'Type my signature instead',
    toggle_to_drawn: 'Draw my signature instead',
    typed_sig_label: 'Your typed signature:',
    typed_sig_hint: 'We will use your typed name as your signature.',
  },
  es: {
    typed_name_label: 'Escriba su nombre completo para confirmar su identidad:',
    typed_name_placeholder: 'Nombre legal completo',
    name_mismatch: 'El nombre ingresado no coincide con nuestros registros. Por favor intente de nuevo.',
    sig_label: 'Dibuje su firma a continuación:',
    clear: 'Borrar',
    cancel: 'Cancelar',
    submit: 'Firmar',
    submitting: 'Firmando…',
    sig_required: 'Por favor dibuje su firma antes de continuar.',
    name_required: 'Por favor escriba su nombre completo antes de firmar.',
    toggle_to_typed: 'Escribir mi firma en su lugar',
    toggle_to_drawn: 'Dibujar mi firma en su lugar',
    typed_sig_label: 'Su firma escrita:',
    typed_sig_hint: 'Usaremos su nombre escrito como su firma.',
  },
  pt: {
    typed_name_label: 'Digite seu nome completo para confirmar sua identidade:',
    typed_name_placeholder: 'Nome legal completo',
    name_mismatch: 'O nome inserido não corresponde aos nossos registros. Por favor, tente novamente.',
    sig_label: 'Desenhe sua assinatura abaixo:',
    clear: 'Limpar',
    cancel: 'Cancelar',
    submit: 'Assinar',
    submitting: 'Assinando…',
    sig_required: 'Por favor desenhe sua assinatura antes de continuar.',
    name_required: 'Por favor digite seu nome completo antes de assinar.',
    toggle_to_typed: 'Digitar minha assinatura',
    toggle_to_drawn: 'Desenhar minha assinatura',
    typed_sig_label: 'Sua assinatura digitada:',
    typed_sig_hint: 'Usaremos seu nome digitado como sua assinatura.',
  },
};

/**
 * Render the typed name to an offscreen canvas in a script font and return
 * a PNG data URL — the same image contract react-signature-canvas produces,
 * so the downstream signature/capture path is identical.
 */
export function renderTypedSignaturePng(name: string, dpr = 1): string {
  if (typeof document === 'undefined') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const cssW = 400;
  const cssH = 100;
  const canvas = document.createElement('canvas');
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // Cursive falls back through several script-style families.
  ctx.font = "italic 38px 'Brush Script MT', 'Lucida Handwriting', 'Segoe Script', cursive";
  ctx.fillText(trimmed, cssW / 2, cssH / 2);
  return canvas.toDataURL('image/png');
}

export default function SignaturePadGate({
  language, consentText, expectedName, submitting, error, onSubmit, onCancel, assistedMode,
}: Props) {
  const c = copy[language] ?? copy.en;
  const [typedName, setTypedName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [typedSignatureMode, setTypedSignatureMode] = useState(false);
  const [localError, setLocalError] = useState('');
  const [handoffConfirmed, setHandoffConfirmed] = useState(!assistedMode);
  const errorId = 'signature-pad-error';
  const typedNameId = 'signature-typed-name';
  const typedSigPreviewRef = useRef<HTMLCanvasElement>(null);

  // Keep the typed-signature image in sync with what the user typed, while
  // typed-signature mode is active. We also paint a small preview so the
  // user can see what their "signature" will look like.
  useEffect(() => {
    if (!typedSignatureMode) return;
    const dataUrl = renderTypedSignaturePng(typedName, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    setSignatureData(dataUrl);
    const preview = typedSigPreviewRef.current;
    if (preview && dataUrl) {
      const img = new Image();
      img.onload = () => {
        const ctx = preview.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, preview.width, preview.height);
        ctx.drawImage(img, 0, 0, preview.width, preview.height);
      };
      img.src = dataUrl;
    }
  }, [typedName, typedSignatureMode]);

  if (!handoffConfirmed && assistedMode) {
    return (
      <AssistedHandoffPrompt
        tenantName={assistedMode.tenantName}
        staffName={assistedMode.staffDisplayName}
        onConfirm={() => setHandoffConfirmed(true)}
      />
    );
  }

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
    // In typed-signature mode the effect already produced signatureData from
    // typedName; in draw mode the canvas pushes onto signatureData on touch/
    // mouse-end. Either path lands here as a non-empty PNG data URL.
    if (!signatureData) { setLocalError(c.sig_required); return; }
    onSubmit(signatureData, typedName.trim());
  };

  const displayError = error || localError;

  return (
    <div className="space-y-5">
      {/* Typed name */}
      <div>
        <label htmlFor={typedNameId} className="block text-sm font-medium text-[var(--body)] mb-1">
          {c.typed_name_label}
        </label>
        <input
          id={typedNameId}
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={c.typed_name_placeholder}
          className="block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          autoComplete="name"
          aria-describedby={displayError ? errorId : undefined}
          aria-invalid={displayError ? true : undefined}
        />
      </div>

      {/* Consent text */}
      <div className="bg-[var(--paper)] border border-[var(--border)] p-4">
        <p className="text-xs text-[var(--body)] leading-relaxed">{consentText}</p>
      </div>

      {/* Signature: draw OR typed */}
      {typedSignatureMode ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--body)]">
            {c.typed_sig_label}
          </label>
          <div className="border-2 border-[var(--border)] rounded-lg bg-white p-2">
            <canvas
              ref={typedSigPreviewRef}
              width={400}
              height={100}
              role="img"
              aria-label={typedName ? typedName : c.typed_sig_hint}
              className="w-full h-24"
            />
          </div>
          <p className="text-xs text-[var(--muted,#666)]">{c.typed_sig_hint}</p>
        </div>
      ) : (
        <SignatureCanvasComponent
          label={c.sig_label}
          value={signatureData}
          onSave={(dataUrl) => setSignatureData(dataUrl)}
          id="signature-pad"
        />
      )}

      <div>
        <button
          type="button"
          onClick={() => {
            setTypedSignatureMode(prev => !prev);
            setSignatureData('');
            setLocalError('');
          }}
          className="text-sm text-[var(--primary)] underline focus:outline focus:outline-2"
        >
          {typedSignatureMode ? c.toggle_to_drawn : c.toggle_to_typed}
        </button>
      </div>

      {/* A11y: error region with stable id + role=status + aria-live */}
      <div id={errorId} role="status" aria-live="polite" className="min-h-[1.25rem]">
        {displayError && (
          <p className="text-sm text-[var(--error)]">{displayError}</p>
        )}
      </div>

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
          disabled={submitting || !typedName.trim() || (!signatureData && !typedSignatureMode)}
          className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {submitting ? c.submitting : c.submit}
        </button>
      </div>
    </div>
  );
}
