'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { buildings, buildingUnits } from '@/lib/buildings';
import { pbvFormTranslations, type PbvFormStrings } from '@/lib/pbvFormTranslations';
import type { Language } from '@/lib/translations';
import {
  FormField,
  FormButton,
  FormCheckbox,
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
import type { HouseholdMember } from '@/types/compliance';

// ── Constants ───────────────────────────────────────────────────────────────

const CONSENT_TEXT =
  'By submitting, you authorize Stanton Management to share this information with Hartford Housing Authority for the purpose of evaluating your eligibility for the Project-Based Voucher program.';

const INCOME_SRCS = [
  'employment','ssi','ss','pension','tanf',
  'child_support','unemployment','self_employment','other','none',
] as const;

const EXTRA_RELATIONSHIPS = ['spouse','partner','child','parent','sibling','other'] as const;

// ── Types ────────────────────────────────────────────────────────────────────

type CitizenshipAnswer = 'yes' | 'no' | 'unsure' | null;

interface PbvOpenFormData {
  building: string;
  unit: string;
  hohName: string;
  hohDob: string;
  members: HouseholdMember[];
  citizenshipAnswer: CitizenshipAnswer;
  consentChecked: boolean;
  certChecked: boolean;
}

const blankMember = (rel = ''): HouseholdMember => ({
  name: '', dob: '', relationship: rel, annual_income: 0, income_sources: [],
});

const INITIAL: PbvOpenFormData = {
  building: '',
  unit: '',
  hohName: '',
  hohDob: '',
  members: [blankMember('self')],
  citizenshipAnswer: null,
  consentChecked: false,
  certChecked: false,
};

// ── Inner component (needs useSearchParams) ──────────────────────────────────

function PbvPreappContent() {
  const searchParams = useSearchParams();
  const lp = searchParams.get('lang');
  const initLang: Language = lp === 'en' || lp === 'es' || lp === 'pt' ? lp : 'en';

  const [language, setLanguage] = useState<Language>(initLang);
  const [showForm, setShowForm] = useState(lp === 'en' || lp === 'es' || lp === 'pt');
  const [form, setForm] = useState<PbvOpenFormData>(INITIAL);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const sigRef = useRef<SignatureCanvas>(null);

  const t = pbvFormTranslations[language];
  const today = new Date().toISOString().split('T')[0];

  const { currentSection, nextSection, goToSection, completedSections } = useFormSection(4);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<Record<string, string>>();

  // Derived
  const knownUnits = form.building ? (buildingUnits[form.building] ?? null) : null;
  const totalIncome = form.members.reduce((s, m) => s + (Number(m.annual_income) || 0), 0);
  const fmtCurrency = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Field helpers
  const setField = <K extends keyof PbvOpenFormData>(key: K, val: PbvOpenFormData[K]) =>
    setForm(p => ({ ...p, [key]: val }));

  const updateHoH = (patch: { hohName?: string; hohDob?: string }) =>
    setForm(prev => {
      const next = { ...prev, ...patch };
      const members = [...next.members];
      members[0] = { ...members[0], name: next.hohName, dob: next.hohDob, relationship: 'self' };
      return { ...next, members };
    });

  const updateMember = (i: number, patch: Partial<HouseholdMember>) => {
    const next = [...form.members];
    next[i] = { ...next[i], ...patch };
    setField('members', next);
  };

  const addMember = () => setField('members', [...form.members, blankMember()]);
  const removeMember = (i: number) => setField('members', form.members.filter((_, idx) => idx !== i));

  const toggleSource = (mi: number, src: string) => {
    const curr = form.members[mi].income_sources;
    const next = [...form.members];
    if (src === 'none') {
      next[mi] = { ...next[mi], income_sources: curr.includes('none') ? [] : ['none'] };
    } else {
      const without = curr.filter(s => s !== 'none');
      next[mi] = {
        ...next[mi],
        income_sources: without.includes(src) ? without.filter(s => s !== src) : [...without, src],
      };
    }
    setField('members', next);
  };

  // Per-section validation
  const validateSection = (n: number): boolean => {
    clearAllErrors();
    if (n === 1) {
      let ok = true;
      if (!form.building) { setFieldError('building', 'Please select a building.'); ok = false; }
      if (!form.unit.trim()) { setFieldError('unit', 'Unit is required.'); ok = false; }
      return ok;
    }
    if (n === 2) {
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
        const n2 = i + 2;
        if (!m.name.trim()) { setFieldError(`m${i + 1}name`, t.err_member_name(n2)); ok = false; }
        if (!m.dob) { setFieldError(`m${i + 1}dob`, t.err_member_dob(n2)); ok = false; }
        if (!m.relationship) { setFieldError(`m${i + 1}rel`, t.err_member_relationship(n2)); ok = false; }
      });
      return ok;
    }
    if (n === 3) {
      if (form.citizenshipAnswer === null) {
        setFieldError('citizenship', t.err_citizenship);
        return false;
      }
      return true;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consentChecked || !form.certChecked || !signature) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/forms/pbv-preapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_address: form.building,
          unit_number: form.unit.trim(),
          hoh_name: form.hohName.trim(),
          hoh_dob: form.hohDob,
          household_members: form.members,
          citizenship_answer: form.citizenshipAnswer,
          signature_data: signature,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Submission failed. Please try again.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <LanguageLanding
        title={t.form_title}
        description={t.form_subtitle}
        onSelect={(lang) => { setLanguage(lang); setShowForm(true); }}
      />
    );
  }

  if (submitted) {
    return (
      <SuccessScreen
        title={t.confirm_title}
        message={t.confirm_body + ' ' + t.confirm_contact}
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const tabs = [
    { id: 1, label: 'Your Unit' },
    { id: 2, label: 'Household' },
    { id: 3, label: 'Citizenship' },
    { id: 4, label: 'Review & Sign' },
  ];

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

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >

              {/* ── Tab 1: Your Unit ─────────────────────────────────────── */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader title="Your Unit" sectionNumber={1} totalSections={4} />

                  <FormField label={t.building_label} required error={errors['building']}>
                    <select
                      value={form.building}
                      onChange={e => { setField('building', e.target.value); setField('unit', ''); }}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                    >
                      <option value="">— Select building —</option>
                      {buildings.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </FormField>

                  <FormField label={t.unit_label} required error={errors['unit']}>
                    {knownUnits ? (
                      <select
                        value={form.unit}
                        onChange={e => setField('unit', e.target.value)}
                        disabled={!form.building}
                        className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white disabled:bg-[var(--bg-section)] disabled:text-[var(--muted)] mt-1"
                      >
                        <option value="">— Select unit —</option>
                        {knownUnits.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.unit}
                        onChange={e => setField('unit', e.target.value)}
                        placeholder="Enter unit number"
                        disabled={!form.building}
                        className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white disabled:bg-[var(--bg-section)] mt-1"
                      />
                    )}
                  </FormField>

                  <FormButton type="button" onClick={() => { if (validateSection(1)) nextSection(); }} fullWidth>
                    Continue
                  </FormButton>
                </FormSection>
              )}

              {/* ── Tab 2: Household ─────────────────────────────────────── */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader title={t.section1_title} sectionNumber={2} totalSections={4} />

                  <FormField label={t.hoh_name_label} required error={errors['hohName']}>
                    <input
                      type="text"
                      value={form.hohName}
                      onChange={e => updateHoH({ hohName: e.target.value })}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                      autoComplete="name"
                    />
                  </FormField>

                  <FormField label={t.hoh_dob_label} required error={errors['hohDob']}>
                    <input
                      type="date"
                      value={form.hohDob}
                      max={today}
                      onChange={e => updateHoH({ hohDob: e.target.value })}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
                    />
                  </FormField>

                  <FormField label={t.member_income_label} required>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
                      <input
                        type="number"
                        min="0"
                        value={form.members[0]?.annual_income || ''}
                        onChange={e => updateMember(0, { annual_income: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full pl-7 pr-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
                        placeholder="0"
                      />
                    </div>
                  </FormField>

                  <div>
                    <span className="text-sm font-medium text-[var(--ink)]">{t.member_income_sources_label}</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {INCOME_SRCS.map(src => (
                        <label key={src} className="flex items-center gap-2 cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={form.members[0]?.income_sources.includes(src) ?? false}
                            onChange={() => toggleSource(0, src)}
                            className="w-4 h-4 rounded-none"
                          />
                          <span className="text-sm text-[var(--ink)]">{(t as any)[`src_${src}`]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Additional members */}
                  <div className="pt-2">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3 border-t border-[var(--divider)] pt-4">
                      {t.section2_title}
                    </h4>

                    {form.members.slice(1).map((member, i) => (
                      <MemberCard
                        key={i + 1}
                        index={i + 1}
                        member={member}
                        t={t}
                        errors={errors}
                        onUpdate={patch => updateMember(i + 1, patch)}
                        onRemove={() => removeMember(i + 1)}
                        onToggleSource={src => toggleSource(i + 1, src)}
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

                    <div className="mt-3 bg-[var(--bg-section)] border border-[var(--divider)] px-4 py-3">
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {t.income_total_display(fmtCurrency(totalIncome))}
                      </p>
                    </div>
                  </div>

                  <FormButton type="button" onClick={() => { if (validateSection(2)) nextSection(); }} fullWidth>
                    Continue
                  </FormButton>
                </FormSection>
              )}

              {/* ── Tab 3: Citizenship ───────────────────────────────────── */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader title={t.section3_title} sectionNumber={3} totalSections={4} />

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
                            onChange={() => setField('citizenshipAnswer', 'yes')}
                            className="w-5 h-5 flex-shrink-0"
                          />
                          <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_yes}</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                          <input
                            type="radio"
                            name="citizenship"
                            checked={form.citizenshipAnswer === 'no'}
                            onChange={() => setField('citizenshipAnswer', 'no')}
                            className="w-5 h-5 flex-shrink-0"
                          />
                          <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_no}</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-3 border border-[var(--border)] hover:border-[var(--primary)] transition-colors">
                          <input
                            type="radio"
                            name="citizenship"
                            checked={form.citizenshipAnswer === 'unsure'}
                            onChange={() => setField('citizenshipAnswer', 'unsure')}
                            className="w-5 h-5 flex-shrink-0"
                          />
                          <span className="text-sm font-medium text-[var(--ink)]">{t.citizenship_unsure}</span>
                        </label>
                      </div>
                      {errors['citizenship'] && <p className="text-xs text-[var(--error)] mt-2">{errors['citizenship']}</p>}
                    </div>
                  </div>

                  <FormButton type="button" onClick={() => { if (validateSection(3)) nextSection(); }} fullWidth>
                    Continue
                  </FormButton>
                </FormSection>
              )}

              {/* ── Tab 4: Review & Sign ─────────────────────────────────── */}
              {currentSection === 4 && (
                <FormSection>
                  <SectionHeader title={t.section4_title} sectionNumber={4} totalSections={4} />

                  {/* Summary */}
                  <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4 text-sm">
                    <div className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5">
                      <span className="text-[var(--muted)]">Building</span>
                      <span className="font-medium text-[var(--ink)]">{form.building}</span>
                      <span className="text-[var(--muted)]">Unit</span>
                      <span className="font-medium text-[var(--ink)]">{form.unit}</span>
                      <span className="text-[var(--muted)]">{t.hoh_name_label}</span>
                      <span className="font-medium text-[var(--ink)]">{form.hohName}</span>
                      <span className="text-[var(--muted)]">Household Size</span>
                      <span className="font-medium text-[var(--ink)]">{form.members.length}</span>
                      <span className="text-[var(--muted)]">Total Income</span>
                      <span className="font-medium text-[var(--ink)]">{fmtCurrency(totalIncome)}/yr</span>
                    </div>
                  </div>

                  {/* Consent */}
                  <div className="border border-[var(--divider)] bg-[var(--bg-section)] px-4 py-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.consentChecked}
                        onChange={e => setField('consentChecked', e.target.checked)}
                        className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-none"
                      />
                      <span className="text-sm text-[var(--ink)] leading-relaxed">{CONSENT_TEXT}</span>
                    </label>
                  </div>

                  {/* Certification */}
                  <FormCheckbox
                    label={t.cert_checkbox_label}
                    checked={form.certChecked}
                    onChange={e => setField('certChecked', e.target.checked)}
                    required
                  />

                  {/* Signature */}
                  <div>
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {t.signature_label} <span className="text-[var(--error)]">*</span>
                    </span>
                    <div className="border border-[var(--border)] bg-white mt-1">
                      <SignatureCanvas
                        ref={sigRef}
                        canvasProps={{
                          className: 'w-full',
                          style: { width: '100%', height: '140px', touchAction: 'none' },
                        }}
                        backgroundColor="white"
                        onEnd={() => {
                          if (sigRef.current && !sigRef.current.isEmpty()) {
                            setSignature(sigRef.current.toDataURL('image/png'));
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { sigRef.current?.clear(); setSignature(''); }}
                      className="mt-1 text-xs text-[var(--muted)] hover:text-[var(--ink)] underline transition-colors"
                    >
                      {t.clear_signature}
                    </button>
                  </div>

                  {/* Date */}
                  <div>
                    <span className="text-sm font-medium text-[var(--ink)]">{t.date_label}</span>
                    <div className="mt-1 px-3 py-3 border border-[var(--border)] text-sm bg-[var(--bg-section)] text-[var(--muted)]">
                      {today}
                    </div>
                  </div>

                  {submitError && (
                    <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
                  )}

                  <FormButton
                    type="submit"
                    variant="success"
                    fullWidth
                    loading={submitting}
                    disabled={!form.consentChecked || !form.certChecked || !signature || submitting}
                  >
                    {submitting ? t.submitting : t.submit_btn}
                  </FormButton>
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

// ── Member card ───────────────────────────────────────────────────────────────

interface MemberCardProps {
  index: number;
  member: HouseholdMember;
  t: PbvFormStrings;
  errors: Partial<Record<string, string>>;
  onUpdate: (patch: Partial<HouseholdMember>) => void;
  onRemove: () => void;
  onToggleSource: (src: string) => void;
  today: string;
}

function MemberCard({ index, member, t, errors, onUpdate, onRemove, onToggleSource, today }: MemberCardProps) {
  return (
    <div className="border border-[var(--border)] bg-white mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-section)] border-b border-[var(--divider)]">
        <span className="text-sm font-medium text-[var(--ink)]">
          Household Member {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-[var(--muted)] hover:text-[var(--error)] underline transition-colors"
        >
          {t.remove_member_btn}
        </button>
      </div>
      <div className="p-4 space-y-4">
        <FormField label={t.member_name_label} required error={errors[`m${index}name`]}>
          <input
            type="text"
            value={member.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
          />
        </FormField>
        <FormField label={t.member_dob_label} required error={errors[`m${index}dob`]}>
          <input
            type="date"
            value={member.dob}
            max={today}
            onChange={e => onUpdate({ dob: e.target.value })}
            className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
          />
        </FormField>
        <FormField label={t.member_relationship_label} required error={errors[`m${index}rel`]}>
          <select
            value={member.relationship}
            onChange={e => onUpdate({ relationship: e.target.value })}
            className="w-full px-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white mt-1"
          >
            <option value="">—</option>
            {EXTRA_RELATIONSHIPS.map(r => (
              <option key={r} value={r}>{(t as any)[`rel_${r}`]}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t.member_income_label} required>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
            <input
              type="number"
              min="0"
              value={member.annual_income || ''}
              onChange={e => onUpdate({ annual_income: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full pl-7 pr-3 py-3 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
              placeholder="0"
            />
          </div>
        </FormField>
        <div>
          <span className="text-sm font-medium text-[var(--ink)]">{t.member_income_sources_label}</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {INCOME_SRCS.map(src => (
              <label key={src} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={member.income_sources.includes(src)}
                  onChange={() => onToggleSource(src)}
                  className="w-4 h-4 rounded-none"
                />
                <span className="text-sm text-[var(--ink)]">{(t as any)[`src_${src}`]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function PbvPreappPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <PbvPreappContent />
    </Suspense>
  );
}
