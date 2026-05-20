'use client';

/**
 * components/pbv/sign/SummaryDocReviewSign.tsx
 *
 * Step 1: renders the plain-language summary doc (iframe — PDF.js ruled out
 * due to bundle size; iframe works reliably cross-browser and on mobile).
 * Step 2: "I have read and understood this document" checkbox.
 * Step 3: Tapping "Sign summary" opens SignaturePadGate.
 * On submit: POST signature/capture then POST sign-summary.
 *
 * Decision: iframe for PDF rendering. PDF.js would add ~500 KB gzipped to
 * the bundle; for a one-time sign flow the iframe is simpler, reliable,
 * and requires no additional dependencies. Documented in build report.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePadGate from './SignaturePadGate';
import { tenantFetch } from '@/lib/tenantFetch';
import { getSummaryConsent, CONSENT_TEXT_VERSION } from '@/lib/pbv/consent-text';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  token: string;
  language: PreferredLanguage;
  hohName: string;
  hohMemberId: string;
  summaryPdfUrl?: string;
  summaryReady?: boolean; // PR-2: Guard iframe mounting
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    title: 'Review Your Application Summary',
    intro: 'Please read the summary below carefully. When you are ready, check the box and sign.',
    no_pdf: 'Your summary document is being prepared. Please return to the dashboard and try again in a moment.',
    checkbox_label: 'I have read and understood this document.',
    sign_btn: 'Sign summary',
    back: '\u2190 Back to dashboard',
    success_title: 'Summary signed!',
    success_body: 'You may now proceed to sign your required forms.',
    success_btn: 'Continue to forms',
  },
  es: {
    title: 'Revise el Resumen de Su Solicitud',
    intro: 'Por favor lea el resumen a continuaci\u00f3n con cuidado. Cuando est\u00e9 listo, marque la casilla y firme.',
    no_pdf: 'Su documento de resumen est\u00e1 siendo preparado. Vuelva al panel y int\u00e9ntelo de nuevo en un momento.',
    checkbox_label: 'He le\u00eddo y entendido este documento.',
    sign_btn: 'Firmar resumen',
    back: '\u2190 Volver al panel',
    success_title: '\u00a1Resumen firmado!',
    success_body: 'Ahora puede proceder a firmar los formularios requeridos.',
    success_btn: 'Continuar a formularios',
  },
  pt: {
    // PT: tentative — review
    title: 'Revise o Resumo da Sua Solicita\u00e7\u00e3o',
    intro: 'Por favor, leia o resumo abaixo com aten\u00e7\u00e3o. Quando estiver pronto, marque a caixa e assine.',
    no_pdf: 'Seu documento de resumo est\u00e1 sendo preparado. Volte ao painel e tente novamente em instantes.',
    checkbox_label: 'Li e entendi este documento.',
    sign_btn: 'Assinar resumo',
    back: '\u2190 Voltar ao painel',
    success_title: 'Resumo assinado!',
    success_body: 'Agora voc\u00ea pode prosseguir para assinar os formul\u00e1rios obrigat\u00f3rios.',
    success_btn: 'Continuar para formul\u00e1rios',
  },
};

type Step = 'review' | 'signing' | 'done';

export default function SummaryDocReviewSign({ token, language, hohName, hohMemberId, summaryPdfUrl, summaryReady = true }: Props) {
  const c = copy[language] ?? copy.en;
  const router = useRouter();
  const [step, setStep] = useState<Step>('review');
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const consentText = getSummaryConsent(language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en');

  const handleSign = async (signatureDataUrl: string, typedName: string) => {
    setSubmitting(true);
    setError('');
    try {
      const ceremonyId = crypto.randomUUID();

      // 1. Capture signature image
      const captureRes = await tenantFetch(`/api/t/${token}/pbv-full-app/signature/capture`, {
        method: 'POST',
        body: {
          signature_image_data_url: signatureDataUrl,
          signer_member_id: hohMemberId,
          ceremony_id: ceremonyId,
        },
      });
      const captureJson = await captureRes.json().catch(() => ({}));
      if (!captureRes.ok) throw new Error((captureJson as any).message || 'Failed to capture signature.');
      const { signature_image_path } = (captureJson as any).data;

      // 2. Sign summary
      const signRes = await tenantFetch(`/api/t/${token}/pbv-full-app/sign-summary`, {
        method: 'POST',
        body: {
          typed_name: typedName,
          signature_image_path,
          ceremony_id: ceremonyId,
          consent_text_version: CONSENT_TEXT_VERSION,
          template_version: CONSENT_TEXT_VERSION,
          language,
        },
      });
      const signJson = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error((signJson as any).message || 'Failed to sign summary.');

      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Signing failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">&#10003;</div>
          <h1 className="font-serif text-2xl text-[var(--primary)]">{c.success_title}</h1>
          <p className="text-sm text-[var(--body)]">{c.success_body}</p>
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/sign/forms`)}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {c.success_btn}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'signing') {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-lg mx-auto px-4 py-8">
          <button type="button" onClick={() => setStep('review')}
            className="text-sm text-[var(--muted)] mb-4 block hover:text-[var(--body)]">
            {c.back}
          </button>
          <h1 className="font-serif text-2xl text-[var(--primary)] mb-6">{c.sign_btn}</h1>
          <SignaturePadGate
            language={language}
            consentText={consentText}
            expectedName={hohName}
            submitting={submitting}
            error={error}
            onSubmit={handleSign}
            onCancel={() => setStep('review')}
          />
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

        <h1 className="font-serif text-2xl text-[var(--primary)] mb-2">{c.title}</h1>
        <p className="text-sm text-[var(--muted)] mb-6">{c.intro}</p>

        {/* PDF preview — iframe approach */}
        {/* PR-2: Guard with summaryReady to prevent raw JSON in iframe if PDF not generated */}
        {summaryPdfUrl && summaryReady ? (
          <div className="border border-[var(--border)] mb-6" style={{ height: '60vh' }}>
            <iframe
              src={summaryPdfUrl}
              className="w-full h-full"
              title="Application Summary"
            />
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--paper)] p-6 text-center mb-6">
            <p className="text-sm text-[var(--muted)]">{c.no_pdf}</p>
          </div>
        )}

        {/* Checkbox */}
        <label className="flex items-start gap-3 mb-6 min-h-[44px]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="w-4 h-4 mt-0.5 flex-shrink-0"
          />
          <span className="text-sm text-[var(--body)]">{c.checkbox_label}</span>
        </label>

        <button
          type="button"
          onClick={() => setStep('signing')}
          disabled={!checked}
          className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {c.sign_btn}
        </button>
      </div>
    </div>
  );
}
