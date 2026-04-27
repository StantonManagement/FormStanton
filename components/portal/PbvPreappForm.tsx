'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { HouseholdMember } from '@/types/compliance';
import { pbvFormTranslations, PbvFormStrings } from '@/lib/pbvFormTranslations';
import { TaskComponentProps } from './types';

const INCOME_SOURCES = [
  { key: 'employment', labelKey: 'src_employment' as const },
  { key: 'ssi', labelKey: 'src_ssi' as const },
  { key: 'ss', labelKey: 'src_ss' as const },
  { key: 'pension', labelKey: 'src_pension' as const },
  { key: 'tanf', labelKey: 'src_tanf' as const },
  { key: 'child_support', labelKey: 'src_child_support' as const },
  { key: 'unemployment', labelKey: 'src_unemployment' as const },
  { key: 'self_employment', labelKey: 'src_self_employment' as const },
  { key: 'other', labelKey: 'src_other' as const },
  { key: 'none', labelKey: 'src_none' as const },
];

const RELATIONSHIPS = [
  { key: 'self', labelKey: 'rel_self' as const },
  { key: 'spouse', labelKey: 'rel_spouse' as const },
  { key: 'partner', labelKey: 'rel_partner' as const },
  { key: 'child', labelKey: 'rel_child' as const },
  { key: 'parent', labelKey: 'rel_parent' as const },
  { key: 'sibling', labelKey: 'rel_sibling' as const },
  { key: 'other', labelKey: 'rel_other' as const },
];

function emptyMember(relationship = 'other'): HouseholdMember {
  return { name: '', dob: '', relationship, annual_income: 0, income_sources: [] };
}

type CitizenshipAnswer = 'yes' | 'no' | 'unsure' | null;

interface FormData {
  hohName: string;
  hohDob: string;
  members: HouseholdMember[];
  citizenshipAnswer: CitizenshipAnswer;
  certChecked: boolean;
  signatureData: string;
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'form'; building: string; unitNumber: string; bedroomCount: number | null }
  | { status: 'already_submitted' }
  | { status: 'confirmed' };

