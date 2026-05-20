'use client';

import { useResumeLink } from '@/lib/pbv/hooks/useResumeLink';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  token: string;
  language?: PreferredLanguage;
  onSent?: () => void;
}

const copy: Record<PreferredLanguage, {
  button: string;
  sending: string;
  sent: string;
  rate_limited: string;
  error: string;
}> = {
  en: {
    button: 'Pick up later',
    sending: 'Sending link…',
    sent: 'Link sent to your phone',
    rate_limited: 'Link sent recently. Try again in {n} min.',
    error: 'Could not send. Try again.',
  },
  es: {
    button: 'Continuar después',
    sending: 'Enviando enlace…',
    sent: 'Enlace enviado a su teléfono',
    rate_limited: 'Enlace enviado recientemente. Intente en {n} min.',
    error: 'No se pudo enviar. Intente de nuevo.',
  },
  pt: {
    button: 'Continuar depois', // PT: tentative — review
    sending: 'Enviando link…',
    sent: 'Link enviado para seu telefone',
    rate_limited: 'Link enviado recentemente. Tente em {n} min.',
    error: 'Não foi possível enviar. Tente novamente.',
  },
};

export default function PickUpLaterButton({ token, language = 'en', onSent }: Props) {
  const { status, errorMessage, retryAfterMinutes, sendResumeLink } = useResumeLink(token);
  const c = copy[language] ?? copy.en;

  const handleClick = async () => {
    await sendResumeLink();
    if (status === 'sent' && onSent) onSent();
  };

  if (status === 'sent') {
    return (
      <span className="text-xs text-[var(--muted)] py-2">{c.sent}</span>
    );
  }

  if (status === 'rate_limited') {
    return (
      <span className="text-xs text-[var(--muted)] py-2">
        {c.rate_limited.replace('{n}', String(retryAfterMinutes ?? 60))}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'sending'}
        className="text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--primary)] transition-colors min-h-[44px] px-2"
      >
        {status === 'sending' ? c.sending : c.button}
      </button>
      {status === 'error' && (
        <span className="text-xs text-[var(--error)]">{errorMessage || c.error}</span>
      )}
    </div>
  );
}
