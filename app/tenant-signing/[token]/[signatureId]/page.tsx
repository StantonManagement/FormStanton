'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import SignatureCanvas from '@/components/signing/SignatureCanvas';

// Step type for the signing flow
type Step = 'consent' | 'identity' | 'review' | 'signature' | 'confirm' | 'complete';

interface ConsentData {
  consentText: string;
  versionKey: string;
  language: string;
  stateId: string;
}

export default function TenantSigningPage() {
  const params = useParams<{ token: string; signatureId: string }>();
  const { token, signatureId } = params;

  const [step, setStep] = useState<Step>('consent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<ConsentData | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [dob, setDob] = useState('');
  const [identityAttempts, setIdentityAttempts] = useState(3);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [documentName, setDocumentName] = useState('Document');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pagesViewed, setPagesViewed] = useState(0);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureDate, setSignatureDate] = useState(() => 
    new Date().toISOString().split('T')[0]
  );
  const [applying, setApplying] = useState(false);
  const [completeData, setCompleteData] = useState<{
    auditId: string;
    deliveryMethod: string;
    downloadUrl: string;
  } | null>(null);

  // Load initial consent data
  useEffect(() => {
    if (!token || !signatureId) return;

    fetch(`/api/tenant/signing/${token}/${signatureId}/consent`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to load signing session');
        }
        return res.json();
      })
      .then(({ data }) => {
        setConsentData(data);
        setStep(data.step as Step);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token, signatureId]);

  // Handle consent submission
  const handleConsentSubmit = async () => {
    if (!consentAccepted || !consentData) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/signing/${token}/${signatureId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStep('identity');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle identity verification
  const handleIdentitySubmit = async () => {
    if (!dob || !consentData) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/signing/${token}/${signatureId}/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dateOfBirth: dob,
          stateId: consentData.stateId,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 429) {
          setLockedUntil(data.lockedUntil ? new Date(data.lockedUntil) : null);
        }
        setIdentityAttempts(data.attemptsRemaining ?? 0);
        throw new Error(data.message);
      }

      setStep('review');
      // Load PDF for review
      loadDocumentForReview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load document for review
  const loadDocumentForReview = async () => {
    // In a real implementation, this would fetch the PDF URL
    // setPdfUrl(`/api/tenant/signing/${token}/${signatureId}/document`);
    setPdfPageCount(1); // Would be actual page count
  };

  // Handle document review submission
  const handleReviewSubmit = async () => {
    if (!reviewConfirmed || !consentData) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/signing/${token}/${signatureId}/document-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateId: consentData.stateId,
          pagesViewed,
          pdfPageCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setStep('signature');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle signature capture
  const handleSignatureSubmit = async () => {
    if (!typedName.trim() || !signatureDataUrl || !consentData) {
      setError('Please type your name and draw your signature');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenant/signing/${token}/${signatureId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateId: consentData.stateId,
          typedName: typedName.trim(),
          signatureImageDataUrl: signatureDataUrl,
          date: signatureDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setCompleteData(data.data);
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (loading && !consentData) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (error && !consentData) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            {['consent', 'identity', 'review', 'signature'].map((s, i) => (
              <div key={s} className={`flex items-center ${step === s ? 'text-[var(--primary)] font-medium' : ''}`}>
                <span className="w-6 h-6 rounded-full border flex items-center justify-center mr-1">
                  {i + 1}
                </span>
                <span className="hidden sm:inline capitalize">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step: Consent */}
        {step === 'consent' && consentData && (
          <div className="bg-white border border-[var(--border)] p-6 space-y-6">
            <h1 className="text-xl font-bold font-serif text-[var(--primary)]">
              Electronic Signature Disclosure
            </h1>
            
            <div className="prose prose-sm max-w-none text-[var(--ink)] whitespace-pre-wrap">
              {consentData.consentText}
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-[var(--ink)]">
                I agree to sign electronically and understand this has the same legal effect as a handwritten signature.
              </span>
            </label>

            <button
              onClick={handleConsentSubmit}
              disabled={!consentAccepted || loading}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </div>
        )}

        {/* Step: Identity */}
        {step === 'identity' && (
          <div className="bg-white border border-[var(--border)] p-6 space-y-6">
            <h1 className="text-xl font-bold font-serif text-[var(--primary)]">
              Verify Your Identity
            </h1>

            <p className="text-sm text-[var(--ink)]">
              To ensure security, please confirm your date of birth as the head of household.
            </p>

            {lockedUntil && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                Too many failed attempts. Please try again after {lockedUntil.toLocaleString()}.
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--ink)]">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                disabled={!!lockedUntil}
              />
              {identityAttempts < 3 && (
                <p className="text-xs text-[var(--warning)]">
                  {identityAttempts} attempts remaining
                </p>
              )}
            </div>

            <button
              onClick={handleIdentitySubmit}
              disabled={!dob || loading || !!lockedUntil}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="bg-white border border-[var(--border)] p-6 space-y-6">
            <h1 className="text-xl font-bold font-serif text-[var(--primary)]">
              Review Document
            </h1>

            <p className="text-sm text-[var(--ink)]">
              Please review the entire document before signing. You must view all {pdfPageCount} page(s).
            </p>

            {/* PDF viewer placeholder */}
            <div className="border border-[var(--border)] bg-gray-50 h-96 flex items-center justify-center">
              <p className="text-[var(--muted)] text-sm">
                PDF Viewer: {documentName}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Pages viewed: {pagesViewed} / {pdfPageCount}</span>
              {pagesViewed >= pdfPageCount && (
                <span className="text-green-600">All pages viewed ✓</span>
              )}
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(e) => setReviewConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm text-[var(--ink)]">
                I have reviewed this document and agree to its contents.
              </span>
            </label>

            <button
              onClick={handleReviewSubmit}
              disabled={!reviewConfirmed || loading}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Continue to Signature'}
            </button>
          </div>
        )}

        {/* Step: Signature */}
        {step === 'signature' && (
          <div className="bg-white border border-[var(--border)] p-6 space-y-6">
            <h1 className="text-xl font-bold font-serif text-[var(--primary)]">
              Sign Document
            </h1>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--ink)]">
                  Type your full legal name
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="As it appears on your ID"
                  className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--ink)]">
                  Date
                </label>
                <input
                  type="date"
                  value={signatureDate}
                  onChange={(e) => setSignatureDate(e.target.value)}
                  className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <SignatureCanvas
                onChange={setSignatureDataUrl}
                minStrokes={10}
                label="Draw your signature"
                clearLabel="Clear signature"
              />
            </div>

            <div className="bg-[var(--paper)] p-4 text-xs text-[var(--muted)]">
              <p>By clicking "Apply Signature":</p>
              <ul className="list-disc ml-4 mt-1 space-y-1">
                <li>You confirm this is your electronic signature</li>
                <li>You agree it has the same legal effect as a handwritten signature</li>
                <li>An audit trail will be created with your IP address and timestamp</li>
              </ul>
            </div>

            <button
              onClick={handleSignatureSubmit}
              disabled={!typedName.trim() || !signatureDataUrl || applying}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {applying ? 'Applying Signature...' : 'Apply Signature'}
            </button>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && completeData && (
          <div className="bg-white border border-[var(--border)] p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">
              Signature Complete
            </h1>

            <p className="text-[var(--ink)]">
              Your signature has been recorded. A copy has been emailed to you (or is available in your portal).
            </p>

            <div className="space-y-2 text-sm">
              <p className="text-[var(--muted)]">Audit ID: {completeData.auditId}</p>
              <p className="text-[var(--muted)]">Delivery: {completeData.deliveryMethod}</p>
            </div>

            <div className="pt-4 space-y-2">
              <a
                href={completeData.downloadUrl}
                className="block w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold text-center transition-opacity hover:opacity-90"
              >
                Download Signed Document
              </a>
              
              <a
                href={`/t/${token}`}
                className="block w-full py-3 px-4 border border-[var(--border)] text-[var(--ink)] text-sm font-semibold text-center transition-colors hover:bg-[var(--paper)]"
              >
                Return to Portal
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
