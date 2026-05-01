'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { Language } from '@/lib/translations';
import { rentalApplicationTranslations } from '@/lib/rentalApplicationTranslations';
import {
  FormField,
  FormInput,
  FormTextarea,
  FormCheckbox,
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
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

// -- Types ---------------------------------------------------------------------

interface Occupant {
  name: string;
  dob: string;
  relationship: string;
}

interface Pet {
  type: string;
  weight: string;
}

interface IncomeSource {
  employer: string;
  phone: string;
  title: string;
  duration: string;
}

interface RentalAppFormData {
  fullName: string;
  phone: string;
  email: string;
  dob: string;
  currentAddress: string;
  addressDuration: string;
  householdSize: string;
  occupants: Occupant[];
  incomeSources: IncomeSource[];
  monthlyIncomeRange: string;
  bedroomsNeeded: string;
  areasOfInterest: string[];
  desiredMoveIn: string;
  paymentType: 'market_rate' | 'section8' | '';
  hasPets: 'yes' | 'no' | '';
  pets: Pet[];
  currentLandlord: string;
  landlordPhone: string;
  reasonForMoving: string;
  marketRateAuth: boolean;
  housingAuthority: string;
  voucherBedSize: string;
  paymentStandard: string;
  voucherExpiration: string;
  caseworkerName: string;
  caseworkerPhone: string;
  caseworkerEmail: string;
  docsVoucherConfirm: boolean;
  docsMovingPacketConfirm: boolean;
  docsBankStatementConfirm: boolean;
  s8Auth: boolean;
  ssnOrTaxId: string;
  docsPhotoIdConfirm: boolean;
  docsSsnCardConfirm: boolean;
}

// -- Helpers -------------------------------------------------------------------

const blankIncome = (): IncomeSource => ({ employer: '', phone: '', title: '', duration: '' });
const blankOccupant = (): Occupant => ({ name: '', dob: '', relationship: '' });
const blankPet = (): Pet => ({ type: '', weight: '' });

const initialFormData: RentalAppFormData = {
  fullName: '',
  phone: '',
  email: '',
  dob: '',
  currentAddress: '',
  addressDuration: '',
  householdSize: '',
  occupants: [],
  incomeSources: [],
  monthlyIncomeRange: '',
  bedroomsNeeded: '',
  areasOfInterest: [],
  desiredMoveIn: '',
  paymentType: '',
  hasPets: '',
  pets: [],
  currentLandlord: '',
  landlordPhone: '',
  reasonForMoving: '',
  marketRateAuth: false,
  housingAuthority: '',
  voucherBedSize: '',
  paymentStandard: '',
  voucherExpiration: '',
  caseworkerName: '',
  caseworkerPhone: '',
  caseworkerEmail: '',
  docsVoucherConfirm: false,
  docsMovingPacketConfirm: false,
  docsBankStatementConfirm: false,
  s8Auth: false,
  ssnOrTaxId: '',
  docsPhotoIdConfirm: false,
  docsSsnCardConfirm: false,
};

const BEDROOM_OPTIONS = [
  { value: 'studio', labelKey: 'studio' as const },
  { value: '1br', labelKey: 'oneBed' as const },
  { value: '2br', labelKey: 'twoBed' as const },
  { value: '3br', labelKey: 'threeBed' as const },
  { value: '4br', labelKey: 'fourBed' as const },
];

const AREA_OPTIONS = [
  { value: 'north_end', labelKey: 'northEnd' as const },
  { value: 'south_end', labelKey: 'southEnd' as const },
  { value: 'west_end', labelKey: 'westEnd' as const },
  { value: 'park_street', labelKey: 'parkStreet' as const },
  { value: 'no_preference', labelKey: 'noPreference' as const },
];

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// -- Native file input ---------------------------------------------------------

function FileInput({
  label,
  helperText,
  file,
  onChange,
}: {
  label: string;
  helperText: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      if (!ACCEPTED_FILE_TYPES.includes(f.type)) {
        setError('Only PDF, JPG, or PNG files are accepted.');
        onChange(null);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError('File must be 10 MB or smaller.');
        onChange(null);
        return;
      }
    }
    setError('');
    onChange(f);
  };

  return (
    <div className="mt-2">
      <label className="block text-xs font-medium text-[var(--ink)] mb-1">{label}</label>
      <p className="text-xs text-[var(--muted)] mb-1">{helperText}</p>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        className="block w-full text-sm text-[var(--ink)] file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border file:border-[var(--border)] file:text-xs file:font-medium file:bg-[var(--bg-section)] file:text-[var(--ink)] hover:file:bg-[var(--primary)]/5 cursor-pointer"
      />
      {file && (
        <div className="flex items-center justify-between mt-1 px-2 py-1 bg-[var(--bg-section)] border border-[var(--border)] text-xs">
          <span className="text-[var(--ink)] truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 text-[var(--muted)] hover:text-red-600 flex-shrink-0"
          >
            &times;
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// -- Form Component -------------------------------------------------------------

function RentalApplicationContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';

  const [language, setLanguage] = useState<Language>(hasLangParam ? (langParam as Language) : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');

  // File state — not serialized in formData
  const [incomeProofFiles, setIncomeProofFiles] = useState<(File | null)[]>([]);
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({
    docsVoucher: null,
    docsMovingPacket: null,
    docsBankStatement: null,
    docsPhotoId: null,
    docsSsnCard: null,
  });

  const { currentSection, nextSection, previousSection, goToSection, completedSections } = useFormSection(3);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<RentalAppFormData & { signature: string }>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const fd = new FormData();
    fd.append('formData', JSON.stringify(data));
    fd.append('language', language);
    fd.append('signature', signature);
    incomeProofFiles.forEach((file, idx) => {
      if (file) fd.append(`incomeProof_${idx}`, file);
    });
    Object.entries(docFiles).forEach(([key, file]) => {
      if (file) fd.append(key, file);
    });

    const response = await fetch('/api/forms/rental-application', {
      method: 'POST',
      body: fd,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Submission failed');
    }
    return response.json();
  });

  const t = rentalApplicationTranslations[language];
  const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (!showForm) {
    return (
      <LanguageLanding
        title={t.formTitle}
        onSelect={(lang) => {
          setLanguage(lang);
          setShowForm(true);
        }}
      />
    );
  }

  if (submitSuccess) {
    return (
      <SuccessScreen
        title={t.successTitle}
        message={t.successMessage}
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  // -- Helpers --

  const toggleArea = (area: string) => {
    const curr = formData.areasOfInterest;
    updateField('areasOfInterest', curr.includes(area) ? curr.filter((a) => a !== area) : [...curr, area]);
  };

  const updateIncomeSource = (idx: number, key: keyof IncomeSource, value: string) => {
    const next = [...formData.incomeSources];
    next[idx] = { ...next[idx], [key]: value };
    updateField('incomeSources', next);
  };

  const addIncomeSource = () => {
    updateField('incomeSources', [...formData.incomeSources, blankIncome()]);
    setIncomeProofFiles((prev) => [...prev, null]);
  };

  const removeIncomeSource = (idx: number) => {
    updateField('incomeSources', formData.incomeSources.filter((_, i) => i !== idx));
    setIncomeProofFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOccupant = (idx: number, key: keyof Occupant, value: string) => {
    const next = [...formData.occupants];
    next[idx] = { ...next[idx], [key]: value };
    updateField('occupants', next);
  };

  const updatePet = (idx: number, key: keyof Pet, value: string) => {
    const next = [...formData.pets];
    next[idx] = { ...next[idx], [key]: value };
    updateField('pets', next);
  };

  const setDocFile = (key: string, file: File | null) => {
    setDocFiles((prev) => ({ ...prev, [key]: file }));
  };

  const validateTab1 = (): boolean => {
    clearAllErrors();
    let valid = true;
    if (!formData.fullName.trim()) { setFieldError('fullName', t.errFullName); valid = false; }
    if (!formData.phone.trim()) { setFieldError('phone', t.errPhone); valid = false; }
    if (!formData.householdSize) { setFieldError('householdSize', t.errHouseholdSize); valid = false; }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();
    if (!signature) {
      setFieldError('signature', t.errSignature);
      return;
    }
    await submit(formData);
  };

  const tabs = [
    { id: 1, label: t.tab1 },
    { id: 2, label: t.tab2 },
    { id: 3, label: t.tab3 },
  ];

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <TabNavigation tabs={tabs} activeTab={currentSection} onTabClick={goToSection} completedTabs={completedSections} />

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <h1 className="font-serif text-xl text-[var(--primary)] mb-2">{t.formTitle}</h1>
              <p className="text-sm text-[var(--ink)] leading-relaxed">{t.formSubtitle}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* -- TAB 1: About You -- */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader title={t.sectionPersonal} sectionNumber={1} totalSections={3} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label={t.fullName} required error={errors.fullName}>
                      <FormInput
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder={t.fullNamePlaceholder}
                        error={!!errors.fullName}
                        required
                      />
                    </FormField>
                    <FormField label={t.phone} required error={errors.phone}>
                      <FormInput
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder={t.phonePlaceholder}
                        error={!!errors.phone}
                        required
                      />
                    </FormField>
                    <FormField label={t.email}>
                      <FormInput
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder={t.emailPlaceholder}
                      />
                    </FormField>
                    <FormField label={t.dob}>
                      <FormInput
                        type="date"
                        value={formData.dob}
                        onChange={(e) => updateField('dob', e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label={t.currentAddress}>
                    <FormInput
                      type="text"
                      value={formData.currentAddress}
                      onChange={(e) => updateField('currentAddress', e.target.value)}
                      placeholder={t.currentAddressPlaceholder}
                    />
                  </FormField>

                  <FormField label={t.addressDuration}>
                    <FormInput
                      type="text"
                      value={formData.addressDuration}
                      onChange={(e) => updateField('addressDuration', e.target.value)}
                      placeholder={t.addressDurationPlaceholder}
                    />
                  </FormField>

                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <SectionHeader title={t.sectionHousehold} sectionNumber={2} totalSections={3} />

                    <FormField label={t.householdSize} required error={errors.householdSize}>
                      <FormInput
                        type="number"
                        min="1"
                        max="20"
                        value={formData.householdSize}
                        onChange={(e) => updateField('householdSize', e.target.value)}
                        error={!!errors.householdSize}
                        className="w-32"
                      />
                    </FormField>

                    <div className="mt-4">
                      <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-3">{t.occupantsTitle}</p>
                      {formData.occupants.map((occ, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                          <FormField label={t.occupantName}>
                            <FormInput type="text" value={occ.name} onChange={(e) => updateOccupant(idx, 'name', e.target.value)} />
                          </FormField>
                          <FormField label={t.occupantDob}>
                            <FormInput type="date" value={occ.dob} onChange={(e) => updateOccupant(idx, 'dob', e.target.value)} />
                          </FormField>
                          <FormField label={t.occupantRelationship}>
                            <div className="flex gap-2">
                              <FormInput type="text" value={occ.relationship} onChange={(e) => updateOccupant(idx, 'relationship', e.target.value)} />
                              <button
                                type="button"
                                onClick={() => updateField('occupants', formData.occupants.filter((_, i) => i !== idx))}
                                className="text-[var(--muted)] hover:text-red-600 text-lg leading-none px-1 flex-shrink-0 transition-colors"
                              >
                                &times;
                              </button>
                            </div>
                          </FormField>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateField('occupants', [...formData.occupants, blankOccupant()])}
                        className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors"
                      >
                        + {t.addOccupant}
                      </button>
                    </div>
                  </div>

                  <FormButton
                    type="button"
                    onClick={() => { if (validateTab1()) nextSection(); }}
                    fullWidth
                  >
                    {t.next}
                  </FormButton>
                </FormSection>
              )}

              {/* -- TAB 2: Income & Needs -- */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader title={t.sectionIncome} sectionNumber={2} totalSections={3} />

                  {formData.incomeSources.map((src, idx) => (
                    <div key={idx} className="border border-[var(--border)] p-4 bg-[var(--bg-section)] mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest">
                          {t.incomeSourceLabel(idx + 1)}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeIncomeSource(idx)}
                          className="text-xs text-[var(--muted)] hover:text-red-600 transition-colors"
                        >
                          {t.removeIncomeSource}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label={t.employerName}>
                          <FormInput type="text" value={src.employer} onChange={(e) => updateIncomeSource(idx, 'employer', e.target.value)} />
                        </FormField>
                        <FormField label={t.employerPhone}>
                          <FormInput type="tel" value={src.phone} onChange={(e) => updateIncomeSource(idx, 'phone', e.target.value)} />
                        </FormField>
                        <FormField label={t.jobTitle}>
                          <FormInput type="text" value={src.title} onChange={(e) => updateIncomeSource(idx, 'title', e.target.value)} />
                        </FormField>
                        <FormField label={t.howLong}>
                          <FormInput type="text" value={src.duration} onChange={(e) => updateIncomeSource(idx, 'duration', e.target.value)} />
                        </FormField>
                      </div>
                      <FileInput
                        label={t.uploadProofOfIncome}
                        helperText={t.uploadOptional}
                        file={incomeProofFiles[idx] ?? null}
                        onChange={(f) => setIncomeProofFiles((prev) => {
                          const next = [...prev];
                          next[idx] = f;
                          return next;
                        })}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addIncomeSource}
                    className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors mb-6"
                  >
                    {t.addIncomeSource}
                  </button>

                  <FormField label={t.monthlyIncome}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {[
                        { value: 'under_1500', label: t.incomeUnder1500 },
                        { value: '1500_2500', label: t.income1500to2500 },
                        { value: '2500_3500', label: t.income2500to3500 },
                        { value: '3500_5000', label: t.income3500to5000 },
                        { value: '5000_7500', label: t.income5000to7500 },
                        { value: '7500_plus', label: t.income7500plus },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 text-sm cursor-pointer p-2 border border-[var(--border)] hover:bg-[var(--bg-section)] transition-colors">
                          <input
                            type="radio"
                            name="monthlyIncomeRange"
                            value={value}
                            checked={formData.monthlyIncomeRange === value}
                            onChange={() => updateField('monthlyIncomeRange', value)}
                            className="accent-[var(--primary)] flex-shrink-0"
                          />
                          <span className="text-xs">{label}</span>
                        </label>
                      ))}
                    </div>
                  </FormField>

                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionNeeds}</p>

                    <FormField label={t.bedroomsNeeded}>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {BEDROOM_OPTIONS.map(({ value, labelKey }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateField('bedroomsNeeded', value)}
                            className={`px-4 py-2 text-sm border rounded-none transition-colors ${
                              formData.bedroomsNeeded === value
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                                : 'border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)]'
                            }`}
                          >
                            {t[labelKey]}
                          </button>
                        ))}
                      </div>
                    </FormField>

                    <FormField label={t.areasOfInterest}>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {AREA_OPTIONS.map(({ value, labelKey }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleArea(value)}
                            className={`px-3 py-1.5 text-sm border rounded-none transition-colors ${
                              formData.areasOfInterest.includes(value)
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                                : 'border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)]'
                            }`}
                          >
                            {t[labelKey]}
                          </button>
                        ))}
                      </div>
                    </FormField>

                    <FormField label={t.desiredMoveIn}>
                      <FormInput
                        type="date"
                        value={formData.desiredMoveIn}
                        onChange={(e) => updateField('desiredMoveIn', e.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionPayment}</p>
                    <FormField label={t.paymentType}>
                      <div className="space-y-2">
                        {[
                          { value: 'market_rate', label: t.marketRate },
                          { value: 'section8', label: t.section8 },
                        ].map(({ value, label }) => (
                          <label key={value} className="flex items-center gap-3 text-sm cursor-pointer p-3 border border-[var(--border)] hover:bg-[var(--bg-section)] transition-colors">
                            <input
                              type="radio"
                              name="paymentType"
                              value={value}
                              checked={formData.paymentType === value}
                              onChange={() => updateField('paymentType', value as 'market_rate' | 'section8')}
                              className="accent-[var(--primary)]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </FormField>
                  </div>

                  <div className="flex justify-between mt-6">
                    <FormButton type="button" variant="secondary" onClick={previousSection}>{t.previous}</FormButton>
                    <FormButton type="button" onClick={nextSection}>{t.next}</FormButton>
                  </div>
                </FormSection>
              )}

              {/* -- TAB 3: Details & Sign -- */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader title={t.sectionPets} sectionNumber={3} totalSections={3} />

                  <FormField label={t.hasPets}>
                    <div className="flex gap-6">
                      {(['yes', 'no'] as const).map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="hasPets"
                            value={v}
                            checked={formData.hasPets === v}
                            onChange={() => updateField('hasPets', v)}
                            className="accent-[var(--primary)]"
                          />
                          {v === 'yes' ? t.yes : t.no}
                        </label>
                      ))}
                    </div>
                  </FormField>

                  {formData.hasPets === 'yes' && (
                    <div className="mt-3">
                      {formData.pets.map((pet, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-3 mb-3 p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                          <FormField label={t.petType}>
                            <FormInput type="text" value={pet.type} onChange={(e) => updatePet(idx, 'type', e.target.value)} placeholder="Dog / Cat / Other" />
                          </FormField>
                          <FormField label={t.petWeight}>
                            <div className="flex gap-2">
                              <FormInput type="text" value={pet.weight} onChange={(e) => updatePet(idx, 'weight', e.target.value)} placeholder="e.g. 25 lbs" />
                              <button
                                type="button"
                                onClick={() => updateField('pets', formData.pets.filter((_, i) => i !== idx))}
                                className="text-[var(--muted)] hover:text-red-600 text-lg leading-none px-1 flex-shrink-0 transition-colors"
                              >
                                &times;
                              </button>
                            </div>
                          </FormField>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateField('pets', [...formData.pets, blankPet()])}
                        className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors"
                      >
                        + {t.addPet}
                      </button>
                    </div>
                  )}

                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionRentalHistory}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label={t.currentLandlord}>
                        <FormInput type="text" value={formData.currentLandlord} onChange={(e) => updateField('currentLandlord', e.target.value)} />
                      </FormField>
                      <FormField label={t.landlordPhone}>
                        <FormInput type="tel" value={formData.landlordPhone} onChange={(e) => updateField('landlordPhone', e.target.value)} />
                      </FormField>
                    </div>
                    <FormField label={t.reasonForMoving}>
                      <FormTextarea
                        value={formData.reasonForMoving}
                        onChange={(e) => updateField('reasonForMoving', e.target.value)}
                        placeholder={t.reasonPlaceholder}
                        rows={3}
                      />
                    </FormField>
                  </div>

                  {/* Market rate authorization */}
                  {formData.paymentType === 'market_rate' && (
                    <div className="border-t border-[var(--border)] pt-6 mt-6">
                      <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionMarketRate}</p>
                      <FormCheckbox
                        label={t.marketRateAuth}
                        checked={formData.marketRateAuth}
                        onChange={(e) => updateField('marketRateAuth', e.target.checked)}
                      />
                    </div>
                  )}

                  {/* Section 8 details */}
                  {formData.paymentType === 'section8' && (
                    <div className="border-t border-[var(--border)] pt-6 mt-6">
                      <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionSection8}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label={t.housingAuthority}>
                          <FormInput type="text" value={formData.housingAuthority} onChange={(e) => updateField('housingAuthority', e.target.value)} />
                        </FormField>
                        <FormField label={t.voucherBedSize}>
                          <FormInput type="text" value={formData.voucherBedSize} onChange={(e) => updateField('voucherBedSize', e.target.value)} placeholder="e.g. 2 BR" />
                        </FormField>
                        <FormField label={t.paymentStandard}>
                          <FormInput type="text" value={formData.paymentStandard} onChange={(e) => updateField('paymentStandard', e.target.value)} placeholder="e.g. $1,400" />
                        </FormField>
                        <FormField label={t.voucherExpiration}>
                          <FormInput type="date" value={formData.voucherExpiration} onChange={(e) => updateField('voucherExpiration', e.target.value)} />
                        </FormField>
                        <FormField label={t.caseworkerName}>
                          <FormInput type="text" value={formData.caseworkerName} onChange={(e) => updateField('caseworkerName', e.target.value)} />
                        </FormField>
                        <FormField label={t.caseworkerPhone}>
                          <FormInput type="tel" value={formData.caseworkerPhone} onChange={(e) => updateField('caseworkerPhone', e.target.value)} />
                        </FormField>
                        <FormField label={t.caseworkerEmail}>
                          <FormInput type="email" value={formData.caseworkerEmail} onChange={(e) => updateField('caseworkerEmail', e.target.value)} />
                        </FormField>
                      </div>
                      <div className="mt-5 space-y-4">
                        <div className="p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                          <FileInput
                            label={t.docsVoucher}
                            helperText={t.uploadOptional}
                            file={docFiles.docsVoucher}
                            onChange={(f) => setDocFile('docsVoucher', f)}
                          />
                          <div className="mt-2">
                            <FormCheckbox
                              label="I confirm I have this document"
                              checked={formData.docsVoucherConfirm}
                              onChange={(e) => updateField('docsVoucherConfirm', e.target.checked)}
                            />
                          </div>
                        </div>
                        <div className="p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                          <FileInput
                            label={t.docsMovingPacket}
                            helperText={t.uploadOptional}
                            file={docFiles.docsMovingPacket}
                            onChange={(f) => setDocFile('docsMovingPacket', f)}
                          />
                          <div className="mt-2">
                            <FormCheckbox
                              label="I confirm I have this document"
                              checked={formData.docsMovingPacketConfirm}
                              onChange={(e) => updateField('docsMovingPacketConfirm', e.target.checked)}
                            />
                          </div>
                        </div>
                        <div className="p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                          <FileInput
                            label={t.docsBankStatement}
                            helperText={t.uploadOptional}
                            file={docFiles.docsBankStatement}
                            onChange={(f) => setDocFile('docsBankStatement', f)}
                          />
                          <div className="mt-2">
                            <FormCheckbox
                              label="I confirm I have this document"
                              checked={formData.docsBankStatementConfirm}
                              onChange={(e) => updateField('docsBankStatementConfirm', e.target.checked)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <FormCheckbox label={t.s8Auth} checked={formData.s8Auth} onChange={(e) => updateField('s8Auth', e.target.checked)} />
                      </div>
                    </div>
                  )}

                  {/* Additional info */}
                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-1">{t.sectionAdditional}</p>
                    <p className="text-xs text-[var(--muted)] mb-4">Not required — helps speed up processing</p>
                    <FormField label={t.ssnOrTaxId}>
                      <FormInput
                        type="text"
                        value={formData.ssnOrTaxId}
                        onChange={(e) => updateField('ssnOrTaxId', e.target.value)}
                        placeholder="XXX-XX-XXXX"
                      />
                    </FormField>
                    <div className="mt-4 space-y-4">
                      <div className="p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                        <FileInput
                          label={t.docsPhotoId}
                          helperText={t.uploadOptional}
                          file={docFiles.docsPhotoId}
                          onChange={(f) => setDocFile('docsPhotoId', f)}
                        />
                        <div className="mt-2">
                          <FormCheckbox
                            label="I confirm I have this document"
                            checked={formData.docsPhotoIdConfirm}
                            onChange={(e) => updateField('docsPhotoIdConfirm', e.target.checked)}
                          />
                        </div>
                      </div>
                      <div className="p-3 border border-[var(--border)] bg-[var(--bg-section)]">
                        <FileInput
                          label={t.docsSsnCard}
                          helperText={t.uploadOptional}
                          file={docFiles.docsSsnCard}
                          onChange={(f) => setDocFile('docsSsnCard', f)}
                        />
                        <div className="mt-2">
                          <FormCheckbox
                            label="I confirm I have this document"
                            checked={formData.docsSsnCardConfirm}
                            onChange={(e) => updateField('docsSsnCardConfirm', e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signature */}
                  <div className="border-t border-[var(--border)] pt-6 mt-6">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase tracking-widest mb-4">{t.sectionSignature}</p>
                    <p className="text-sm text-[var(--ink)] mb-4 italic">{t.certLabel}</p>
                    <FormField label={t.signatureLabel} error={errors.signature}>
                      <SignatureCanvasComponent
                        label={t.signatureLabel}
                        value={signature}
                        onSave={setSignature}
                      />
                    </FormField>
                    <div className="mt-3">
                      <span className="text-xs font-medium text-[var(--ink)]">{t.signatureDate}: </span>
                      <span className="text-sm text-[var(--ink)]">{todayStr}</span>
                    </div>
                  </div>

                  {submitError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <FormButton type="button" variant="secondary" onClick={previousSection}>{t.previous}</FormButton>
                    <FormButton type="submit" variant="success" loading={isSubmitting}>
                      {isSubmitting ? t.submitting : t.submit}
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

export default function RentalApplicationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <RentalApplicationContent />
    </Suspense>
  );
}