export default function PbvPreappForm({ task, token, language, onComplete }: TaskComponentProps) {
  const t = pbvFormTranslations[language] ?? pbvFormTranslations['en'];

  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
  const [form, setForm] = useState<FormData>({
    hohName: '',
    hohDob: '',
    members: [emptyMember('self')],
    citizenshipAnswer: null,
    certChecked: false,
    signatureData: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const today = new Date().toISOString().split('T')[0];

  const loadForm = useCallback(async () => {
    try {
      const res = await fetch(`/api/t/${token}/pbv-preapp`);
      if (res.status === 404) { setPageState({ status: 'error', message: 'Not found' }); return; }
      if (res.status === 410) { setPageState({ status: 'error', message: 'This link has expired' }); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setPageState({ status: 'error', message: d.message || 'Failed to load form' });
        return;
      }
      const json = await res.json();
      if (json.data?.existing_submission) {
        setPageState({ status: 'already_submitted' });
        return;
      }
      setPageState({
        status: 'form',
        building: json.data.building,
        unitNumber: json.data.unit_number,
        bedroomCount: json.data.bedroom_count,
      });
    } catch {
      setPageState({ status: 'error', message: 'Network error. Please try again.' });
    }
  }, [token]);

  useEffect(() => { loadForm(); }, [loadForm]);

  // Sync member[0] name+dob with HoH fields
  useEffect(() => {
    setForm((prev) => {
      const updated = [...prev.members];
      if (updated[0]) {
        updated[0] = { ...updated[0], name: prev.hohName, dob: prev.hohDob, relationship: 'self' };
      }
      return { ...prev, members: updated };
    });
  }, [form.hohName, form.hohDob]);

  const totalIncome = form.members.reduce((sum, m) => sum + (Number(m.annual_income) || 0), 0);

  const formatCurrency = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const updateMember = (index: number, patch: Partial<HouseholdMember>) => {
    setForm((prev) => {
      const updated = [...prev.members];
      updated[index] = { ...updated[index], ...patch };
      return { ...prev, members: updated };
    });
  };

  const addMember = () => {
    setForm((prev) => ({ ...prev, members: [...prev.members, emptyMember()] }));
  };

  const removeMember = (index: number) => {
    setForm((prev) => ({ ...prev, members: prev.members.filter((_, i) => i !== index) }));
  };

  const toggleIncomeSource = (memberIndex: number, source: string) => {
    setForm((prev) => {
      const updated = [...prev.members];
      const current = updated[memberIndex].income_sources;
      if (source === 'none') {
        updated[memberIndex] = { ...updated[memberIndex], income_sources: current.includes('none') ? [] : ['none'] };
      } else {
        const without = current.filter((s) => s !== 'none');
        updated[memberIndex] = {
          ...updated[memberIndex],
          income_sources: without.includes(source)
            ? without.filter((s) => s !== source)
            : [...without, source],
        };
      }
      return { ...prev, members: updated };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.hohName.trim()) errs['hoh_name'] = t.err_hoh_name;
    if (!form.hohDob) {
      errs['hoh_dob'] = t.err_hoh_dob;
    } else {
      const dob = new Date(form.hohDob);
      const minAge = new Date();
      minAge.setFullYear(minAge.getFullYear() - 18);
      if (dob > minAge) errs['hoh_dob'] = t.err_hoh_age;
    }

    form.members.forEach((m, i) => {
      if (!m.name.trim()) errs[`member_${i}_name`] = t.err_member_name(i + 1);
      if (!m.dob) errs[`member_${i}_dob`] = t.err_member_dob(i + 1);
      if (!m.relationship) errs[`member_${i}_relationship`] = t.err_member_relationship(i + 1);
      if (m.annual_income === null || m.annual_income === undefined || (m.annual_income as any) === '') {
        errs[`member_${i}_income`] = t.err_member_income(i + 1);
      }
    });

    if (form.citizenshipAnswer === null) errs['citizenship'] = t.err_citizenship;

    if (!form.certChecked) errs['cert'] = t.err_cert;
    if (!form.signatureData) errs['signature'] = t.err_signature;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/t/${token}/pbv-preapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hoh_name: form.hohName.trim(),
          hoh_dob: form.hohDob,
          household_members: form.members,
          citizenship_answer: form.citizenshipAnswer,
          signature_data: form.signatureData,
          task_id: task.id,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.message || 'Submission failed. Please try again.');
        return;
      }

      setPageState({ status: 'confirmed' });
      onComplete();
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignatureEnd = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const dataUrl = sigCanvasRef.current.toDataURL('image/png');
      setForm((prev) => ({ ...prev, signatureData: dataUrl }));
    }
  };

  const clearSignature = () => {
    sigCanvasRef.current?.clear();
    setForm((prev) => ({ ...prev, signatureData: '' }));
  };

  if (pageState.status === 'loading') {
    return <p className="text-sm text-[var(--muted)] py-4">{t.loading}</p>;
  }

  if (pageState.status === 'error') {
    return <p className="text-sm text-[var(--error)] py-4">{pageState.message}</p>;
  }

  if (pageState.status === 'already_submitted') {
    return (
      <div className="py-4 text-sm text-[var(--ink)] leading-relaxed">{t.already_submitted}</div>
    );
  }

  if (pageState.status === 'confirmed') {
    return (
      <div className="py-6 space-y-3 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--primary)]">{t.confirm_title}</h3>
        <p className="text-sm text-[var(--ink)] leading-relaxed max-w-sm mx-auto">{t.confirm_body}</p>
        <p className="text-sm text-[var(--muted)]">{t.confirm_contact}</p>
      </div>
    );
  }

  const { building, unitNumber } = pageState;

  return (
    <div className="space-y-8 py-2">
      {/* Section 1 — Head of Household */}
      <section>
        <h3 className="font-serif text-base text-[var(--primary)] mb-4 pb-2 border-b border-[var(--divider)]">
          {t.section1_title}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              {t.hoh_name_label} <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={form.hohName}
              onChange={(e) => setForm((p) => ({ ...p, hohName: e.target.value }))}
              className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
              autoComplete="name"
            />
            {errors['hoh_name'] && <p className="text-xs text-[var(--error)] mt-1">{errors['hoh_name']}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              {t.hoh_dob_label} <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="date"
              value={form.hohDob}
              max={today}
              onChange={(e) => setForm((p) => ({ ...p, hohDob: e.target.value }))}
              className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
            />
            {errors['hoh_dob'] && <p className="text-xs text-[var(--error)] mt-1">{errors['hoh_dob']}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t.building_label}</label>
              <div className="px-3 py-3 border border-[var(--border)] rounded-none text-sm bg-[var(--bg-section)] text-[var(--muted)]">
                {building}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t.unit_label}</label>
              <div className="px-3 py-3 border border-[var(--border)] rounded-none text-sm bg-[var(--bg-section)] text-[var(--muted)]">
                {unitNumber}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Household Members */}
      <section>
        <h3 className="font-serif text-base text-[var(--primary)] mb-4 pb-2 border-b border-[var(--divider)]">
          {t.section2_title}
        </h3>
        <div className="space-y-6">
          {form.members.map((member, idx) => (
            <MemberCard
              key={idx}
              index={idx}
              member={member}
              isHoh={idx === 0}
              t={t}
              errors={errors}
              onUpdate={(patch) => updateMember(idx, patch)}
              onRemove={() => removeMember(idx)}
              onToggleSource={(src) => toggleIncomeSource(idx, src)}
            />
          ))}

          <button
            type="button"
            onClick={addMember}
            className="w-full py-3 border border-dashed border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-[var(--bg-section)] transition-colors duration-200 rounded-none"
          >
            + {t.add_member_btn}
          </button>

          <div className="bg-[var(--bg-section)] border border-[var(--divider)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.income_total_display(formatCurrency(totalIncome))}
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 — Citizenship */}
      <section>
        <h3 className="font-serif text-base text-[var(--primary)] mb-4 pb-2 border-b border-[var(--divider)]">
          {t.section3_title}
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-[var(--ink)] mb-2 leading-relaxed">
              {t.citizenship_question} <span className="text-[var(--error)]">*</span>
            </p>
            <p className="text-xs text-[var(--muted)] mb-4">
              {t.citizenship_examples}
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                <input
                  type="radio"
                  name="citizenship"
                  checked={form.citizenshipAnswer === 'yes'}
                  onChange={() => setForm((p) => ({ ...p, citizenshipAnswer: 'yes' }))}
                  className="w-5 h-5 flex-shrink-0"
                />
                <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_yes}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                <input
                  type="radio"
                  name="citizenship"
                  checked={form.citizenshipAnswer === 'no'}
                  onChange={() => setForm((p) => ({ ...p, citizenshipAnswer: 'no' }))}
                  className="w-5 h-5 flex-shrink-0"
                />
                <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_no}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                <input
                  type="radio"
                  name="citizenship"
                  checked={form.citizenshipAnswer === 'unsure'}
                  onChange={() => setForm((p) => ({ ...p, citizenshipAnswer: 'unsure' }))}
                  className="w-5 h-5 flex-shrink-0"
                />
                <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_unsure}</span>
              </label>
            </div>
            {errors['citizenship'] && <p className="text-xs text-[var(--error)] mt-2">{errors['citizenship']}</p>}
          </div>
        </div>
      </section>

      {/* Section 4 — Certification & Signature */}
      <section>
        <h3 className="font-serif text-base text-[var(--primary)] mb-4 pb-2 border-b border-[var(--divider)]">
          {t.section4_title}
        </h3>
        <div className="space-y-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.certChecked}
              onChange={(e) => setForm((p) => ({ ...p, certChecked: e.target.checked }))}
              className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-none border-[var(--border)]"
            />
            <span className="text-sm text-[var(--ink)] leading-relaxed">{t.cert_checkbox_label}</span>
          </label>
          {errors['cert'] && <p className="text-xs text-[var(--error)]">{errors['cert']}</p>}

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-2">
              {t.signature_label} <span className="text-[var(--error)]">*</span>
            </label>
            <div className="border border-[var(--border)] bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  className: 'w-full',
                  style: { width: '100%', height: '140px', touchAction: 'none' },
                }}
                backgroundColor="white"
                onEnd={handleSignatureEnd}
              />
            </div>
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline"
            >
              {t.clear_signature}
            </button>
            {errors['signature'] && <p className="text-xs text-[var(--error)] mt-1">{errors['signature']}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t.date_label}</label>
            <div className="px-3 py-3 border border-[var(--border)] rounded-none text-sm bg-[var(--bg-section)] text-[var(--muted)]">
              {today}
            </div>
          </div>
        </div>
      </section>

      {submitError && (
        <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-[var(--primary)] text-white py-4 px-4 rounded-none font-medium text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? t.submitting : t.submit_btn}
      </button>
    </div>
  );
}

