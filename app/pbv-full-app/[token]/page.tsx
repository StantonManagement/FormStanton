'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { pbvFullAppTranslations, type PbvFullAppStrings } from '@/lib/pbvFullAppTranslations';
import TenantDocumentUpload from '@/components/pbv/TenantDocumentUpload';
import type { PreferredLanguage } from '@/types/compliance';
import {
  FormField,
  FormButton,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
} from '@/components/form';
import FormPhoneInput from '@/components/form/FormPhoneInput';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import { useFormSection, useFieldValidation } from '@/lib/formHooks';
import { tenantFetch } from '@/lib/tenantFetch';
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

const LANG_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

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
    storage_path?: string | null;
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
  | 'intro'
  | 'form'
  | 'documents'
  | 'already_submitted'
  | 'signatures'
  | 'signature_review'
  | 'docs_ready'
  | 'action_items'
  | 'confirmed'
  | 'error';

// Wrapper component with Suspense for useSearchParams
export default function PbvFullAppPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    }>
      <PbvFullAppPage />
    </Suspense>
  );
}

function PbvFullAppPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [form, setForm] = useState<FullAppFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phone, setPhone] = useState('');
  const [langConfirmed, setLangConfirmed] = useState(false);

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
  const [rejectedDocs, setRejectedDocs] = useState<Array<{
    id: string;
    doc_type: string;
    label: string;
    person_slot: number;
    current_revision: number;
    rejection_code: string;
    rejection_message: string;
    rejected_at: string;
    rejected_by: string | null;
  }>>([]);
  const [rejectedDocsLoading, setRejectedDocsLoading] = useState(false);
  
  // Action Items state
  const [actionItems, setActionItems] = useState<{
    signatures: Array<{
      member_id: string;
      name: string;
      relationship: string;
      pending_signatures: Array<{ signature_id: string; document_name: string }>;
    }>;
    rejected_documents: Array<{
      document_id: string;
      label: string;
      rejection_reason: string;
      doc_type: string;
    }>;
    missing_documents: Array<{
      document_id: string;
      label: string;
      doc_type: string;
      required: boolean;
    }>;
    approved_documents: Array<{
      document_id: string;
      label: string;
      doc_type: string;
      person_name?: string;
    }>;
    signatureProgress?: Array<{
      member_id: string;
      slot: number;
      name: string;
      required_doc_count: number;
      signed_doc_count: number;
    }>;
    counts: {
      pending_signatures: number;
      rejected_documents: number;
      missing_documents: number;
      approved_documents: number;
    };
  } | null>(null);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  
  const [sigConsentChecked, setSigConsentChecked] = useState(false);
  const [consentConfirmedAt, setConsentConfirmedAt] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [resigningDocId, setResigningDocId] = useState<string | null>(null);
  const [finalizeErrors, setFinalizeErrors] = useState<Array<{ signer_name: string; doc_label: string }>>([]);

  // PRD-20: Already submitted screen data
  const [headOfHouseholdName, setHeadOfHouseholdName] = useState<string>('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{
    id: string;
    doc_type: string;
    label: string;
    person_slot: number;
    person_name?: string;
    status: string;
    category?: string;
    display_order: number;
  }>>([]);
  const [signatures, setSignatures] = useState<Array<{
    id: string;
    document_id: string;
    signer_name: string;
    signed_at: string;
    document_label: string;
  }>>([]);

  const [retryCount, setRetryCount] = useState(0);

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
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/signatures`);
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

  const loadRejectedDocs = useCallback(async () => {
    setRejectedDocsLoading(true);
    try {
      const res = await tenantFetch(`/api/t/${token}/documents/rejected?language=${language}`);
      const json = await res.json();
      if (json.success) {
        setRejectedDocs(json.data.documents);
      } else {
        setRejectedDocs([]);
      }
    } catch (err) {
      console.error('Failed to load rejected docs:', err);
      setRejectedDocs([]);
    } finally {
      setRejectedDocsLoading(false);
    }
  }, [token, language]);

  const loadActionItems = useCallback(async () => {
    setActionItemsLoading(true);
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/action-items`);
      const json = await res.json();
      if (json.success) {
        setActionItems(json.data);
      } else {
        setActionItems(null);
      }
    } catch (err) {
      console.error('Failed to load action items:', err);
      setActionItems(null);
    } finally {
      setActionItemsLoading(false);
    }
  }, [token]);

  // Load rejected docs when entering docs_ready state
  useEffect(() => {
    if (pageState === 'docs_ready') {
      loadRejectedDocs();
    }
  }, [pageState, loadRejectedDocs]);

  // Load action items when entering action_items state
  useEffect(() => {
    if (pageState === 'action_items') {
      loadActionItems();
    }
  }, [pageState, loadActionItems]);

  // Load signature thumbnails when entering signature_review state
  useEffect(() => {
    if (pageState !== 'signature_review') return;
    const paths = signers.flatMap((s) =>
      s.documents.filter((d) => d.storage_path).map((d) => d.storage_path as string)
    );
    if (paths.length === 0) return;
    tenantFetch(`/api/t/${token}/pbv-full-app/signature-thumbnails?paths=${encodeURIComponent(paths.join(','))}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setThumbnailUrls(json.data); })
      .catch(() => { /* non-blocking */ });
  }, [pageState, signers, token]);

  const loadTenantData = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return;
    if (!options?.silent) setPageState('loading');
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app`);
      if (!res.ok) throw new Error('This link is invalid or has expired.');
      const { data } = await res.json();

      // Check if already submitted first
      if (data.submitted_at) {
        setPageState('already_submitted');
        setBuilding(data.building_address);
        setUnitNumber(data.unit_number);
        setLanguage((data.preferred_language as PreferredLanguage) ?? 'en');
        setHeadOfHouseholdName(data.head_of_household_name ?? '');
        setSubmittedAt(data.submitted_at);
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
        setSignatures(Array.isArray(data.signatures) ? data.signatures : []);
        return;
      }

      setBuilding(data.building_address);
      setUnitNumber(data.unit_number);
      setFormSubmissionToken(data.form_submission_token ?? '');
      setSignaturesComplete(Boolean(data.signatures_complete));
      setSignatureProgress(Array.isArray(data.signature_progress) ? data.signature_progress : []);
      setDocumentSummary(data.document_summary ?? null);
      setNextStep((data.next_step as 'intake' | 'signatures' | 'documents' | 'complete') ?? 'intake');
      if (data.phone_hint && !options?.silent) {
        const digits = (data.phone_hint as string).replace(/\D/g, '').slice(-10);
        if (digits.length === 10) setPhone(digits);
      }

      // Pre-populate form from preapp data if available
      if (data.preapp_household_data && !data.intake_submitted && !options?.silent) {
        const preapp = data.preapp_household_data;
        const members = preapp.household_members || [];

        setForm({
          hohName: preapp.hoh_name || '',
          hohDob: preapp.hoh_dob || '',
          members: members.length > 0
            ? members.map((m: any, i: number) => ({
                name: m.name || '',
                dob: m.dob || '',
                relationship: i === 0 ? 'head' : (m.relationship || ''),
                citizenship_status: 'not_reported',
                disability: false,
                student: false,
                ssn: '',
                income_sources: Array.isArray(m.income_sources) ? m.income_sources : [],
                annual_income: m.annual_income || 0,
                criminal_history_answer: '',
              }))
            : [emptyMember('head')],
          has_insurance_settlement: false,
          has_cd_trust_bond: false,
          has_life_insurance: false,
          claiming_medical_deduction: false,
          has_childcare_expense: false,
          dv_status: false,
          homeless_at_admission: false,
          reasonable_accommodation_requested: false,
          cert_checked: false,
        });
      }

      // ── PRD-25 dispatcher: route by intake_status / signing_status ────────
      const intakeStatus = data.intake_status as string | undefined;
      const signingStatus = data.signing_status as string | undefined;

      if (!options?.silent && intakeStatus && intakeStatus !== 'not_started') {
        // Intake in-progress or complete: dispatch into new intake SPA
        if (intakeStatus === 'in_progress') {
          const resumeSection = (data.intake_data as any)?._resume_section ?? 'household';
          router.push(`/pbv-full-app/${token}/intake/${resumeSection}`);
          return;
        }
        if (intakeStatus === 'complete') {
          if (!signingStatus || signingStatus === 'not_started' ||
              signingStatus === 'summary_signed' || signingStatus === 'in_progress') {
            // PRD-26 dashboard
            router.push(`/pbv-full-app/${token}/dashboard`);
            return;
          }
          // signing complete → fall through to existing docs/finalize flow
        }
      }
      // ── End PRD-25 dispatcher ───────────────────────────────────────────────

      if (data.intake_submitted) {
        if (!options?.silent) {
          const viewParam = searchParams.get('view');
          if (viewParam === 'action-items') {
            setPageState('action_items');
          } else {
            setPageState('docs_ready');
          }
        }
        return;
      }

      if (!options?.silent) {
        const hint: string = data.preferred_language ?? 'en';
        if (hint === 'en' || hint === 'es' || hint === 'pt') {
          setLanguage(hint as PreferredLanguage);
        }
        // If intake_status = not_started and no existing intake, go to intake landing
        if (intakeStatus === 'not_started' && !data.intake_submitted) {
          router.push(`/pbv-full-app/${token}/intake`);
          return;
        }
        setPageState('landing');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setPageState('error');
    }
  }, [token, searchParams]);

  useEffect(() => {
    loadTenantData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, retryCount]);

  // Silently refresh signature/document counts whenever docs_ready is entered
  useEffect(() => {
    if (pageState === 'docs_ready') {
      loadTenantData({ silent: true });
    }
  }, [pageState, loadTenantData]);

  // ── beforeunload guard — warn when leaving mid-form ───────────────────────

  useEffect(() => {
    const formInProgress = pageState === 'form' || pageState === 'signatures' || pageState === 'signature_review';
    if (!formInProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pageState]);

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
      const phoneDigits = phone.replace(/\D/g, '');
      if (!phone.trim()) {
        setFieldError('phone', t.err_phone_required); ok = false;
      } else if (phoneDigits.length !== 10) {
        setFieldError('phone', t.err_phone_invalid); ok = false;
      }
      if (!langConfirmed) { setFieldError('langConfirm', t.err_lang_not_confirmed); ok = false; }
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
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app`, {
        method: 'POST',
        body: {
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
          phone: phone.replace(/\D/g, ''),
          preferred_language: language,
          has_insurance_settlement: form.has_insurance_settlement,
          has_cd_trust_bond: form.has_cd_trust_bond,
          has_life_insurance: form.has_life_insurance,
          claiming_medical_deduction: form.claiming_medical_deduction,
          has_childcare_expense: form.has_childcare_expense,
          dv_status: form.dv_status,
          homeless_at_admission: form.homeless_at_admission,
          reasonable_accommodation_requested: form.reasonable_accommodation_requested,
        },
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
    sigCanvasRefs.current.forEach(c => c?.clear());
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
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/signatures`, {
        method: 'POST',
        body: {
          member_id: currentSigner.id,
          signatures,
          consent_confirmed: sigConsentChecked,
          consent_confirmed_at: consentConfirmedAt,
          user_agent: navigator.userAgent,
        },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to save signatures');
      setSignerStep('done');
      // PRD-18: per-signer event log (awaited - audit trail required)
      try {
        await tenantFetch(`/api/t/${token}/pbv-full-app/signer-completed`, {
          method: 'POST',
          body: { signer_id: currentSigner.id, slot: currentSigner.slot, name: currentSigner.name },
          idempotent: false,
        });
      } catch (eventError) {
        // Log but don't block - signatures are saved, but alert that audit failed
        console.error('[pbv-signatures] Signer event log failed:', eventError);
      }
    } catch (err: any) {
      setSigError(err.message || 'Failed to save signatures');
    } finally {
      setSigSaving(false);
    }
  };

  const handleFinalize = async () => {
    setSigSaving(true);
    setSigError('');
    setFinalizeErrors([]);
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/finalize`, { method: 'POST' });
      if (res.ok) {
        setPageState('confirmed');
      } else if (res.status === 422) {
        const body = await res.json();
        const sigs: Array<{ signer_name: string; doc_label: string; doc_id: string }> =
          body?.missing?.signatures ?? [];
        setFinalizeErrors(sigs.map((s) => ({ signer_name: s.signer_name, doc_label: s.doc_label })));
        setSigError(t.finalize_validation_error);
      } else {
        setSigError(t.finalize_network_error);
      }
    } catch (err: any) {
      setSigError(t.finalize_network_error);
    } finally {
      setSigSaving(false);
    }
  };

  const handleAdvanceSigner = () => {
    sigCanvasRefs.current.forEach(c => c?.clear());
    sigCanvasRefs.current.clear();
    setSigConfirmedName('');
    setSigNameError('');
    setSigError('');
    setSigConsentChecked(false);
    setConsentConfirmedAt(null);
    if (signerIndex + 1 >= signers.length) {
      setPageState('signature_review');
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
        <div className="max-w-md w-full border border-[var(--border)] bg-white p-8 text-center space-y-4">
          <p className="text-sm font-medium text-[var(--error)]">{errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setRetryCount((c) => c + 1);
            }}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'already_submitted') {
    // PRD-20: Full read-only confirmation screen
    const formatDate = (dateStr: string, lang: PreferredLanguage) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Group documents by category
    const docsByCategory = documents.reduce((acc, doc) => {
      const cat = doc.category || 'custom';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    const categoryOrder = ['income', 'assets', 'medical_childcare', 'immigration', 'signed_forms', 'custom'];
    const categoryKeys = Object.keys(docsByCategory).sort((a, b) => {
      const idxA = categoryOrder.indexOf(a);
      const idxB = categoryOrder.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    // Group signatures by signer
    const sigsBySigner = signatures.reduce((acc, sig) => {
      if (!acc[sig.signer_name]) acc[sig.signer_name] = [];
      acc[sig.signer_name].push(sig);
      return acc;
    }, {} as Record<string, typeof signatures>);

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4 print:py-0 print:px-0 print:bg-white">
          <div className="max-w-3xl mx-auto space-y-6 print:space-y-4">
            {/* Sticky header */}
            <div className="bg-white border border-[var(--border)] p-5 print:border-none print:p-0 print:bg-white">
              <h1 className="text-2xl font-bold font-serif text-[var(--primary)] print:text-black">
                {t.already_submitted_title}
              </h1>
              <p className="text-sm text-[var(--muted)] mt-1 print:text-gray-600" data-testid="already-submitted-timestamp">
                {t.already_submitted_timestamp_label}: {submittedAt ? formatDate(submittedAt, language) : '-'}
              </p>
              <p className="text-sm text-[var(--ink)] mt-2">
                {headOfHouseholdName} • {building} {unitNumber}
              </p>
              <p className="text-sm text-[var(--muted)] mt-3 print:text-gray-600">
                {t.already_submitted_subtitle}
              </p>
            </div>

            {/* Document list — grouped by category */}
            <section className="bg-white border border-[var(--border)] p-5 print:border-none print:p-0 print:bg-white" data-testid="already-submitted-docs">
              <h2 className="text-lg font-semibold mb-3 print:text-black">{t.already_submitted_docs_heading}</h2>
              <div className="space-y-4">
                {categoryKeys.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">—</p>
                ) : (
                  categoryKeys.map((cat) => (
                    <div key={cat} className="print:mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2 print:text-gray-600">
                        {(t as any)[`category_${cat}`] || cat}
                      </h3>
                      <ul className="space-y-1">
                        {docsByCategory[cat].map((doc) => (
                          <li key={doc.id} className="flex items-center justify-between text-sm py-1 border-b border-[var(--border)] last:border-0 print:border-gray-200">
                            <span className="flex items-center gap-2">
                              <span className={
                                doc.status === 'approved' ? 'text-green-600' :
                                doc.status === 'waived' ? 'text-amber-600' :
                                doc.status === 'submitted' ? 'text-blue-600' :
                                doc.status === 'rejected' ? 'text-red-600' :
                                'text-gray-500'
                              }>
                                {doc.status === 'approved' ? '✓' :
                                 doc.status === 'waived' ? '⊘' :
                                 doc.status === 'submitted' ? '◯' :
                                 doc.status === 'rejected' ? '✗' : '•'}
                              </span>
                              <span className="text-[var(--ink)]">{doc.label}</span>
                              {doc.person_slot > 0 && doc.person_name && (
                                <span className="text-xs text-[var(--muted)]">({doc.person_name})</span>
                              )}
                            </span>
                            <span className={
                              doc.status === 'approved' ? 'text-xs text-green-600' :
                              doc.status === 'waived' ? 'text-xs text-amber-600' :
                              doc.status === 'submitted' ? 'text-xs text-blue-600' :
                              doc.status === 'rejected' ? 'text-xs text-red-600' :
                              'text-xs text-gray-500'
                            }>
                              {doc.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Signature list */}
            <section className="bg-white border border-[var(--border)] p-5 print:border-none print:p-0 print:bg-white" data-testid="already-submitted-signatures">
              <h2 className="text-lg font-semibold mb-3 print:text-black">{t.already_submitted_signatures_heading}</h2>
              {Object.keys(sigsBySigner).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">—</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(sigsBySigner).map(([signerName, signerSigs]) => (
                    <div key={signerName} className="print:mb-4">
                      <h3 className="text-sm font-medium text-[var(--ink)] mb-1">{signerName}</h3>
                      <ul className="space-y-1">
                        {signerSigs.map((sig) => (
                          <li key={sig.id} className="text-sm text-[var(--muted)] flex items-center gap-2">
                            <span className="text-green-600">✓</span>
                            <span>{sig.document_label}</span>
                            <span className="text-xs">• {formatDate(sig.signed_at, language)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Contact-office card */}
            <section className="bg-blue-50 border border-blue-200 p-5 print:border-none print:bg-white print:p-0" data-testid="already-submitted-contact">
              <h2 className="text-lg font-semibold mb-2 print:text-black">{t.already_submitted_contact_heading}</h2>
              <p className="text-sm text-[var(--ink)] print:text-gray-700">
                {t.already_submitted_contact_body.replace('(860) 993-3401', '(860) 993-3401')}
              </p>
            </section>

            {/* Print button — hidden when printing */}
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold print:hidden hover:opacity-90 transition-opacity"
            >
              {t.already_submitted_print_btn}
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (pageState === 'landing') {
    return (
      <LanguageLanding
        title={pbvFullAppTranslations[language].form_title}
        description={pbvFullAppTranslations[language].form_subtitle}
        onSelect={(lang) => { setLanguage(lang as PreferredLanguage); setPageState('intro'); }}
      />
    );
  }

  // ── Intro / What to Expect ────────────────────────────────────────────────────────

  if (pageState === 'intro') {
    const t = pbvFullAppTranslations[language];
    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-white border border-[var(--border)] shadow-sm p-6">
              <h2 className="text-xl font-bold font-serif text-[var(--primary)] mb-4">{t.intro_title}</h2>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--primary)] text-white flex items-center justify-center font-semibold text-sm">1</div>
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm">{t.intro_step1_title}</p>
                    <p className="text-xs text-[var(--muted)]">{t.intro_step1_desc}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--primary)] text-white flex items-center justify-center font-semibold text-sm">2</div>
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm">{t.intro_step2_title}</p>
                    <p className="text-xs text-[var(--muted)]">{t.intro_step2_desc}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--primary)] text-white flex items-center justify-center font-semibold text-sm">3</div>
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm">{t.intro_step3_title}</p>
                    <p className="text-xs text-[var(--muted)]">{t.intro_step3_desc}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--border)] space-y-2">
                <p className="text-xs text-[var(--muted)] flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t.intro_time_estimate}
                </p>
                <p className="text-xs text-[var(--muted)] flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t.intro_documents_needed}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPageState('form')}
                className="w-full mt-6 py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90"
              >
                {t.intro_start_btn}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Phase 5b: Action Items ──────────────────────────────────────────────────────────

  if (pageState === 'action_items') {
    const items = actionItems;
    const hasActionItems = items && (
      items.signatures.length > 0 ||
      items.rejected_documents.length > 0 ||
      items.missing_documents.length > 0
    );
    const totalActionItems = (items?.counts.pending_signatures ?? 0) + (items?.counts.rejected_documents ?? 0) + (items?.counts.missing_documents ?? 0);

    // Step completion status
    const step1Complete = true; // Intake always complete in this state
    const step2Complete = items?.counts.pending_signatures === 0;
    const step3Complete = items?.counts.rejected_documents === 0 && items?.counts.missing_documents === 0;
    const currentStep = !step1Complete ? 1 : !step2Complete ? 2 : !step3Complete ? 3 : 4;

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-md mx-auto space-y-4">
            {/* Progress Steps */}
            <div className="bg-white border border-[var(--border)] shadow-sm p-5">
              <h2 className="text-lg font-bold font-serif text-[var(--primary)] mb-4">{t.action_items_title}</h2>

              <div className="space-y-3">
                {/* Step 1: Intake - Always complete here */}
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">{t.step_1_label}</p>
                    <p className="text-xs text-green-600">{t.step_1_status_complete}</p>
                  </div>
                </div>

                {/* Connector line */}
                <div className="ml-3 w-px h-4 border-l-2 border-dotted border-gray-300"></div>

                {/* Step 2: Signatures */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    step2Complete
                      ? 'bg-green-600 text-white'
                      : currentStep === 2
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step2Complete ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '2'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step2Complete ? 'text-[var(--ink)]' : currentStep === 2 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.step_2_label}
                    </p>
                    <p className={`text-xs ${step2Complete ? 'text-green-600' : currentStep === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {step2Complete
                        ? t.step_2_status_complete
                        : items?.counts.pending_signatures
                        ? t.step_2_status_pending(
                            (items?.signatureProgress?.reduce((acc, s) => acc + s.signed_doc_count, 0) || 0),
                            (items?.signatureProgress?.reduce((acc, s) => acc + s.required_doc_count, 0) || items?.counts.pending_signatures || 0)
                          )
                        : t.step_2_status_pending(0, 0)}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                <div className="ml-3 w-px h-4 border-l-2 border-dotted border-gray-300"></div>

                {/* Step 3: Documents */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    step3Complete
                      ? 'bg-green-600 text-white'
                      : currentStep === 3
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step3Complete ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '3'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step3Complete ? 'text-[var(--ink)]' : currentStep === 3 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.step_3_label}
                    </p>
                    <p className={`text-xs ${step3Complete ? 'text-green-600' : currentStep === 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {step3Complete
                        ? t.step_3_status_complete
                        : t.step_3_status_pending(
                            (items?.counts.rejected_documents ?? 0) + (items?.counts.missing_documents ?? 0),
                            items?.counts.approved_documents ?? 0
                          )}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                <div className="ml-3 w-px h-4 border-l-2 border-dotted border-gray-300"></div>

                {/* Step 4: Review */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    currentStep === 4
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep === 4 ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '4'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${currentStep === 4 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.step_4_label}
                    </p>
                    <p className={`text-xs ${currentStep === 4 ? 'text-green-600' : 'text-gray-400'}`}>
                      {currentStep === 4 ? t.step_4_status_complete : t.step_4_status_waiting}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Items List */}
            {actionItemsLoading ? (
              <div className="bg-white border border-[var(--border)] shadow-sm p-5">
                <p className="text-xs text-[var(--muted)]">Loading action items...</p>
              </div>
            ) : hasActionItems ? (
              <div className="bg-white border border-[var(--border)] shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{t.action_required_title}</h3>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 font-medium">
                    {t.action_required_count(totalActionItems)}
                  </span>
                </div>

                {/* Signature Cards */}
                {items?.signatures.map((signer) => (
                  <div key={signer.member_id} className="border border-[var(--border)] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[var(--ink)]">{signer.name}</p>
                        <p className="text-xs text-[var(--muted)]">{signer.relationship}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {signer.pending_signatures.length} signature{signer.pending_signatures.length !== 1 ? 's' : ''} pending
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPageState('signatures');
                        loadSigners();
                      }}
                      className="w-full py-2 px-3 bg-[var(--primary)] text-white text-xs font-semibold transition-opacity hover:opacity-90"
                    >
                      {t.signature_action_btn} →
                    </button>
                  </div>
                ))}

                {/* Rejected Document Cards */}
                {items?.rejected_documents.map((doc) => (
                  <div key={doc.document_id} className="border-l-3 border-amber-400 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-[var(--ink)]">{doc.label}</span>
                    </div>
                    <p className="text-xs text-amber-700 italic">"{doc.rejection_reason}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('focusDoc', doc.document_id);
                        url.searchParams.delete('view');
                        router.replace(url.pathname + url.search);
                        setPageState('documents');
                      }}
                      className="w-full py-2 px-3 bg-[var(--primary)] text-white text-xs font-semibold transition-opacity hover:opacity-90"
                    >
                      {t.reupload_action_btn} 📷 →
                    </button>
                  </div>
                ))}

                {/* Missing Document Cards */}
                {items?.missing_documents.map((doc) => (
                  <div key={doc.document_id} className="border border-[var(--border)] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium text-[var(--ink)]">{doc.label}</span>
                      {doc.required && <span className="text-xs text-red-600">*</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPageState('documents')}
                      className="w-full py-2 px-3 border border-[var(--primary)] text-[var(--primary)] text-xs font-semibold transition-opacity hover:bg-[var(--primary)] hover:text-white"
                    >
                      {t.upload_action_btn} 📷 →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 shadow-sm p-5">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-green-800">{t.all_requirements_met}</p>
                </div>
              </div>
            )}

            {/* Approved Documents */}
            {items && items.approved_documents.length > 0 && (
              <details className="bg-white border border-[var(--border)] shadow-sm">
                <summary className="p-4 cursor-pointer flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--muted)]">
                    {t.approved_documents_count(items.approved_documents.length)}
                  </span>
                  <svg className="w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  {items.approved_documents.map((doc) => (
                    <div key={doc.document_id} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{doc.label}{doc.person_name ? ` — ${doc.person_name}` : ''}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Back to Dashboard */}
            <button
              type="button"
              onClick={() => setPageState('docs_ready')}
              className="w-full py-3 px-4 text-sm text-[var(--muted)] underline"
            >
              {t.back_to_dashboard}
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Phase 5: Docs ready ─────────────────────────────────────────────────────────────

  if (pageState === 'docs_ready') {
    const summary = documentSummary ?? {};
    const missingCount = (summary.missing ?? 0) + (summary.rejected ?? 0);
    const uploadedCount = (summary.submitted ?? 0) + (summary.approved ?? 0) + (summary.waived ?? 0);
    const totalDocs = summary.total ?? 0;

    // Determine current step for visual progress
    const intakeComplete = true; // We're in docs_ready, so intake is done
    const step1Complete = intakeComplete;
    const step2Complete = signaturesComplete;
    const step3Complete = missingCount === 0 && !rejectedDocsLoading && rejectedDocs.length === 0;

    const currentStep = !step1Complete ? 1 : !step2Complete ? 2 : !step3Complete ? 3 : 4;

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-md mx-auto space-y-4">
            {/* Progress Steps */}
            <div className="bg-white border border-[var(--border)] shadow-sm p-5">
              <h2 className="text-lg font-bold font-serif text-[var(--primary)] mb-4">{t.progress_title}</h2>

              <div className="space-y-3">
                {/* Step 1: Intake - Always complete here */}
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">{t.intro_step1_title.replace('1. ', '')}</p>
                    <p className="text-xs text-green-600">{t.step_1_status_complete}</p>
                  </div>
                </div>

                {/* Step 2: Signatures */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    step2Complete
                      ? 'bg-green-600 text-white'
                      : currentStep === 2
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step2Complete ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '2'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step2Complete ? 'text-[var(--ink)]' : currentStep === 2 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.intro_step2_title.replace('2. ', '')}
                    </p>
                    <p className={`text-xs ${step2Complete ? 'text-green-600' : currentStep === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {step2Complete
                        ? t.step_2_status_complete
                        : currentStep === 2
                        ? t.step_2_status_pending(
                            signatureProgress.reduce((acc, s) => acc + s.signed_doc_count, 0),
                            signatureProgress.reduce((acc, s) => acc + s.required_doc_count, 0)
                          )
                        : t.step_4_status_waiting}
                    </p>
                  </div>
                </div>

                {/* Step 3: Documents */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    step3Complete
                      ? 'bg-green-600 text-white'
                      : currentStep === 3
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step3Complete ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '3'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step3Complete ? 'text-[var(--ink)]' : currentStep === 3 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.intro_step3_title.replace('3. ', '')}
                    </p>
                    <p className={`text-xs ${step3Complete ? 'text-green-600' : currentStep === 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {step3Complete
                        ? t.step_3_status_complete
                        : t.step_3_status_pending(missingCount, uploadedCount)}
                    </p>
                  </div>
                </div>

                {/* Step 4: Review */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center font-semibold text-sm ${
                    currentStep === 4
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep === 4 ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      '4'
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${currentStep === 4 ? 'text-[var(--ink)]' : 'text-gray-500'}`}>
                      {t.step_4_label}
                    </p>
                    <p className={`text-xs ${currentStep === 4 ? 'text-green-600' : 'text-gray-400'}`}>
                      {currentStep === 4 ? t.step_4_status_complete : t.step_4_status_waiting}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rejected Documents Alert */}
            {rejectedDocsLoading ? (
              <div className="bg-white border border-[var(--border)] shadow-sm p-5">
                <p className="text-xs text-[var(--muted)]">Checking for rejected documents...</p>
              </div>
            ) : rejectedDocs.length > 0 ? (
              <div className="bg-white border border-red-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-red-700">{t.rejected_docs_title}</h3>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t.rejected_docs_body}
                </p>
                {rejectedDocs.map((doc) => (
                  <div key={doc.id} className="border border-red-100 bg-red-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--ink)]">{doc.label}</span>
                      <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5">Rejected</span>
                    </div>
                    <p className="text-xs text-[var(--muted)] italic">{doc.rejection_message}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('focusDoc', doc.id);
                        router.replace(url.pathname + url.search);
                        setPageState('documents');
                      }}
                      className="w-full py-2 px-3 bg-[var(--primary)] text-white text-xs font-semibold transition-opacity hover:opacity-90"
                    >
                      {t.upload_new_version_btn}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Signatures Card */}
            {!signaturesComplete && (
              <div className="bg-white border border-[var(--border)] shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <p className="text-sm font-semibold text-[var(--ink)]">{t.sig_section_needed}</p>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">
                    {t.step_2_status_pending(
                      signatureProgress.reduce((acc, s) => acc + s.signed_doc_count, 0),
                      signatureProgress.reduce((acc, s) => acc + s.required_doc_count, 0)
                    )}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t.sig_section_needed_subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPageState('signatures');
                    loadSigners();
                  }}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  {t.sig_resume_btn}
                </button>
              </div>
            )}

            {/* Documents Card */}
            {missingCount > 0 && (
              <div className="bg-white border border-[var(--border)] shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-semibold text-[var(--ink)]">{t.docs_section_needed}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{t.step_3_status_pending(missingCount, uploadedCount)}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t.docs_ready_body}
                </p>
                <button
                  type="button"
                  onClick={() => setPageState('documents')}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold text-center transition-opacity hover:opacity-90"
                >
                  {t.docs_upload_btn}
                </button>
              </div>
            )}

            {/* All Complete Message */}
            {signaturesComplete && missingCount === 0 && (
              <div className="bg-green-50 border border-green-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-green-800">{t.all_complete_title}</p>
                </div>
                <p className="text-xs text-green-700">{t.all_complete_body}</p>
                <p className="text-xs text-green-700">{t.confirm_contact}</p>
              </div>
            )}

            {/* View Action Items Button */}
            {(!signaturesComplete || missingCount > 0) && (
              <button
                type="button"
                onClick={() => setPageState('action_items')}
                className="w-full py-3 px-4 bg-[var(--accent)] text-white text-sm font-semibold transition-opacity hover:opacity-90"
              >
                {t.view_all_action_items} →
              </button>
            )}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Phase 3b: Document upload ─────────────────────────────────────────────────────

  if (pageState === 'documents') {
    const focusDocId = searchParams.get('focusDoc') || undefined;

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => {
                // Clear focusDoc param when going back
                const url = new URL(window.location.href);
                url.searchParams.delete('focusDoc');
                router.replace(url.pathname + url.search);
                setPageState('docs_ready');
              }}
              className="mb-4 text-sm text-[var(--muted)] underline"
            >
              {t.back_to_summary}
            </button>
            <TenantDocumentUpload
              token={token}
              language={language}
              initialDocuments={[]}
              packetLocked={false}
            />
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
                {sigError && (
                  <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {sigError}
                  </div>
                )}
                <button type="button" onClick={sigError ? handleFinalize : () => setPageState('docs_ready')}
                  disabled={sigSaving}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50">
                  {sigError ? t.finalize_retry_btn : t.sig_last_signer_done_btn}
                </button>
              </div>
            </div>
          </main>
          <Footer />
        </>
      );
    }
    if (signerStep === 'handoff') {
      const isFirstSigner = signerIndex === 0;
      const pendingCount = currentSigner.documents.filter(
        (d) => d.status !== 'approved' && d.status !== 'waived'
      ).length;
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
                    {isFirstSigner
                      ? t.sig_first_signer_title(currentSigner.name)
                      : t.sig_handoff_title(currentSigner.name)}
                  </h2>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">
                    {isFirstSigner
                      ? t.sig_first_signer_body(pendingCount)
                      : t.sig_handoff_body}
                  </p>
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
              {pendingDocs.map((doc, idx) => (
                <div key={doc.id} className="bg-white border border-[var(--border)] shadow-sm">
                  <div className="px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--ink)]">{doc.label}</p>
                      <span className="flex-shrink-0 text-xs text-[var(--muted)]">
                        {t.sig_form_count(idx + 1, pendingDocs.length)}
                      </span>
                    </div>
                    {t.sig_form_descriptions[doc.doc_type] && (
                      <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                        {t.sig_form_descriptions[doc.doc_type]}
                      </p>
                    )}
                  </div>
                  <div className="p-4" style={{ touchAction: 'none' }}>
                    <div className="border border-[var(--border)] bg-white overflow-hidden" style={{ touchAction: 'none' }}>
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
              <div className="bg-white border border-[var(--border)] shadow-sm p-4 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sigConsentChecked}
                    onChange={(e) => {
                      setSigConsentChecked(e.target.checked);
                      setConsentConfirmedAt(e.target.checked ? new Date().toISOString() : null);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--ink)] leading-relaxed">{t.sig_consent_label}</span>
                </label>
                <button type="button" onClick={handleSaveSignatures} disabled={sigSaving || !sigConsentChecked}
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
                  <p className="text-sm text-[var(--ink)] leading-relaxed">
                    {isLast
                      ? t.sig_all_signed_body
                      : signers.length === 1
                      ? t.sig_signer_done_body_single
                      : t.sig_signer_done_body}
                  </p>
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

  // ── Phase 4: Signature review screen ─────────────────────────────────────────
  if (pageState === 'signature_review') {
    // Per-doc re-sign: render single-doc canvas surface
    if (resigningDocId) {
      const resignDoc = signers.flatMap((s) => s.documents).find((d) => d.id === resigningDocId);
      const resignSigner = signers.find((s) => s.documents.some((d) => d.id === resigningDocId));
      const handleResignSave = async () => {
        if (!resignDoc || !resignSigner) return;
        const canvas = sigCanvasRefs.current.get(resigningDocId);
        if (!canvas || canvas.isEmpty()) { setSigError(t.sig_unsigned_error); return; }
        setSigSaving(true);
        setSigError('');
        try {
          const res = await tenantFetch(`/api/t/${token}/pbv-full-app/signatures`, {
            method: 'POST',
            body: {
              member_id: resignSigner.id,
              signatures: [{ document_id: resigningDocId, data_url: canvas.toDataURL('image/png') }],
              consent_confirmed: true,
              consent_confirmed_at: new Date().toISOString(),
              user_agent: navigator.userAgent,
            },
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message || 'Failed to save signature');
          setResigningDocId(null);
          setThumbnailUrls({});
          // Re-fetch thumbnails
          const paths = signers.flatMap((s) =>
            s.documents.filter((d) => d.storage_path).map((d) => d.storage_path as string)
          );
          if (paths.length > 0) {
            tenantFetch(`/api/t/${token}/pbv-full-app/signature-thumbnails?paths=${encodeURIComponent(paths.join(','))}`)
              .then((r) => r.json())
              .then((j) => { if (j.success) setThumbnailUrls(j.data); })
              .catch(() => {});
          }
        } catch (err: any) {
          setSigError(err.message || 'Failed to save signature');
        } finally {
          setSigSaving(false);
        }
      };
      return (
        <>
          <Header language={language} onLanguageChange={setLanguage} />
          <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
            <div className="max-w-2xl mx-auto space-y-4">
              <button type="button" onClick={() => { setResigningDocId(null); setSigError(''); }}
                className="text-sm text-[var(--muted)] underline">
                ← {t.sig_review_title}
              </button>
              <div className="bg-white border border-[var(--border)] shadow-sm px-5 py-4">
                <h2 className="text-lg font-bold font-serif text-[var(--primary)]">{resignDoc?.label}</h2>
                {resignSigner && <p className="text-sm text-[var(--muted)] mt-1">{t.sig_review_signer_label(resignSigner.name)}</p>}
              </div>
              {sigError && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sigError}</div>}
              <div className="bg-white border border-[var(--border)] shadow-sm">
                <div className="p-4" style={{ touchAction: 'none' }}>
                  <div className="border border-[var(--border)] bg-white overflow-hidden" style={{ touchAction: 'none' }}>
                    <SignatureCanvas
                      ref={(el) => { sigCanvasRefs.current.set(resigningDocId, el); }}
                      canvasProps={{ className: 'w-full', style: { width: '100%', height: '140px', touchAction: 'none' } }}
                      backgroundColor="white"
                    />
                  </div>
                  <button type="button" onClick={() => { sigCanvasRefs.current.get(resigningDocId)?.clear(); }}
                    className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline">
                    {t.sig_clear_btn}
                  </button>
                </div>
              </div>
              <div className="pb-8">
                <button type="button" onClick={handleResignSave} disabled={sigSaving}
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

    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="min-h-screen bg-[var(--paper)] py-6 px-4">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white border border-[var(--border)] shadow-sm px-5 py-4">
              <h2 className="text-xl font-bold font-serif text-[var(--primary)]">{t.sig_review_title}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">{t.sig_review_subtitle}</p>
            </div>
            {sigError && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
                <p>{sigError}</p>
                {finalizeErrors.map((e, i) => (
                  <p key={i} className="font-medium">{t.sig_review_missing_error(e.signer_name, e.doc_label)}</p>
                ))}
              </div>
            )}
            {signers.map((signer) => (
              <div key={signer.id} className="space-y-3">
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                  {t.sig_review_signer_label(signer.name)}
                </p>
                {signer.documents.map((doc) => (
                  <div key={doc.id} className="bg-white border border-[var(--border)] shadow-sm flex items-center gap-4 p-4">
                    <div className="w-20 h-14 border border-[var(--border)] bg-[var(--bg-section)] flex items-center justify-center shrink-0 overflow-hidden">
                      {thumbnailUrls[doc.storage_path ?? ''] ? (
                        <img
                          src={thumbnailUrls[doc.storage_path!]}
                          alt={doc.label}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink)] truncate">{doc.label}</p>
                      <p className="text-xs text-[var(--muted)]">{signer.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setResigningDocId(doc.id); setSigError(''); setFinalizeErrors([]); sigCanvasRefs.current.clear(); }}
                      className="text-xs text-[var(--primary)] underline hover:opacity-70 transition-opacity shrink-0"
                    >
                      {t.sig_review_resign_btn}
                    </button>
                  </div>
                ))}
              </div>
            ))}
            <div className="pb-8">
              <button type="button" onClick={handleFinalize} disabled={sigSaving}
                className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50">
                {sigSaving ? t.sig_saving : t.sig_review_confirm_btn}
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
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

  const goNext = (n: number) => {
    if (validateSection(n)) {
      nextSection();
    } else {
      // Scroll to the first visible error field
      requestAnimationFrame(() => {
        const firstError = document.querySelector('[data-error="true"], .text-\\[var\\(--error\\)\\]') as HTMLElement | null;
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  };
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
                      data-testid="hoh-name"
                    />
                  </FormField>

                  <FormField label={t.hoh_dob_label} required error={errors['hohDob']}>
                    <input
                      type="date"
                      value={form.hohDob}
                      max={today}
                      onChange={(e) => updateHoH({ hohDob: e.target.value })}
                      autoComplete="bday"
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                      data-testid="hoh-dob"
                    />
                  </FormField>

                  <div className="space-y-1">
                    <FormField label={t.phone_label} required error={errors['phone']}>
                      <FormPhoneInput
                        value={phone}
                        onChange={setPhone}
                        error={!!errors['phone']}
                        errorMessage={errors['phone']}
                      />
                    </FormField>
                    <p className="text-xs text-[var(--muted)] px-0.5">{t.phone_helper}</p>
                  </div>

                  {!langConfirmed ? (
                    <div className="border border-[var(--border)] bg-[var(--bg-section)] px-4 py-4 space-y-3">
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {t.lang_confirm_label(LANG_DISPLAY_NAMES[language] ?? language)}
                      </p>
                      {errors['langConfirm'] && (
                        <p className="text-xs text-[var(--error)]">{errors['langConfirm']}</p>
                      )}
                      <FormButton type="button" onClick={() => setLangConfirmed(true)} fullWidth>
                        {t.lang_confirm_btn}
                      </FormButton>
                      <button
                        type="button"
                        onClick={() => { clearAllErrors(); setPageState('landing'); }}
                        className="w-full text-center text-xs text-[var(--muted)] underline"
                      >
                        {t.lang_change_label}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border border-[var(--divider)] bg-[var(--bg-section)] px-4 py-3">
                      <span className="text-sm text-[var(--ink)]">
                        {t.lang_confirm_label(LANG_DISPLAY_NAMES[language] ?? language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setLangConfirmed(false); clearAllErrors(); setPageState('landing'); }}
                        className="text-xs text-[var(--muted)] underline ml-4 flex-shrink-0"
                      >
                        {t.lang_change_label}
                      </button>
                    </div>
                  )}

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
                  <div className="border border-[var(--divider)] bg-[var(--bg-section)] px-4 py-3">
                    <p className="text-xs text-[var(--muted)] leading-relaxed">{t.background_reassurance}</p>
                  </div>
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
                        data-testid="cert-checked"
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
                data-testid={`member-${index}-name`}
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
                data-testid={`member-${index}-dob`}
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
                data-testid={`member-${index}-relationship`}
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
            data-testid={`member-${index}-citizenship`}
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
            data-testid={`member-${index}-ssn`}
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
                  data-testid={`income-${src}-${index}`}
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
              data-testid={`annual-income-${index}`}
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
