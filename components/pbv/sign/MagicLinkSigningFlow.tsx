'use client';

/**
 * components/pbv/sign/MagicLinkSigningFlow.tsx
 *
 * Full magic-link recipient signing experience:
 *   identity capture -> signer intro -> sequential per-form signing
 *
 * Uses /api/pbv-full-app/signer/[member_token]/sign-form directly.
 * device_owner = 'self' (set server-side).
 * Completion screen: "You're done! Close this tab."
 */

import { useEffect, useState } from 'react';
import IdentityCapturePanel from './IdentityCapturePanel';
import SignerIntro from './SignerIntro';
import SignaturePadGate from './SignaturePadGate';
import ConsentText from './ConsentText';
import { CONSENT_TEXT_VERSION, getFormConsent } from '@/lib/pbv/consent-text';
import type { FormDoc } from '@/lib/pbv/hooks/useFormStack';
import type { PreferredLanguage } from '@/types/compliance';

/**
 * PRP-020 / F3: in-app browser detection. Instagram / Facebook / LinkedIn
 * /Twitter and Gmail/Outlook in-app browsers often strip cookies, lack
 * localStorage/sessionStorage, and refuse third-party redirects — which
 * breaks the signer flow with no obvious failure mode. We detect the
 * known UA strings and prompt the user to open the link in their
 * default browser. Non-blocking (informational only).
 *
 * Exported for tests.
 */
export function isInAppBrowser(ua: string): boolean {
  if (!ua) return false;
  const u = ua.toLowerCase();
  return (
    u.includes('instagram') ||
    u.includes('fbav') ||
    u.includes('fban') ||
    u.includes('messenger') ||
    u.includes('linkedinapp') ||
    u.includes('twitter') ||
    u.includes('gmailapp') ||
    u.includes('snapchat') ||
    u.includes('tiktok') ||
    u.includes('line/') ||
    u.includes('wkwebview') && u.includes('mail/')
  );
}

const inAppBrowserCopy: Record<PreferredLanguage, { title: string; body: string; dismiss: string }> = {
  en: {
    title: 'Open in your browser',
    body: 'For the best experience, please open this link in your default browser (Safari, Chrome). Some features may not work in this app.',
    dismiss: 'Continue anyway',
  },
  es: {
    title: 'Abra en su navegador',
    body: 'Para una mejor experiencia, abra este enlace en su navegador predeterminado (Safari, Chrome). Algunas funciones pueden no funcionar en esta aplicación.',
    dismiss: 'Continuar de todos modos',
  },
  pt: {
    title: 'Abra no seu navegador',
    body: 'Para a melhor experiência, abra este link no seu navegador padrão (Safari, Chrome). Alguns recursos podem não funcionar neste aplicativo.',
    dismiss: 'Continuar mesmo assim',
  },
};

interface Props {
  memberToken: string;
  memberId: string;
  memberName: string;
  hohName: string;
  language: PreferredLanguage;
  forms: FormDoc[];
  onFormsUpdated: () => void;
}

type FlowStep = 'identity' | 'intro' | 'signing' | 'done';

interface DoneCopy {
  done_title: string;
  done_body: string;
  done_instruction: string;
}

const doneCopy: Record<PreferredLanguage, DoneCopy> = {
  en: {
    done_title: "You're done!",
    done_body: 'Thank you for signing. Your household will be notified.',
    done_instruction: 'You may now close this tab.',
  },
  es: {
    done_title: '\u00a1Has terminado!',
    done_body: 'Gracias por firmar. Su hogar ser\u00e1 notificado.',
    done_instruction: 'Ahora puede cerrar esta pesta\u00f1a.',
  },
  pt: {
    done_title: 'Voc\u00ea terminou!',
    done_body: 'Obrigado por assinar. Sua fam\u00edlia ser\u00e1 notificada.',
    done_instruction: 'Voc\u00ea pode fechar esta aba agora.',
  },
};

// ——— Inner: sequential per-form signing for magic-link recipients ———

