'use client';

/**
 * components/pbv/sign/AdditionalSignersPanel.tsx
 *
 * Orchestrates the additional-signers screen and same-device handoff flow.
 *
 * State machine:
 *   list       → shows AdditionalSignerRow per non-HOH adult
 *   lock_screen → HandoffLockScreen (HOH confirms handoff)
 *   identity    → IdentityCapturePanel (signer types name)
 *   intro       → SignerIntro (signer reads context)
 *   signing     → FormsStack scoped to this member's forms
 *   done        → returns to list
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdditionalSignerRow from './AdditionalSignerRow';
import HandoffLockScreen from './HandoffLockScreen';
import IdentityCapturePanel from './IdentityCapturePanel';
import SignerIntro from './SignerIntro';
import FormsStack from './FormsStack';
import { useAdditionalSigners } from '@/lib/pbv/hooks/useAdditionalSigners';
import { useFormStack } from '@/lib/pbv/hooks/useFormStack';
import { tenantFetch } from '@/lib/tenantFetch';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  token: string;
  language: PreferredLanguage;
  hohName: string;
  hohMemberId: string;
}

type PanelStep = 'list' | 'lock_screen' | 'identity' | 'intro' | 'signing';

interface ActiveHandoff {
  memberId: string;
  memberName: string;
  confirmedName: string;
}

interface CopyMap {
  title: string;
  subtitle_pending: (n: number) => string;
  subtitle_done: string;
  back: string;
  all_done_title: string;
  all_done_body: string;
  return_dashboard: string;
  loading_forms: string;
  send_error: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    title: 'Other Adults Need to Sign',
    subtitle_pending: (n) => `${n} adult${n !== 1 ? 's' : ''} still need${n === 1 ? 's' : ''} to sign.`,
    subtitle_done: 'All adults have signed.',
    back: '\u2190 Back to dashboard',
    all_done_title: 'All adults have signed!',
    all_done_body: 'Return to your dashboard to submit your application.',
    return_dashboard: 'Return to dashboard',
    loading_forms: 'Loading forms\u2026',
    send_error: 'Could not send link: ',
  },
  es: {
    title: 'Otros Adultos Deben Firmar',
    subtitle_pending: (n) => `${n} adulto${n !== 1 ? 's' : ''} a\u00fan deb${n === 1 ? 'e' : 'en'} firmar.`,
    subtitle_done: 'Todos los adultos han firmado.',
    back: '\u2190 Volver al panel',
    all_done_title: '\u00a1Todos los adultos han firmado!',
    all_done_body: 'Regrese a su panel para enviar su solicitud.',
    return_dashboard: 'Volver al panel',
    loading_forms: 'Cargando formularios\u2026',
    send_error: 'No se pudo enviar el enlace: ',
  },
  pt: {
    // PT: tentative — review
    title: 'Outros Adultos Precisam Assinar',
    subtitle_pending: (n) => `${n} adulto${n !== 1 ? 's' : ''} ainda precisa${n !== 1 ? 'm' : ''} assinar.`,
    subtitle_done: 'Todos os adultos assinaram.',
    back: '\u2190 Voltar ao painel',
    all_done_title: 'Todos os adultos assinaram!',
    all_done_body: 'Volte ao seu painel para enviar sua solicita\u00e7\u00e3o.',
    return_dashboard: 'Voltar ao painel',
    loading_forms: 'Carregando formul\u00e1rios\u2026',
    send_error: 'N\u00e3o foi poss\u00edvel enviar o link: ',
  },
};

interface CopyMapWithFn {
  title: string;
  subtitle_pending: (n: number) => string;
  subtitle_done: string;
  back: string;
  all_done_title: string;
  all_done_body: string;
  return_dashboard: string;
  loading_forms: string;
  send_error: string;
}

const typedCopy: Record<PreferredLanguage, CopyMapWithFn> = copy as unknown as Record<PreferredLanguage, CopyMapWithFn>;

export default function AdditionalSignersPanel({ token, language, hohName, hohMemberId }: Props) {
  const c = typedCopy[language] ?? typedCopy.en;
  const router = useRouter();
  const { state: signersState, reload: reloadSigners } = useAdditionalSigners(token);
  const { state: formsState, reload: reloadForms } = useFormStack(token);

  const [step, setStep] = useState<PanelStep>('list');
  const [activeHandoff, setActiveHandoff] = useState<ActiveHandoff | null>(null);
  const [sendingLinkId, setSendingLinkId] = useState<string | null>(null);
  const [linkSentIds, setLinkSentIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState('');

  const allForms = formsState.status === 'ready' ? formsState.forms : [];

  // Filter forms to only those requiring this signer
  // The API returns forms with required_signer_count; we approximate by showing all unsigned
  // forms to the non-HOH signer. The sign-form endpoint enforces the actual gate.
  const formsForActiveSigner = allForms.filter((f) => !f.signatures_complete);

  const handleStartHandoff = (memberId: string, memberName: string) => {
    setActiveHandoff({ memberId, memberName, confirmedName: '' });
    setStep('lock_screen');
  };

  const handleLockConfirm = () => {
    setStep('identity');
  };

  const handleIdentityConfirmed = (typedName: string) => {
    setActiveHandoff((prev) => prev ? { ...prev, confirmedName: typedName } : null);
    setStep('intro');
  };

  const handleIntroBegin = () => {
    setStep('signing');
  };

  const handleSignerDone = async () => {
    if (activeHandoff) {
      // Post signer-completed event
      await tenantFetch(`/api/t/${token}/pbv-full-app/signer-completed`, {
        method: 'POST',
        body: {
          signer_id: activeHandoff.memberId,
          slot: 0,
          name: activeHandoff.confirmedName || activeHandoff.memberName,
        },
      }).catch(() => null);
    }
    setActiveHandoff(null);
    setStep('list');
    reloadSigners();
    reloadForms();
  };

  const handleSendLink = async (memberId: string) => {
    setSendingLinkId(memberId);
    setSendError('');
    try {
      const res = await tenantFetch(
        `/api/t/${token}/pbv-full-app/additional-signers/${memberId}/send-link`,
        { method: 'POST' }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).message || `Error ${res.status}`);
      setLinkSentIds((prev) => new Set([...prev, memberId]));
    } catch (err: any) {
      setSendError(err.message || 'Send failed.');
    } finally {
      setSendingLinkId(null);
    }
  };

  // — Signing step
  if (step === 'signing' && activeHandoff) {
    if (formsState.status === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
          <p className="text-sm text-[var(--muted)]">{c.loading_forms}</p>
        </div>
      );
    }
    return (
      <FormsStack
        token={token}
        language={language}
        forms={formsForActiveSigner}
        hohName={activeHandoff.confirmedName || activeHandoff.memberName}
        hohMemberId={activeHandoff.memberId}
        summarySigningComplete={true}
        onFormsUpdated={handleSignerDone}
      />
    );
  }

  // — Intro step
  if (step === 'intro' && activeHandoff) {
    return (
      <SignerIntro
        language={language}
        signerName={activeHandoff.memberName}
        hohName={hohName}
        formCount={formsForActiveSigner.length}
        onBegin={handleIntroBegin}
        onDecline={() => { setActiveHandoff(null); setStep('list'); }}
      />
    );
  }

  // — Identity capture step
  if (step === 'identity' && activeHandoff) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full">
          <IdentityCapturePanel
            language={language}
            expectedName={activeHandoff.memberName}
            onConfirmed={handleIdentityConfirmed}
            onCancel={() => { setActiveHandoff(null); setStep('list'); }}
          />
        </div>
      </div>
    );
  }

  // — Lock screen step
  if (step === 'lock_screen' && activeHandoff) {
    return (
      <HandoffLockScreen
        language={language}
        signerName={activeHandoff.memberName}
        hohName={hohName}
        onConfirm={handleLockConfirm}
        onCancel={() => { setActiveHandoff(null); setStep('list'); }}
      />
    );
  }

  // — List step
  if (signersState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading&hellip;</p>
      </div>
    );
  }

  if (signersState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <p className="text-sm text-[var(--error)]">{signersState.message}</p>
      </div>
    );
  }

  const { signers, pending_count } = signersState;
  const allSigned = signers.length > 0 && pending_count === 0;

  if (allSigned) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">&#10003;</div>
          <h1 className="font-serif text-2xl text-[var(--primary)]">{c.all_done_title}</h1>
          <p className="text-sm text-[var(--body)]">{c.all_done_body}</p>
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {c.return_dashboard}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <button type="button" onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
          className="text-sm text-[var(--muted)] mb-4 block hover:text-[var(--body)]">
          {c.back}
        </button>
        <h1 className="font-serif text-2xl text-[var(--primary)] mb-1">{c.title}</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          {allSigned ? c.subtitle_done : c.subtitle_pending(pending_count)}
        </p>

        {sendError && (
          <p className="text-sm text-[var(--error)] mb-4">{c.send_error}{sendError}</p>
        )}

        <div className="space-y-3">
          {signers.map((signer) => (
            <AdditionalSignerRow
              key={signer.member_id}
              signer={signer}
              language={language}
              sendingLinkId={sendingLinkId}
              linkSentIds={linkSentIds}
              onHandoff={handleStartHandoff}
              onSendLink={handleSendLink}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
