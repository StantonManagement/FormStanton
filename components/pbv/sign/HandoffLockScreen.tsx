'use client';

/**
 * components/pbv/sign/HandoffLockScreen.tsx
 *
 * Confirmation screen shown to the HOH before handing the device.
 * HOH must tap "Hand to [name]" to proceed — prevents accidental over-signing.
 * Back button is deliberately absent after handoff begins (see PRD-27 § 7).
 */

import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language: PreferredLanguage;
  signerName: string;
  hohName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface CopyMap {
  title: (name: string) => string;
  body: (name: string) => string;
  warning: string;
  confirm_btn: (name: string) => string;
  cancel_btn: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    title: (name) => `Hand to ${name}`,
    body: (name) =>
      `You are about to hand your device to ${name}. They will sign on their own behalf. Once you hand it over, you will not be able to return to your dashboard until they finish or cancel.`,
    warning: 'You cannot sign on behalf of another adult. Each person must sign for themselves.',
    confirm_btn: (name) => `Hand to ${name}`,
    cancel_btn: 'Cancel',
  },
  es: {
    title: (name) => `Entregar a ${name}`,
    body: (name) =>
      `Est\u00e1 a punto de entregar su dispositivo a ${name}. Ellos firmar\u00e1n en su propio nombre. Una vez entregado, no podr\u00e1 volver a su panel hasta que terminen o cancelen.`,
    warning: 'No puede firmar en nombre de otro adulto. Cada persona debe firmar por s\u00ed misma.',
    confirm_btn: (name) => `Entregar a ${name}`,
    cancel_btn: 'Cancelar',
  },
  pt: {
    // PT: tentative — review
    title: (name) => `Passar para ${name}`,
    body: (name) =>
      `Voc\u00ea est\u00e1 prestes a passar seu dispositivo para ${name}. Eles assinar\u00e3o em seu pr\u00f3prio nome. Ap\u00f3s a entrega, voc\u00ea n\u00e3o poder\u00e1 voltar ao seu painel at\u00e9 que eles terminem ou cancelem.`,
    warning: 'Voc\u00ea n\u00e3o pode assinar em nome de outro adulto. Cada pessoa deve assinar por si mesma.',
    confirm_btn: (name) => `Passar para ${name}`,
    cancel_btn: 'Cancelar',
  },
};

export default function HandoffLockScreen({ language, signerName, hohName: _hohName, onConfirm, onCancel }: Props) {
  const c = copy[language] ?? copy.en;
  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-5">
        <h1 className="font-serif text-2xl text-[var(--primary)]">{c.title(signerName)}</h1>
        <p className="text-sm text-[var(--body)] leading-relaxed">{c.body(signerName)}</p>
        <div className="border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs text-amber-800 font-medium">{c.warning}</p>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {c.confirm_btn(signerName)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm hover:bg-[var(--paper)]"
        >
          {c.cancel_btn}
        </button>
      </div>
    </div>
  );
}
