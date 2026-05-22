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
 *
 * PRP-007:
 *   - role=dialog + aria-modal=true + aria-labelledby on the form name.
 *   - Focus trap on Tab/Shift-Tab; focus moves into the modal on open;
 *     restores focus to the prior trigger element on close/Esc.
 *   - Esc closes.
 *   - Error region: aria-live=polite role=status with stable id; confirm-name
 *     input declares aria-describedby pointing at it.
 *   - iframes: loading=lazy.
 *   - Mobile heights use dvh (Tailwind arbitrary values); iOS Safari toolbar
 *     no longer pushes the Sign button off-screen.
 *   - "Scroll down to continue" cue under the iframe on mobile (the iframe
 *     traps touch-scroll on iOS; the cue tells users to scroll the outer
 *     scrollable container instead).
 */

import { useEffect, useId, useRef, useState } from 'react';
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
    signing: 'Signing…',
    cancel: 'Cancel',
    typed_name_label: 'Confirm your name:',
    typed_name_placeholder: 'Full legal name',
    preparing: 'Preparing document…',
    scroll_cue: 'Scroll down to continue ↓',
  },
  es: {
    preview_label: 'Vista previa del documento',
    confirm_label: 'He revisado este documento y autorizo que se aplique mi firma.',
    sign_btn: 'Firmar este formulario',
    signing: 'Firmando…',
    cancel: 'Cancelar',
    typed_name_label: 'Confirme su nombre:',
    typed_name_placeholder: 'Nombre legal completo',
    preparing: 'Preparando documento…',
    scroll_cue: 'Deslice hacia abajo para continuar ↓',
  },
  pt: {
    preview_label: 'Prévia do documento',
    confirm_label: 'Revisei este documento e autorizo a aplicação da minha assinatura.',
    sign_btn: 'Assinar este formulário',
    signing: 'Assinando…',
    cancel: 'Cancelar',
    typed_name_label: 'Confirme seu nome:',
    typed_name_placeholder: 'Nome legal completo',
    preparing: 'Preparando documento…',
    scroll_cue: 'Role para baixo para continuar ↓',
  },
};

/**
 * Minimal focus trap: returns props to spread on the modal container, plus
 * handles Tab/Shift-Tab cycling and Esc-to-close. Restores focus to the
 * element that was active when the modal opened.
 */
function useModalFocusTrap(onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Capture the trigger element so we can restore focus on close.
    if (typeof document !== 'undefined') {
      triggerRef.current = (document.activeElement as HTMLElement) || null;
    }

    // Move focus into the modal on next tick (after children mount).
    const node = containerRef.current;
    const focusFirst = () => {
      if (!node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      if (first) first.focus();
      else node.focus();
    };
    const id = window.setTimeout(focusFirst, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('inert'));
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to the trigger on unmount.
      const t = triggerRef.current;
      if (t && typeof t.focus === 'function') t.focus();
    };
  }, [onClose]);

  return containerRef;
}

export default function FormReviewSignModal({
  token, language, form, hasSignature, hohName,
  submitting, error, onSign, onClose,
}: Props) {
  const c = copy[language] ?? copy.en;
  const [confirmed, setConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const pdfUrl = `/api/t/${token}/pbv-full-app/forms/${form.id}/preview`;
  const titleId = useId();
  const errorId = useId();
  const inputId = useId();
  const containerRef = useModalFocusTrap(onClose);

  // PR-3: Check if form PDF is ready before rendering iframe
  const isPdfReady = ['generated', 'signed', 'finalized'].includes(form.status);

  // If no signature yet, use SignaturePadGate flow
  if (!hasSignature) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-white w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 space-y-4 focus:outline-none"
        >
          <p id={titleId} className="font-semibold text-[var(--body)]">{form.display_name}</p>

          {/* PDF iframe — guarded by form status to prevent raw JSON display */}
          {isPdfReady ? (
            <div className="border border-[var(--border)] h-[40dvh]">
              <iframe
                src={pdfUrl}
                loading="lazy"
                className="w-full h-full"
                title={form.display_name}
              />
            </div>
          ) : (
            <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center h-[40dvh]">
              <p className="text-sm text-[var(--muted)]">{c.preparing}</p>
            </div>
          )}

          {/* Mobile scroll cue — the iframe traps touch-scroll on iOS,
              so we tell users to scroll the outer panel instead. */}
          <p className="text-xs text-[var(--muted)] text-center sm:hidden" aria-hidden="true">
            {c.scroll_cue}
          </p>

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
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white w-full max-w-lg max-h-[90dvh] overflow-y-auto p-6 space-y-4 focus:outline-none"
      >
        <p id={titleId} className="font-semibold text-[var(--body)]">{form.display_name}</p>

        {/* PDF iframe — guarded by form status to prevent raw JSON display */}
        {isPdfReady ? (
          <div className="border border-[var(--border)] h-[40dvh]">
            <iframe
              src={pdfUrl}
              loading="lazy"
              className="w-full h-full"
              title={form.display_name}
            />
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center h-[40dvh]">
            <p className="text-sm text-[var(--muted)]">{c.preparing}</p>
          </div>
        )}

        <p className="text-xs text-[var(--muted)] text-center sm:hidden" aria-hidden="true">
          {c.scroll_cue}
        </p>

        <ConsentText language={language} />

        {/* Typed name */}
        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--body)] mb-1">
            {c.typed_name_label}
          </label>
          <input
            id={inputId}
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={c.typed_name_placeholder}
            className="block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
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

        {/* aria-live error region — stable id referenced by typed-name input */}
        <div id={errorId} role="status" aria-live="polite" className="min-h-[1.25rem]">
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        </div>

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
