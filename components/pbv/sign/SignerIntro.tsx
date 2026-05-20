'use client';

/**
 * components/pbv/sign/SignerIntro.tsx
 *
 * Intro panel shown to a non-HOH adult before they sign.
 * Explains what they are being asked to do, scoped to the household context.
 * Displayed in same-device handoff + magic-link recipient flow.
 */

import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language: PreferredLanguage;
  signerName: string;
  hohName: string;
  formCount: number;
  onBegin: () => void;
  onDecline?: () => void;
}

interface CopyMap {
  heading: (signerName: string) => string;
  body: (hohName: string, formCount: number) => string;
  note: string;
  begin_btn: string;
  decline_btn: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    heading: (name) => `Hello, ${name}`,
    body: (hoh, n) =>
      `You are being asked to sign ${n} form${n !== 1 ? 's' : ''} as part of ${hoh}'s PBV housing application. You will review each document and sign for yourself. Your HOH cannot sign on your behalf.`,
    note: 'You will not be able to edit any application information — you can only sign the documents shown to you.',
    begin_btn: 'Review and sign my forms',
    decline_btn: 'I don\u2019t want to sign right now',
  },
  es: {
    heading: (name) => `Hola, ${name}`,
    body: (hoh, n) =>
      `Se le pide que firme ${n} formulario${n !== 1 ? 's' : ''} como parte de la solicitud de vivienda PBV de ${hoh}. Revisar\u00e1 cada documento y firmar\u00e1 en su propio nombre. El jefe de hogar no puede firmar en su nombre.`,
    note: 'No podr\u00e1 editar ning\u00fan dato de la solicitud \u2014 solo podr\u00e1 firmar los documentos que se le muestren.',
    begin_btn: 'Revisar y firmar mis formularios',
    decline_btn: 'No quiero firmar ahora mismo',
  },
  pt: {
    // PT: tentative — review
    heading: (name) => `Ol\u00e1, ${name}`,
    body: (hoh, n) =>
      `Voc\u00ea est\u00e1 sendo solicitado a assinar ${n} formul\u00e1rio${n !== 1 ? 's' : ''} como parte da solicita\u00e7\u00e3o de moradia PBV de ${hoh}. Voc\u00ea revisar\u00e1 cada documento e assinar\u00e1 por si mesmo. O chefe de fam\u00edlia n\u00e3o pode assinar em seu nome.`,
    note: 'Voc\u00ea n\u00e3o poder\u00e1 editar nenhuma informa\u00e7\u00e3o da solicita\u00e7\u00e3o \u2014 apenas assinar os documentos mostrados a voc\u00ea.',
    begin_btn: 'Revisar e assinar meus formul\u00e1rios',
    decline_btn: 'N\u00e3o quero assinar agora',
  },
};

export default function SignerIntro({ language, signerName, hohName, formCount, onBegin, onDecline }: Props) {
  const c = copy[language] ?? copy.en;
  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-5">
        <h1 className="font-serif text-2xl text-[var(--primary)]">{c.heading(signerName)}</h1>
        <p className="text-sm text-[var(--body)] leading-relaxed">{c.body(hohName, formCount)}</p>
        <div className="bg-[var(--paper)] border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted)]">{c.note}</p>
        </div>
        <button
          type="button"
          onClick={onBegin}
          className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {c.begin_btn}
        </button>
        {onDecline && (
          <button
            type="button"
            onClick={onDecline}
            className="w-full min-h-[44px] border border-[var(--border)] text-[var(--body)] text-sm hover:bg-[var(--paper)]"
          >
            {c.decline_btn}
          </button>
        )}
      </div>
    </div>
  );
}