function MemberCard({
  index,
  member,
  isHoh,
  t,
  errors,
  onUpdate,
  onRemove,
  onToggleSource,
}: {
  index: number;
  member: HouseholdMember;
  isHoh: boolean;
  t: PbvFormStrings;
  errors: Record<string, string>;
  onUpdate: (patch: Partial<HouseholdMember>) => void;
  onRemove: () => void;
  onToggleSource: (src: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
        <span className="text-sm font-medium text-[var(--ink)]">
          {isHoh ? t.rel_self : `${t.section2_title} ${index + 1}`}
        </span>
        {!isHoh && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors duration-200 underline"
          >
            {t.remove_member_btn}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1">
            {t.member_name_label} <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={member.name}
            readOnly={isHoh}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={`w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] ${isHoh ? 'bg-[var(--bg-section)] text-[var(--muted)]' : 'bg-white'}`}
          />
          {errors[`member_${index}_name`] && (
            <p className="text-xs text-[var(--error)] mt-1">{errors[`member_${index}_name`]}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1">
            {t.member_dob_label} <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="date"
            value={member.dob}
            max={today}
            readOnly={isHoh}
            onChange={(e) => onUpdate({ dob: e.target.value })}
            className={`w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] ${isHoh ? 'bg-[var(--bg-section)] text-[var(--muted)]' : 'bg-white'}`}
          />
          {errors[`member_${index}_dob`] && (
            <p className="text-xs text-[var(--error)] mt-1">{errors[`member_${index}_dob`]}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1">
            {t.member_relationship_label} <span className="text-[var(--error)]">*</span>
          </label>
          {isHoh ? (
            <div className="px-3 py-3 border border-[var(--border)] rounded-none text-sm bg-[var(--bg-section)] text-[var(--muted)]">
              {t.rel_self}
            </div>
          ) : (
            <select
              value={member.relationship}
              onChange={(e) => onUpdate({ relationship: e.target.value })}
              className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
            >
              <option value="">—</option>
              {RELATIONSHIPS.filter((r) => r.key !== 'self').map((r) => (
                <option key={r.key} value={r.key}>{t[r.labelKey]}</option>
              ))}
            </select>
          )}
          {errors[`member_${index}_relationship`] && (
            <p className="text-xs text-[var(--error)] mt-1">{errors[`member_${index}_relationship`]}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-1">
            {t.member_income_label} <span className="text-[var(--error)]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={member.annual_income === 0 && member.income_sources.includes('none') ? 0 : member.annual_income || ''}
              onChange={(e) => onUpdate({ annual_income: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-full pl-7 pr-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
              placeholder="0"
            />
          </div>
          {errors[`member_${index}_income`] && (
            <p className="text-xs text-[var(--error)] mt-1">{errors[`member_${index}_income`]}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            {t.member_income_sources_label}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {INCOME_SOURCES.map((src) => (
              <label key={src.key} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={member.income_sources.includes(src.key)}
                  onChange={() => onToggleSource(src.key)}
                  className="w-4 h-4 rounded-none border-[var(--border)]"
                />
                <span className="text-sm text-[var(--ink)]">{t[src.labelKey]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
