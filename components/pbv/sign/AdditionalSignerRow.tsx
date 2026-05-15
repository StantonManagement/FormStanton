'use client';

/**
 * components/pbv/sign/AdditionalSignerRow.tsx
 *
 * Single row in the additional-signers list.
 * Two action buttons: [Sign on this phone now] [Send their own link]
 * Shows status badge when signed or link sent.
 */

import type { PreferredLanguage } from '@/types/compliance';
import type { AdditionalSigner } from '@/lib/pbv/hooks/useAdditionalSigners';

interface Props {
  signer: AdditionalSigner;
  language: PreferredLanguage;
  sendingLinkId: string | null;
  linkSentIds: Set<string>;
  onHandoff: (memberId: string, memberName: string) => void;
  onSendLink: (memberId: string) => void;
}

interface CopyMap {
  sign_now: string;
  send_link: string;
  signed_badge: string;
  link_sent_badge: string;
  sending: string;
  pending_badge: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    sign_now: 'Sign on this phone',
    send_link: 'Send their own link',
    signed_badge: 'Signed \u2713',
    link_sent_badge: 'Link sent',
    sending: 'Sending\u2026',
    pending_badge: 'Pending',
  },
  es: {
    sign_now: 'Firmar en este tel\u00e9fono',
    send_link: 'Enviar su propio enlace',
    signed_badge: 'Firmado \u2713',
    link_sent_badge: 'Enlace enviado',
    sending: 'Enviando\u2026',
    pending_badge: 'Pendiente',
  },
  pt: {
    // PT: tentative — review
    sign_now: 'Assinar neste telefone',
    send_link: 'Enviar link pr\u00f3prio',
    signed_badge: 'Assinado \u2713',
    link_sent_badge: 'Link enviado',
    sending: 'Enviando\u2026',
    pending_badge: 'Pendente',
  },
};

export default function AdditionalSignerRow({
  signer, language, sendingLinkId, linkSentIds, onHandoff, onSendLink,
}: Props) {
  const c = copy[language] ?? copy.en;
  const isSending = sendingLinkId === signer.member_id;
  const linkSent = linkSentIds.has(signer.member_id) || signer.magic_link_generated;

  return (
    <div className="bg-white border border-[var(--border)] p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--body)]">{signer.name}</p>
          {signer.age !== null && (
            <p className="text-xs text-[var(--muted)]">Age {signer.age}</p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 flex-shrink-0 ${
          signer.has_signed
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
            : 'text-[var(--muted)] bg-[var(--paper)] border border-[var(--border)]'
        }`}>
          {signer.has_signed ? c.signed_badge : c.pending_badge}
        </span>
      </div>

      {!signer.has_signed && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onHandoff(signer.member_id, signer.name)}
            className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity px-2"
          >
            {c.sign_now}
          </button>
          <button
            type="button"
            onClick={() => onSendLink(signer.member_id)}
            disabled={isSending || linkSent}
            className="flex-1 min-h-[44px] border border-[var(--primary)] text-[var(--primary)] text-xs font-medium hover:bg-[var(--paper)] disabled:opacity-50 px-2"
          >
            {isSending ? c.sending : linkSent ? c.link_sent_badge : c.send_link}
          </button>
        </div>
      )}
    </div>
  );
}