interface InnerProps {
  memberToken: string;
  signerName: string;
  language: PreferredLanguage;
  forms: FormDoc[];
  onAllSigned: () => void;
}

function MagicLinkFormsSigningInner({ memberToken, signerName, language, forms, onAllSigned }: InnerProps) {
  const [index, setIndex] = useState(0);
  const [signatureImagePath, setSignatureImagePath] = useState<string | null>(null);
  const [ceremonyId] = useState(() => crypto.randomUUID());
  const [typedName, setTypedName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lang = language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en';
  const consentText = getFormConsent(lang);

  if (index >= forms.length) {
    onAllSigned();
    return null;
  }

  const form = forms[index];
  const pdfUrl = `/api/pbv-full-app/signer/${memberToken}/forms/${form.id}/preview`;

  // PR-3: Check if form PDF is ready before rendering iframe
  const isPdfReady = ['generated', 'signed', 'finalized'].includes(form.status);

  const signWithCapture = async (sigDataUrl: string, typedNameVal: string) => {
    setSubmitting(true);
    setError('');
    try {
      // First: capture/store the signature image
      const captureRes = await fetch(`/api/pbv-full-app/signer/${memberToken}/signature/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_image_data_url: sigDataUrl,
          ceremony_id: ceremonyId,
        }),
      });
      const captureJson = await captureRes.json().catch(() => ({}));
      if (!captureRes.ok) throw new Error((captureJson as any).message || 'Failed to store signature.');

      const storagePath = captureJson.data?.signature_image_path;
      if (!storagePath) throw new Error('No signature path returned.');

      setSignatureImagePath(storagePath);

      // Second: sign the form with the storage path
      const res = await fetch(`/api/pbv-full-app/signer/${memberToken}/sign-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_document_id: form.id,
          typed_name: typedNameVal,
          signature_image_path: storagePath,
          ceremony_id: ceremonyId,
          consent_text_version: CONSENT_TEXT_VERSION,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).message || 'Failed to sign.');
      setIndex((i) => i + 1);
      setConfirmed(false);
      setTypedName('');
    } catch (err: any) {
      setError(err.message || 'Signing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const signWithExisting = async () => {
    if (!signatureImagePath) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/pbv-full-app/signer/${memberToken}/sign-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_document_id: form.id,
          typed_name: typedName,
          signature_image_path: signatureImagePath,
          ceremony_id: ceremonyId,
          consent_text_version: CONSENT_TEXT_VERSION,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).message || 'Failed to sign.');
      setIndex((i) => i + 1);
      setConfirmed(false);
      setTypedName('');
    } catch (err: any) {
      setError(err.message || 'Signing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const signLabel = language === 'es' ? 'Firmar este formulario' : language === 'pt' ? 'Assinar este formul\u00e1rio' : 'Sign this form';
  const signingLabel = language === 'es' ? 'Firmando\u2026' : language === 'pt' ? 'Assinando\u2026' : 'Signing\u2026';
  const confirmLabel = language === 'es'
    ? 'He revisado este documento y autorizo que se aplique mi firma.'
    : language === 'pt'
    ? 'Revisei este documento e autorizo a aplica\u00e7\u00e3o da minha assinatura.'
    : 'I have reviewed this document and authorize my signature to be applied.';
  const namePlaceholder = language === 'es' ? 'Nombre legal completo' : language === 'pt' ? 'Nome legal completo' : 'Full legal name';

  const preparingText = language === 'es' ? 'Preparando documento...' : language === 'pt' ? 'Preparando documento...' : 'Preparing document...';

  if (!signatureImagePath) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
          <p className="font-semibold text-[var(--body)]">{form.display_name}</p>
          {/* PDF iframe — guarded by form status to prevent raw JSON display */}
          {isPdfReady ? (
            <div className="border border-[var(--border)]" style={{ height: '40dvh' }}>
              <iframe src={pdfUrl} className="w-full h-full" title={form.display_name} />
            </div>
          ) : (
            <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center" style={{ height: '40dvh' }}>
              <p className="text-sm text-[var(--muted)]">{preparingText}</p>
            </div>
          )}
          <ConsentText language={language} />
          <SignaturePadGate
            language={language}
            consentText={consentText}
            expectedName={signerName}
            submitting={submitting}
            error={error}
            onSubmit={signWithCapture}
            onCancel={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <p className="font-semibold text-[var(--body)]">{form.display_name}</p>
        {/* PDF iframe — guarded by form status to prevent raw JSON display */}
        {isPdfReady ? (
          <div className="border border-[var(--border)]" style={{ height: '40dvh' }}>
            <iframe src={pdfUrl} className="w-full h-full" title={form.display_name} />
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center" style={{ height: '40dvh' }}>
            <p className="text-sm text-[var(--muted)]">{preparingText}</p>
          </div>
        )}
        <ConsentText language={language} />
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={namePlaceholder}
          className="block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
        />
        <label className="flex items-start gap-3 min-h-[44px]">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4 mt-0.5" />
          <span className="text-sm text-[var(--body)]">{confirmLabel}</span>
        </label>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        <button
          type="button"
          onClick={signWithExisting}
          disabled={!confirmed || !typedName.trim() || submitting}
          className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {submitting ? signingLabel : signLabel}
        </button>
      </div>
    </div>
  );
}

// ——— Main flow ———

export default function MagicLinkSigningFlow({
  memberToken, memberId: _memberId, memberName, hohName, language, forms, onFormsUpdated,
}: Props) {
  const c = doneCopy[language] ?? doneCopy.en;
  const inApp = inAppBrowserCopy[language] ?? inAppBrowserCopy.en;
  const [step, setStep] = useState<FlowStep>('identity');
  const [confirmedName, setConfirmedName] = useState('');

  // PRP-020 / F3: detect in-app browser on mount. Dismissable banner; if the
  // user dismisses we set sessionStorage so the warning doesn't re-appear
  // every navigation within the same tab.
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!isInAppBrowser(navigator.userAgent)) return;
    try {
      if (window.sessionStorage.getItem('pbv-in-app-warning-dismissed') === '1') return;
    } catch {
      // ignore (private mode)
    }
    setShowInAppWarning(true);
  }, []);

  if (showInAppWarning) {
    return (
      <div className="min-h-dvh bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-amber-400 p-6 space-y-4" role="alertdialog" aria-labelledby="in-app-warning-title">
          <h1 id="in-app-warning-title" className="font-serif text-lg text-[var(--primary)]">{inApp.title}</h1>
          <p className="text-sm text-[var(--body)]">{inApp.body}</p>
          <button
            type="button"
            onClick={() => {
              try { window.sessionStorage.setItem('pbv-in-app-warning-dismissed', '1'); } catch { /* ignore */ }
              setShowInAppWarning(false);
            }}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {inApp.dismiss}
          </button>
        </div>
      </div>
    );
  }

  const handleIdentityConfirmed = (typedName: string) => {
    setConfirmedName(typedName);
    setStep('intro');
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">&#10003;</div>
          <h1 className="font-serif text-2xl text-[var(--primary)]">{c.done_title}</h1>
          <p className="text-sm text-[var(--body)]">{c.done_body}</p>
          <p className="text-xs text-[var(--muted)]">{c.done_instruction}</p>
        </div>
      </div>
    );
  }

  if (step === 'signing') {
    return (
      <MagicLinkFormsSigningInner
        memberToken={memberToken}
        signerName={confirmedName || memberName}
        language={language}
        forms={forms.filter((f) => !f.signatures_complete)}
        onAllSigned={() => { onFormsUpdated(); setStep('done'); }}
      />
    );
  }

  if (step === 'intro') {
    return (
      <SignerIntro
        language={language}
        signerName={memberName}
        hohName={hohName}
        formCount={forms.filter((f) => !f.signatures_complete).length}
        onBegin={() => setStep('signing')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <IdentityCapturePanel
          language={language}
          expectedName={memberName}
          onConfirmed={handleIdentityConfirmed}
          onCancel={() => {}}
        />
      </div>
    </div>
  );
}
