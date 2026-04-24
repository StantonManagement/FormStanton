'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pbvFullAppTranslations, type PbvFullAppStrings } from '@/lib/pbvFullAppTranslations';
import type { PreferredLanguage } from '@/types/compliance';
import {
  FormField,
  FormButton,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import { useFormSection, useFieldValidation } from '@/lib/formHooks';
import SignatureCanvas from 'react-signature-canvas';

// ── Constants ─────────────────────────────────────────────────────────────────

const INCOME_SRCS = [
  'employment', 'ssi', 'ss', 'pension', 'tanf',
  'child_support', 'unemployment', 'self_employment', 'other', 'none',
] as const;

const CITIZENSHIP_OPTIONS: Array<{ value: string; key: keyof PbvFullAppStrings }> = [
  { value: 'citizen',               key: 'cs_citizen' },
  { value: 'eligible_non_citizen',  key: 'cs_eligible_non_citizen' },
  { value: 'ineligible',            key: 'cs_ineligible' },
  { value: 'not_reported',          key: 'cs_not_reported' },
];

const ADD_MEMBER_RELATIONSHIPS: Array<{ value: string; key: keyof PbvFullAppStrings }> = [
  { value: 'spouse',  key: 'rel_spouse' },
  { value: 'partner', key: 'rel_partner' },
  { value: 'child',   key: 'rel_child' },
  { value: 'other',   key: 'rel_other' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FullMember {
  name: string;
  dob: string;
  relationship: string;
  citizenship_status: string;
  disability: boolean;
  student: boolean;
  ssn: string;
  income_sources: string[];
  annual_income: number;
  criminal_history_answer: 'yes' | 'no' | 'skip' | '';
}

interface SignatureProgress {
  member_id: string;
  slot: number;
  name: string;
  required_doc_count: number;
  signed_doc_count: number;
}

interface DocumentSummary {
  total?: number;
  missing?: number;
  submitted?: number;
  approved?: number;
  rejected?: number;
  waived?: number;
}

interface FullAppFormData {
  hohName: string;
  hohDob: string;
  members: FullMember[];
  has_insurance_settlement: boolean;
  has_cd_trust_bond: boolean;
  has_life_insurance: boolean;
  claiming_medical_deduction: boolean;
  has_childcare_expense: boolean;
  dv_status: boolean;
  homeless_at_admission: boolean;
  reasonable_accommodation_requested: boolean;
  cert_checked: boolean;
}

interface AdultSigner {
  id: string;
  slot: number;
  name: string;
  signed_forms: string[];
  documents: Array<{
    id: string;
    doc_type: string;
    label: string;
    person_slot: number;
    status: string;
  }>;
}

type SignerStep = 'handoff' | 'signing' | 'done';

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function emptyMember(rel = ''): FullMember {
  return {
    name: '',
    dob: '',
    relationship: rel,
    citizenship_status: 'not_reported',
    disability: false,
    student: false,
    ssn: '',
    income_sources: [],
    annual_income: 0,
    criminal_history_answer: '',
  };
}

function emptyForm(): FullAppFormData {
  return {
    hohName: '',
    hohDob: '',
    members: [emptyMember('head')],
    has_insurance_settlement: false,
    has_cd_trust_bond: false,
    has_life_insurance: false,
    claiming_medical_deduction: false,
    has_childcare_expense: false,
    dv_status: false,
    homeless_at_admission: false,
    reasonable_accommodation_requested: false,
    cert_checked: false,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageState =
  | 'loading'
  | 'landing'
  | 'form'
  | 'already_submitted'
  | 'signatures'
  | 'docs_ready'
  | 'confirmed'
  | 'error';

export default function PbvFullAppPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [form, setForm] = useState<FullAppFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Phase 4 — Signature flow
  const [formSubmissionToken, setFormSubmissionToken] = useState('');
  const [signers, setSigners] = useState<AdultSigner[]>([]);
  const [sigLoading, setSigLoading] = useState(false);
  const [signerIndex, setSignerIndex] = useState(0);
  const [signerStep, setSignerStep] = useState<SignerStep>('handoff');
  const [sigConfirmedName, setSigConfirmedName] = useState('');
  const [sigNameError, setSigNameError] = useState('');
  const [sigError, setSigError] = useState('');
  const [sigSaving, setSigSaving] = useState(false);
  const [signaturesComplete, setSignaturesComplete] = useState(false);
  const [signatureProgress, setSignatureProgress] = useState<SignatureProgress[]>([]);
  const [documentSummary, setDocumentSummary] = useState<DocumentSummary | null>(null);
  const [nextStep, setNextStep] = useState<'intake' | 'signatures' | 'documents' | 'complete'>('intake');
  const sigCanvasRefs = useRef<Map<string, SignatureCanvas | null>>(new Map());

  const t = pbvFullAppTranslations[language];
  const today = new Date().toISOString().split('T')[0];

  const {
    currentSection,
    nextSection,
    previousSection,
    goToSection,
    completedSections,
  } = useFormSection(7);

  const { errors, setFieldError, clearAllErrors } =
    useFieldValidation<Record<string, string>>();

  // ── Load ──────────────────────────────────────────────────────────────────────

  const loadSigners = useCallback(async () => {
    setSigLoading(true);
    setSigError('');
    try {
      const res = await fetch(`/api/t/${token}/pbv-full-app/signatures`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load signature forms');
      const adults: AdultSigner[] = json.data.adults;
      const pending = adults.filter((a) =>
        a.documents.some((doc) => doc.status === 'missing' || doc.status === 'rejected')
      );
      setSigners(pending);
      setSignerIndex(0);
      setSignerStep('handoff');
      if (pending.length === 0) {
        setPageState('docs_ready');
      }
    } catch (err: any) {
      setSigError(err.message || 'Failed to load signature forms');
    } finally {
      setSigLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/t/${token}/pbv-full-app`)
      .then(async (res) => {
        if (!res.ok) throw new Error('This link is invalid or has expired.');
        return res.json();
      })
      .then(({ data }) => {
        setBuilding(data.building_address);
        setUnitNumber(data.unit_number);
        setFormSubmissionToken(data.form_submission_token ?? '');
        setSignaturesComplete(Boolean(data.signatures_complete));
        setSignatureProgress(Array.isArray(data.signature_progress) ? data.signature_progress : []);
        setDocumentSummary(data.document_summary ?? null);
        setNextStep((data.next_step as 'intake' | 'signatures' | 'documents' | 'complete') ?? 'intake');
        if (data.intake_submitted) {
          setPageState('docs_ready');
          return;
        }
        const hint: string = data.preferred_language ?? 'en';
        if (hint === 'en' || hint === 'es' || hint === 'pt') {
          setLanguage(hint as PreferredLanguage);
        }
        setPageState('landing');
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setPageState('error');
      });
  }, [token, loadSigners]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  const setField = <K extends keyof FullAppFormData>(key: K, val: FullAppFormData[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const updateHoH = (patch: { hohName?: string; hohDob?: string }) =>
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const members = [...next.members];
      members[0] = { ...members[0], name: next.hohName, dob: next.hohDob };
      return { ...next, members };
    });

  const updateMember = (i: number, patch: Partial<FullMember>) =>
    setForm((prev) => {
      const members = [...prev.members];
      members[i] = { ...members[i], ...patch };
      return { ...prev, members };
    });

  const addMember = () => setField('members', [...form.members, emptyMember()]);
  const removeMember = (i: number) =>
    setField('members', form.members.filter((_, idx) => idx !== i));

  const toggleSource = (mi: number, src: string) => {
    const curr = form.members[mi].income_sources;
    const next = [...form.members];
    if (src === 'none') {
      next[mi] = { ...next[mi], income_sources: curr.includes('none') ? [] : ['none'] };
    } else {
      const without = curr.filter((s) => s !== 'none');
      next[mi] = {
        ...next[mi],
        income_sources: without.includes(src)
          ? without.filter((s) => s !== src)
          : [...without, src],
      };
    }
    setField('members', next);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalIncome = form.members.reduce((s, m) => s + (Number(m.annual_income) || 0), 0);

  // ── Section validation ────────────────────────────────────────────────────

  const validateSection = (n: number): boolean => {
    clearAllErrors();

    if (n === 1) {
      let ok = true;
      if (!form.hohName.trim()) { setFieldError('hohName', t.err_hoh_name); ok = false; }
      if (!form.hohDob) {
        setFieldError('hohDob', t.err_hoh_dob); ok = false;
      } else {
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 18);
        if (new Date(form.hohDob) > minAge) { setFieldError('hohDob', t.err_hoh_age); ok = false; }
      }
      form.members.slice(1).forEach((m, i) => {
        const num = i + 2;
        if (!m.name.trim())    { setFieldError(`m${i + 1}name`, t.err_member_name(num)); ok = false; }
        if (!m.dob)            { setFieldError(`m${i + 1}dob`,  t.err_member_dob(num));  ok = false; }
        if (!m.relationship)   { setFieldError(`m${i + 1}rel`,  t.err_member_relationship(num)); ok = false; }
      });
      return ok;
    }

    if (n === 2) {
      let ok = true;
      form.members.forEach((m, i) => {
        if (m.income_sources.length === 0) {
          setFieldError(`m${i}src`, t.err_member_income_sources(i + 1));
          ok = false;
        }
      });
      return ok;
    }

    if (n === 5) {
      let ok = true;
      form.members.forEach((m, i) => {
        const age = computeAge(m.dob);
        if (age !== null && age >= 18 && m.criminal_history_answer === '') {
          setFieldError(`criminal_${i}`, t.err_background_required(m.name || `Member ${i + 1}`));
          ok = false;
        }
      });
      return ok;
    }

    if (n === 7) {
      if (!form.cert_checked) { setFieldError('cert', t.err_cert); return false; }
    }

    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateSection(7)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/t/${token}/pbv-full-app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoh_name: form.hohName.trim(),
          hoh_dob: form.hohDob,
          household_members: form.members.map((m, i) => ({
            slot: i + 1,
            name: m.name.trim(),
            dob: m.dob,
            relationship: i === 0 ? 'head' : m.relationship,
            ssn: m.ssn.trim() || undefined,
            citizenship_status: m.citizenship_status,
            disability: m.disability,
            student: m.student,
            income_sources: m.income_sources,
            annual_income: m.annual_income,
            criminal_history:
              m.criminal_history_answer === 'yes' ? true
              : m.criminal_history_answer === 'no' ? false
              : null,
          })),
          has_insurance_settlement: form.has_insurance_settlement,
          has_cd_trust_bond: form.has_cd_trust_bond,
          has_life_insurance: form.has_life_insurance,
          claiming_medical_deduction: form.claiming_medical_deduction,
          has_childcare_expense: form.has_childcare_expense,
          dv_status: form.dv_status,
          homeless_at_admission: form.homeless_at_admission,
          reasonable_accommodation_requested: form.reasonable_accommodation_requested,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Submission failed. Please try again.');
      }
      setPageState('signatures');
      loadSigners();
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Signature helpers ───────────────────────────────────────────────────────────────

  const handleConfirmName = () => {
    const currentSigner = signers[signerIndex];
    if (!currentSigner) return;
    const entered = sigConfirmedName.trim().toLowerCase();
    const expected = currentSigner.name.trim().toLowerCase();
    if (entered !== expected) {
      setSigNameError(t.sig_confirm_mismatch);
      return;
    }
    setSigNameError('');
    sigCanvasRefs.current.clear();
    setSignerStep('signing');
  };

  const handleSaveSignatures = async () => {
    const currentSigner = signers[signerIndex];
    if (!currentSigner) return;
    const pendingDocs = currentSigner.documents.filter(
      (d) => d.status !== 'approved' && d.status !== 'waived'
    );
    const signatures: Array<{ document_id: string; data_url: string }> = [];
    let unsigned = 0;
    for (const doc of pendingDocs) {
      const canvas = sigCanvasRefs.current.get(doc.id);
      if (!canvas || canvas.isEmpty()) {
        unsigned++;
      } else {
        signatures.push({ document_id: doc.id, data_url: canvas.toDataURL('image/png') });
      }
    }
    if (unsigned > 0) { setSigError(t.sig_unsigned_error); return; }
    setSigSaving(true);
    setSigError('');
    try {
      const res = await fetch(`/api/t/${token}/pbv-full-app/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: currentSigner.id, signatures }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to save signatures');
      setSignerStep('done');
    } catch (err: any) {
      setSigError(err.message || 'Failed to save signatures');
    } finally {
      setSigSaving(false);
    }
  };

  const handleAdvanceSigner = () => {
    sigCanvasRefs.current.clear();
    setSigConfirmedName('');
    setSigNameError('');
    setSigError('');
    if (signerIndex + 1 >= signers.length) {
      setPageState('docs_ready');
    } else {
      setSignerIndex((i) => i + 1);
      setSignerStep('handoff');
    }
  };

  // ── Non-form render states ────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">{pbvFullAppTranslations['en'].loading}</p>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-md w-full border border-[var(--border)] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[var(--error)]">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'already_submitted') {
    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full border border-[var(--border)] bg-white p-8 text-center space-y-3">
            <p className="text-base font-semibold text-[var(--ink)]">
              {pbvFullAppTranslations[language].confirm_title}
            </p>
            <p className="text-sm text-[var(--ink)] leading-relaxed">
              {pbvFullAppTranslations[language].already_submitted}
            </p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (pageState === 'landing') {
    return (
      <LanguageLanding
        title={pbvFullAppTranslations[language].form_title}
        description={pbvFullAppTranslations[language].form_subtitle}
        onSelect={(lang) => { setLanguage(lang as PreferredLanguage); setPageState('form'); }}
      />
    );
  }

  // ── Phase 5: Docs ready ─────────────────────────────────────────────────────────────

  if (pageState === 'docs_ready') {
    const summary = documentSummary ?? {};
    const missingCount = (summary.missing ?? 0) + (summary.rejected ?? 0);
    const uploadedCount = (summary.submitted ?? 0) + (summary.approved ?? 0) + (summary.waived ?? 0);
    const totalDocs = summary.total ?? 0;

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white border border-[var(--border)] shadow-sm p-5">
              <h2 className="text-lg font-bold font-serif text-[var(--primary)] mb-1">Application Progress</h2>
              <p className="text-xs text-[var(--muted)]">
                {signatureProgress.reduce((acc, s) => acc + s.signed_doc_count, 0)} of{' '}
                {signatureProgress.reduce((acc, s) => acc + s.required_doc_count, 0)} signatures · {uploadedCount} of {totalDocs} documents uploaded
              </p>
            </div>

            <div className="bg-white border border-[var(--border)] shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--ink)]">Signatures</p>
                <span className="text-xs text-[var(--muted)]">{signaturesComplete ? 'Complete' : 'Action needed'}</span>
              </div>
              {signatureProgress.length > 0 && (
                <div className="space-y-1">
                  {signatureProgress.map((signer) => (
                    <p key={signer.member_id} className="text-xs text-[var(--muted)]">
                      {signer.name}: {signer.signed_doc_count}/{signer.required_doc_count}
                    </p>
                  ))}
                </div>
              )}
              {!signaturesComplete && (
                <button
                  type="button"
                  onClick={() => {
                    setPageState('signatures');
                    loadSigners();
                  }}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  Resume signatures
                </button>
              )}
            </div>

            <div className="bg-white border border-[var(--border)] shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--ink)]">Documents</p>
                <span className="text-xs text-[var(--muted)]">{missingCount > 0 ? `${missingCount} remaining` : 'Up to date'}</span>
              </div>
              {formSubmissionToken ? (
                <a
                  href={`/t/${formSubmissionToken}`}
                  className="block w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold text-center transition-opacity hover:opacity-90"
                >
                  {nextStep === 'documents' ? 'Resume document uploads' : t.docs_portal_btn}
                </a>
              ) : (
                <p className="text-xs text-[var(--muted)]">{t.confirm_contact}</p>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Phase 4: Multi-signer signature flow ──────────────────────────────────────────

  if (pageState === 'signatures') {
    if (sigLoading) {
      return (
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
          <p className="text-[var(--muted)] text-sm">{t.sig_loading}</p>
        </div>
      );
    }
    if (sigError && signers.length === 0) {
      return (
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
          <div className="max-w-md w-full border border-[var(--border)] bg-white p-8 text-center">
            <p className="text-sm text-[var(--error)]">{sigError}</p>
          </div>
        </div>
      );
    }
    const currentSigner = signers[signerIndex];
    if (!currentSigner) {
      return (
        <>
          <Header language={language} onLanguageChange={setLanguage} />
          <main className="min-h-screen bg-[var(--paper)] py-12 px-4">
            <div className="max-w-md mx-auto text-center">
              <div className="bg-white border border-[var(--border)] shadow-sm p-8 space-y-4">
                <h2 className="text-xl font-bold font-serif text-[var(--primary)]">{t.sig_all_signed_title}</h2>
                <p className="text-sm text-[var(--ink)] leading-relaxed">{t.sig_all_signed_body}</p>
                <button type="button" onClick={() => setPageState('docs_ready')}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90">
                  {t.sig_last_signer_done_btn}
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
    if (signerStep === 'handoff') {
      return (
        <>
          <Header language={language} onLanguageChange={setLanguage} />
          <main className="min-h-screen bg-[var(--paper)] py-8 px-4">
            <div className="max-w-md mx-auto space-y-4">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide text-center">
                {t.sig_signer_progress(signerIndex + 1, signers.length)}
              </p>
              <div className="bg-white border border-[var(--border)] shadow-sm p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold font-serif text-[var(--primary)] mb-2">
                    {t.sig_handoff_title(currentSigner.name)}
                  </h2>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.sig_handoff_body}</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--ink)]">{t.sig_confirm_label}</label>
                  <input
                    type="text"
                    value={sigConfirmedName}
                    onChange={(e) => { setSigConfirmedName(e.target.value); setSigNameError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmName(); }}
                    placeholder={currentSigner.name}
                    autoComplete="off"
                    className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
                  />
                  {sigNameError && <p className="text-xs text-[var(--error)]">{sigNameError}</p>}
                </div>
                <button type="button" onClick={handleConfirmName} disabled={!sigConfirmedName.trim()}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50">
                  {t.sig_confirm_btn}
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
    if (signerStep === 'signing') {
      const pendingDocs = currentSigner.documents.filter(
        (d) => d.status !== 'approved' && d.status !== 'waived'
      );
      return (
        <>
          <Header language={language} onLanguageChange={setLanguage} />
          <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                {t.sig_signer_progress(signerIndex + 1, signers.length)}
              </p>
              <div className="bg-white border border-[var(--border)] shadow-sm px-5 py-4">
                <h2 className="text-lg font-bold font-serif text-[var(--primary)]">{t.sig_forms_header(currentSigner.name)}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">{t.sig_sign_instruction}</p>
              </div>
              {sigError && (
                <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sigError}</div>
              )}
              {pendingDocs.map((doc) => (
                <div key={doc.id} className="bg-white border border-[var(--border)] shadow-sm">
                  <div className="px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
                    <p className="text-sm font-semibold text-[var(--ink)]">{doc.label}</p>
                  </div>
                  <div className="p-4">
                    <div className="border border-[var(--border)] bg-white overflow-hidden">
                      <SignatureCanvas
                        ref={(el) => { sigCanvasRefs.current.set(doc.id, el); }}
                        canvasProps={{ className: 'w-full', style: { width: '100%', height: '140px', touchAction: 'none' } }}
                        backgroundColor="white"
                      />
                    </div>
                    <button type="button" onClick={() => { sigCanvasRefs.current.get(doc.id)?.clear(); }}
                      className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline">
                      {t.sig_clear_btn}
                    </button>
                  </div>
                </div>
              ))}
              <div className="pb-8">
                <button type="button" onClick={handleSaveSignatures} disabled={sigSaving}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50">
                  {sigSaving ? t.sig_saving : t.sig_save_btn}
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
    if (signerStep === 'done') {
      const isLast = signerIndex + 1 >= signers.length;
      const nextSigner = !isLast ? signers[signerIndex + 1] : null;
      return (
        <>
          <Header language={language} onLanguageChange={setLanguage} />
          <main className="min-h-screen bg-[var(--paper)] py-12 px-4">
            <div className="max-w-md mx-auto">
              <div className="bg-white border border-[var(--border)] shadow-sm p-8 space-y-6 text-center">
                <div className="w-12 h-12 mx-auto bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold font-serif text-[var(--primary)] mb-2">{t.sig_signer_done_title(currentSigner.name)}</h2>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">{isLast ? t.sig_all_signed_body : t.sig_signer_done_body}</p>
                </div>
                <button type="button" onClick={handleAdvanceSigner}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90">
                  {isLast ? t.sig_last_signer_done_btn : t.sig_next_signer_btn(nextSigner!.name)}
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
  }

  if (pageState === 'confirmed') {
    return (
      <SuccessScreen
        title={t.confirm_title}
        message={`${t.confirm_body} ${t.confirm_contact}`}
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  // ── Tab navigation helpers ────────────────────────────────────────────────

  const tabs = [
    { id: 1, label: t.tab_household },
    { id: 2, label: t.tab_income },
    { id: 3, label: t.tab_assets },
    { id: 4, label: t.tab_expenses },
    { id: 5, label: t.tab_background },
    { id: 6, label: t.tab_circumstances },
    { id: 7, label: t.tab_certify },
  ];

  const goNext = (n: number) => { if (validateSection(n)) nextSection(); };
  const goPrev = () => { clearAllErrors(); previousSection(); };

  // ── 7-section form ────────────────────────────────────────────────────────

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <TabNavigation
          tabs={tabs}
          activeTab={currentSection}
          onTabClick={goToSection}
          completedTabs={completedSections}
        />

        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="p-6 sm:p-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >

              {/* ── Section 1: Household ──────────────────────────────── */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader title={t.section1_title} sectionNumber={1} totalSections={7} />

                  <div className="bg-[var(--bg-section)] border border-[var(--divider)] px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-6">
                      <div>
                        <p className="text-xs text-[var(--muted)]">{t.building_label}</p>
                        <p className="text-sm font-medium text-[var(--ink)] mt-0.5">{building}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">{t.unit_label}</p>
                        <p className="text-sm font-medium text-[var(--ink)] mt-0.5">{unitNumber}</p>
                      </div>
                    </div>
                  </div>

                  <FormField label={t.hoh_name_label} required error={errors['hohName']}>
                    <input
                      type="text"
                      value={form.hohName}
                      onChange={(e) => updateHoH({ hohName: e.target.value })}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                      autoComplete="name"
                    />
                  </FormField>

                  <FormField label={t.hoh_dob_label} required error={errors['hohDob']}>
                    <input
                      type="date"
                      value={form.hohDob}
                      max={today}
                      onChange={(e) => updateHoH({ hohDob: e.target.value })}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                    />
                  </FormField>

                  <FullMemberCard
                    index={0}
                    member={form.members[0]}
                    isHoH
                    t={t}
                    errors={errors}
                    onUpdate={(patch) => updateMember(0, patch)}
                    onRemove={() => {}}
                    today={today}
                  />

                  {form.members.slice(1).map((member, i) => (
                    <FullMemberCard
                      key={i + 1}
                      index={i + 1}
                      member={member}
                      isHoH={false}
                      t={t}
                      errors={errors}
                      onUpdate={(patch) => updateMember(i + 1, patch)}
                      onRemove={() => removeMember(i + 1)}
                      today={today}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={addMember}
                    className="w-full py-3 border border-dashed border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-[var(--bg-section)] transition-colors duration-200 rounded-none"
                  >
                    + {t.add_member_btn}
                  </button>

                  <FormButton type="button" onClick={() => goNext(1)} fullWidth>
                    {t.continue_btn}
                  </FormButton>
                </FormSection>
              )}

              {/* ── Section 2: Income ─────────────────────────────────── */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader title={t.section2_title} sectionNumber={2} totalSections={7} />

                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.income_intro}</p>

                  {form.members.map((member, i) => (
                    <IncomeCard
                      key={i}
                      index={i}
                      member={member}
                      t={t}
                      errors={errors}
                      onUpdate={(patch) => updateMember(i, patch)}
                      onToggleSource={(src) => toggleSource(i, src)}
                    />
                  ))}

                  <div className="bg-[var(--bg-section)] border border-[var(--divider)] px-4 py-3">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {t.income_total_display(fmtCurrency(totalIncome))}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton type="button" onClick={() => goNext(2)} fullWidth>
                      {t.continue_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ── Section 3: Assets ─────────────────────────────────── */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader title={t.section3_title} sectionNumber={3} totalSections={7} />

                  <div className="border border-[var(--divider)] bg-[var(--bg-section)] px-4 py-3 text-sm text-[var(--ink)] leading-relaxed">
                    {t.assets_intro}
                  </div>

                  <YesNoField
                    label={t.has_insurance_settlement_label}
                    value={form.has_insurance_settlement}
                    onChange={(v) => setField('has_insurance_settlement', v)}
                    t={t}
                  />
                  <YesNoField
                    label={t.has_cd_trust_bond_label}
                    value={form.has_cd_trust_bond}
                    onChange={(v) => setField('has_cd_trust_bond', v)}
                    t={t}
                  />
                  <YesNoField
                    label={t.has_life_insurance_label}
                    value={form.has_life_insurance}
                    onChange={(v) => setField('has_life_insurance', v)}
                    t={t}
                  />

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton type="button" onClick={() => goNext(3)} fullWidth>
                      {t.continue_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ── Section 4: Expenses ───────────────────────────────── */}
              {currentSection === 4 && (
                <FormSection>
                  <SectionHeader title={t.section4_title} sectionNumber={4} totalSections={7} />

                  <YesNoField
                    label={t.medical_deduction_label}
                    helperText={t.medical_deduction_helper}
                    value={form.claiming_medical_deduction}
                    onChange={(v) => setField('claiming_medical_deduction', v)}
                    t={t}
                  />
                  <YesNoField
                    label={t.childcare_label}
                    value={form.has_childcare_expense}
                    onChange={(v) => setField('has_childcare_expense', v)}
                    t={t}
                  />

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton type="button" onClick={() => goNext(4)} fullWidth>
                      {t.continue_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ── Section 5: Background ─────────────────────────────── */}
              {currentSection === 5 && (
                <FormSection>
                  <SectionHeader title={t.section5_title} sectionNumber={5} totalSections={7} />

                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.background_intro}</p>
                  <p className="text-xs text-[var(--muted)]">{t.background_minors_note}</p>

                  {form.members.map((member, i) => {
                    const age = computeAge(member.dob);
                    if (age === null || age < 18) return null;
                    const displayName = member.name || `Member ${i + 1}`;
                    return (
                      <div key={i} className="border border-[var(--border)] bg-white">
                        <div className="px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
                          <span className="text-sm font-medium text-[var(--ink)]">{displayName}</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <p className="text-sm text-[var(--ink)] leading-relaxed">
                            {t.criminal_history_question(displayName)}
                          </p>
                          <div className="space-y-2">
                            {(['yes', 'no', 'skip'] as const).map((opt) => (
                              <label key={opt} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`criminal_${i}`}
                                  checked={member.criminal_history_answer === opt}
                                  onChange={() =>
                                    updateMember(i, { criminal_history_answer: opt })
                                  }
                                  className="w-5 h-5"
                                />
                                <span className="text-sm text-[var(--ink)]">
                                  {opt === 'yes'
                                    ? t.criminal_yes
                                    : opt === 'no'
                                    ? t.criminal_no
                                    : t.criminal_not_answered}
                                </span>
                              </label>
                            ))}
                          </div>
                          {errors[`criminal_${i}`] && (
                            <p className="text-xs text-[var(--error)]">
                              {errors[`criminal_${i}`]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton type="button" onClick={() => goNext(5)} fullWidth>
                      {t.continue_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ── Section 6: Circumstances ──────────────────────────── */}
              {currentSection === 6 && (
                <FormSection>
                  <SectionHeader title={t.section6_title} sectionNumber={6} totalSections={7} />

                  <div className="space-y-6">
                    <div>
                      <YesNoField
                        label={t.dv_status_label}
                        value={form.dv_status}
                        onChange={(v) => setField('dv_status', v)}
                        t={t}
                      />
                      {form.dv_status && (
                        <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                          {t.dv_status_note}
                        </p>
                      )}
                    </div>

                    <YesNoField
                      label={t.homeless_label}
                      value={form.homeless_at_admission}
                      onChange={(v) => setField('homeless_at_admission', v)}
                      t={t}
                    />

                    <div>
                      <YesNoField
                        label={t.ra_label}
                        value={form.reasonable_accommodation_requested}
                        onChange={(v) => setField('reasonable_accommodation_requested', v)}
                        t={t}
                      />
                      {form.reasonable_accommodation_requested && (
                        <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                          {t.ra_note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton type="button" onClick={() => goNext(6)} fullWidth>
                      {t.continue_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ── Section 7: Certify ────────────────────────────────── */}
              {currentSection === 7 && (
                <FormSection>
                  <SectionHeader title={t.section7_title} sectionNumber={7} totalSections={7} />

                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.review_intro}</p>

                  <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4 text-sm">
                    <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-1.5">
                      <span className="text-[var(--muted)]">{t.review_building}</span>
                      <span className="font-medium text-[var(--ink)]">{building}</span>
                      <span className="text-[var(--muted)]">{t.review_unit}</span>
                      <span className="font-medium text-[var(--ink)]">{unitNumber}</span>
                      <span className="text-[var(--muted)]">{t.review_household_size}</span>
                      <span className="font-medium text-[var(--ink)]">{form.members.length}</span>
                      <span className="text-[var(--muted)]">{t.review_total_income}</span>
                      <span className="font-medium text-[var(--ink)]">
                        {fmtCurrency(totalIncome)}/yr
                      </span>
                      {form.dv_status && (
                        <>
                          <span className="text-[var(--muted)]">VAWA / DV</span>
                          <span className="font-medium text-[var(--ink)]">{t.yes}</span>
                        </>
                      )}
                      {form.claiming_medical_deduction && (
                        <>
                          <span className="text-[var(--muted)]">Medical Deduction</span>
                          <span className="font-medium text-[var(--ink)]">{t.yes}</span>
                        </>
                      )}
                      {form.reasonable_accommodation_requested && (
                        <>
                          <span className="text-[var(--muted)]">RA Requested</span>
                          <span className="font-medium text-[var(--ink)]">{t.yes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border border-[var(--divider)] bg-[var(--bg-section)] px-4 py-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.cert_checked}
                        onChange={(e) => setField('cert_checked', e.target.checked)}
                        className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-none"
                      />
                      <span className="text-sm text-[var(--ink)] leading-relaxed">
                        {t.cert_checkbox_label}
                      </span>
                    </label>
                    {errors['cert'] && (
                      <p className="text-xs text-[var(--error)] mt-2 ml-8">{errors['cert']}</p>
                    )}
                  </div>

                  <p className="text-xs text-[var(--muted)] leading-relaxed">{t.cert_note}</p>

                  {submitError && (
                    <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <FormButton type="button" onClick={goPrev} variant="secondary" fullWidth>
                      {t.back_btn}
                    </FormButton>
                    <FormButton
                      type="submit"
                      variant="success"
                      fullWidth
                      loading={submitting}
                      disabled={!form.cert_checked || submitting}
                    >
                      {submitting ? t.submitting : t.submit_btn}
                    </FormButton>
                  </div>
                </FormSection>
              )}

            </motion.div>
          </AnimatePresence>
        </form>
      </FormLayout>
      <Footer />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FullMemberCardProps {
  index: number;
  member: FullMember;
  isHoH: boolean;
  t: PbvFullAppStrings;
  errors: Partial<Record<string, string>>;
  onUpdate: (patch: Partial<FullMember>) => void;
  onRemove: () => void;
  today: string;
}

function FullMemberCard({
  index,
  member,
  isHoH,
  t,
  errors,
  onUpdate,
  onRemove,
  today,
}: FullMemberCardProps) {
  return (
    <div className="border border-[var(--border)] bg-white mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
        <span className="text-sm font-medium text-[var(--ink)]">
          {isHoH ? t.rel_head : `Household Member ${index + 1}`}
        </span>
        {!isHoH && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-[var(--muted)] hover:text-[var(--error)] underline transition-colors"
          >
            {t.remove_member_btn}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Name / DOB / Relationship — editable for non-HoH only */}
        {!isHoH && (
          <>
            <FormField
              label={t.member_name_label}
              required
              error={errors[`m${index}name`]}
            >
              <input
                type="text"
                value={member.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
              />
            </FormField>

            <FormField
              label={t.member_dob_label}
              required
              error={errors[`m${index}dob`]}
            >
              <input
                type="date"
                value={member.dob}
                max={today}
                onChange={(e) => onUpdate({ dob: e.target.value })}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
              />
            </FormField>

            <FormField
              label={t.member_relationship_label}
              required
              error={errors[`m${index}rel`]}
            >
              <select
                value={member.relationship}
                onChange={(e) => onUpdate({ relationship: e.target.value })}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
              >
                <option value="">—</option>
                {ADD_MEMBER_RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t[r.key] as string}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}

        {/* Citizenship */}
        <FormField label={t.member_citizenship_label}>
          <select
            value={member.citizenship_status}
            onChange={(e) => onUpdate({ citizenship_status: e.target.value })}
            className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
          >
            {CITIZENSHIP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {t[c.key] as string}
              </option>
            ))}
          </select>
        </FormField>

        {/* Disability / Student */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={member.disability}
              onChange={(e) => onUpdate({ disability: e.target.checked })}
              className="w-4 h-4 rounded-none"
            />
            <span className="text-sm text-[var(--ink)]">{t.member_disability_label}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={member.student}
              onChange={(e) => onUpdate({ student: e.target.checked })}
              className="w-4 h-4 rounded-none"
            />
            <span className="text-sm text-[var(--ink)]">{t.member_student_label}</span>
          </label>
        </div>

        {/* SSN */}
        <FormField label={t.member_ssn_label} helperText={t.member_ssn_helper}>
          <input
            type="text"
            value={member.ssn}
            onChange={(e) => onUpdate({ ssn: e.target.value })}
            placeholder="123-45-6789"
            maxLength={11}
            autoComplete="off"
            className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1 font-mono"
          />
        </FormField>
      </div>
    </div>
  );
}

// ── Income card ───────────────────────────────────────────────────────────────

interface IncomeCardProps {
  index: number;
  member: FullMember;
  t: PbvFullAppStrings;
  errors: Partial<Record<string, string>>;
  onUpdate: (patch: Partial<FullMember>) => void;
  onToggleSource: (src: string) => void;
}

function IncomeCard({ index, member, t, errors, onUpdate, onToggleSource }: IncomeCardProps) {
  const displayName = member.name || `Member ${index + 1}`;
  return (
    <div className="border border-[var(--border)] bg-white mb-4">
      <div className="px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
        <span className="text-sm font-medium text-[var(--ink)]">{displayName}</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <span className="text-sm font-medium text-[var(--ink)]">
            {t.member_income_sources_label}
          </span>
          {errors[`m${index}src`] && (
            <p className="text-xs text-[var(--error)] mt-1">{errors[`m${index}src`]}</p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {INCOME_SRCS.map((src) => (
              <label key={src} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={member.income_sources.includes(src)}
                  onChange={() => onToggleSource(src)}
                  className="w-4 h-4 rounded-none"
                />
                <span className="text-sm text-[var(--ink)]">
                  {(t as Record<string, any>)[`src_${src}`]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <FormField label={t.member_income_label} error={errors[`m${index}inc`]}>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
              $
            </span>
            <input
              type="number"
              min="0"
              value={member.annual_income || ''}
              onChange={(e) =>
                onUpdate({ annual_income: Math.max(0, parseInt(e.target.value) || 0) })
              }
              placeholder="0"
              className="w-full pl-7 pr-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
            />
          </div>
        </FormField>
      </div>
    </div>
  );
}

// ── Yes/No field ──────────────────────────────────────────────────────────────

interface YesNoFieldProps {
  label: string;
  helperText?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  t: PbvFullAppStrings;
}

function YesNoField({ label, helperText, value, onChange, t }: YesNoFieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--ink)] leading-snug">{label}</p>
      {helperText && (
        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{helperText}</p>
      )}
      <div className="flex gap-6 mt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value === true}
            onChange={() => onChange(true)}
            className="w-5 h-5"
          />
          <span className="text-sm font-medium text-[var(--ink)]">{t.yes}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value === false}
            onChange={() => onChange(false)}
            className="w-5 h-5"
          />
          <span className="text-sm font-medium text-[var(--ink)]">{t.no}</span>
        </label>
      </div>
    </div>
  );
}
