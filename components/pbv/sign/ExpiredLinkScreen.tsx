'use client';

/**
 * components/pbv/sign/ExpiredLinkScreen.tsx
 *
 * Friendly full-screen error shown when a magic_link_token has expired (410).
 * Instructions: ask household for a new link.
 *
 * Open decision resolved (PRD-27): friendly message + instructions.
 */

import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language?: PreferredLanguage;
}

interface CopyMap {
  title: string;
  body: string;
  instructions: string;
}

const copy: Record<NonNullable<PreferredLanguage>, CopyMap> = {
  en: {
    title: 'This link has expired',
    body: 'The signing link you received is no longer active. Magic links expire after 30 days.',
    instructions: 'Please ask the head of household to send you a new link from the application dashboard.',
  },
  es: {
    title: 'Este enlace ha caducado',
    body: 'El enlace de firma que recibi\u00f3 ya no est\u00e1 activo. Los enlaces caducan despu\u00e9s de 30 d\u00edas.',
    instructions: 'Solicite al jefe de hogar que le env\u00ede un nuevo enlace desde el panel de solicitud.',
  },
  pt: {
    // PT: tentative — review
    title: 'Este link expirou',
    body: 'O link de assinatura que voc\u00ea recebeu n\u00e3o est\u00e1 mais ativo. Os links expiram ap\u00f3s 30 dias.',
    instructions: 'Peça ao chefe de fam\u00edlia que envie um novo link pelo painel de solicita\u00e7\u00e3o.',
  },
};

export default function ExpiredLinkScreen({ language = 'en' }: Props) {
  const c = copy[language] ?? copy.en;
  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="text-5xl">&#8987;</div>
        <h1 className="font-serif text-2xl text-[var(--primary)]">{c.title}</h1>
        <p className="text-sm text-[var(--body)] leading-relaxed">{c.body}</p>
        <div className="bg-[var(--paper)] border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted)]">{c.instructions}</p>
        </div>
      </div>
    </div>
  );
}
