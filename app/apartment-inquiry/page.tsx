'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Language } from '@/lib/translations';
import { apartmentInquiryTranslations } from '@/lib/apartmentInquiryTranslations';
import {
  FormField,
  FormInput,
  FormSelect,
  FormRadioGroup,
  FormCheckbox,
  FormButton,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
  FormTextarea,
  FormPhoneInput,
  FormDocumentUpload,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { validatePhone, validateEmail } from '@/lib/formUtils';
import { useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

interface ApartmentInquiryFormData {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  bedrooms: string;
  moveInTimeframe: string;
  voucher: string;
  voucherBedroomSize: string;
  voucherHousingAuthority: string;
  areasOfInterest: string[];
  householdIncome: string;
  numberOfOccupants: string;
  additionalOccupants: string;
  referralSource: string;
  referralOther: string;
  comments: string;
}

const initialFormData: ApartmentInquiryFormData = {
  fullName: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  bedrooms: '',
  moveInTimeframe: '',
  voucher: '',
  voucherBedroomSize: '',
  voucherHousingAuthority: '',
  areasOfInterest: [],
  householdIncome: '',
  numberOfOccupants: '',
  additionalOccupants: '',
  referralSource: '',
  referralOther: '',
  comments: '',
};

const AREA_KEYS = [
  'areaNorthEnd',
  'areaSouthEnd',
  'areaWestEnd',
  'areaParkStreet',
  'areaNoPreference',
] as const;

const AREA_VALUES = [
  'North End',
  'South End',
  'West End',
  'Park Street Corridor',
  'No Preference',
];

const INCOME_KEYS = [
  'incomeUnder1500',
  'income1500to2500',
  'income2500to3500',
  'income3500to5000',
  'income5000to7500',
  'income7500plus',
] as const;

const INCOME_VALUES = [
  'under_1500',
  '1500_2500',
  '2500_3500',
  '3500_5000',
  '5000_7500',
  '7500_plus',
];

function ApartmentInquiryFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';

  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [incomeDocuments, setIncomeDocuments] = useState<File[]>([]);

  const t = apartmentInquiryTranslations[language];

  const { formData, updateField } = useFormData(initialFormData);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<ApartmentInquiryFormData>();

  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const fd = new FormData();
    fd.append('formData', JSON.stringify({ ...data, language }));
    incomeDocuments.forEach((f) => fd.append('incomeDocuments', f));

    const response = await fetch('/api/forms/apartment-inquiry', {
      method: 'POST',
      body: fd,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });

  const handleAreaToggle = (area: string) => {
    const current = formData.areasOfInterest;
    if (current.includes(area)) {
      updateField('areasOfInterest', current.filter((a) => a !== area));
    } else {
      updateField('areasOfInterest', [...current, area]);
    }
  };

  const validateForm = () => {
    clearAllErrors();
    let isValid = true;

    if (!formData.fullName.trim()) {
      setFieldError('fullName', t.required);
      isValid = false;
    }
    if (!validatePhone(formData.phone)) {
      setFieldError('phone', t.phoneValidationError);
      isValid = false;
    }
    if (formData.email.trim() && !validateEmail(formData.email)) {
      setFieldError('email', t.emailValidationError);
      isValid = false;
    }
    if (!formData.bedrooms) {
      setFieldError('bedrooms', t.required);
      isValid = false;
    }
    if (!formData.moveInTimeframe) {
      setFieldError('moveInTimeframe', t.required);
      isValid = false;
    }
    if (!formData.voucher) {
      setFieldError('voucher', t.required);
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await submit(formData);
  };

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

  if (!showForm) {
    return (
      <LanguageLanding
        title={t.formTitle}
        description={t.formIntro}
        onSelect={(lang) => {
          setLanguage(lang);
          setShowForm(true);
        }}
      />
    );
  }

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="border-b border-[var(--divider)] bg-[var(--bg-section)] px-6 py-5">
            <h1 className="font-serif text-xl text-[var(--primary)]">{t.formTitle}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">{t.formIntro}</p>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* --- About You --- */}
            <FormField label={t.fullName} required error={errors.fullName}>
              <FormInput
                value={formData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder={t.fullNamePlaceholder}
                error={!!errors.fullName}
              />
            </FormField>

            <FormField label={t.phone} required error={errors.phone}>
              <FormPhoneInput
                value={formData.phone}
                onChange={(value) => updateField('phone', value)}
                placeholder={t.phonePlaceholder}
                error={!!errors.phone}
              />
            </FormField>

            <FormField label={t.email} error={errors.email} helperText={t.optional}>
              <FormInput
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder={t.emailPlaceholder}
                error={!!errors.email}
              />
            </FormField>

            <FormField label={t.dateOfBirth} helperText={t.optional}>
              <FormInput
                type="text"
                value={formData.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
                placeholder={t.dateOfBirthPlaceholder}
              />
            </FormField>

            {/* --- What Are You Looking For? --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-4">{t.housingNeedsTitle}</h2>
            </div>

            <FormField label={t.bedrooms} required error={errors.bedrooms}>
              <FormSelect
                value={formData.bedrooms}
                onChange={(e) => updateField('bedrooms', e.target.value)}
                error={!!errors.bedrooms}
              >
                <option value="">{t.bedroomsPlaceholder}</option>
                <option value="studio">{t.bedroomsStudio}</option>
                <option value="1br">{t.bedrooms1}</option>
                <option value="2br">{t.bedrooms2}</option>
                <option value="3br">{t.bedrooms3}</option>
                <option value="4br">{t.bedrooms4}</option>
              </FormSelect>
            </FormField>

            <FormField label={t.moveInTimeframe} required error={errors.moveInTimeframe}>
              <FormSelect
                value={formData.moveInTimeframe}
                onChange={(e) => updateField('moveInTimeframe', e.target.value)}
                error={!!errors.moveInTimeframe}
              >
                <option value="">{t.moveInPlaceholder}</option>
                <option value="asap">{t.moveInASAP}</option>
                <option value="1_2_months">{t.moveIn1to2}</option>
                <option value="3_6_months">{t.moveIn3to6}</option>
                <option value="just_looking">{t.moveInJustLooking}</option>
              </FormSelect>
            </FormField>

            {/* --- Housing Voucher --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Housing Voucher</h2>
            </div>

            <FormField label={t.voucher} required error={errors.voucher}>
              <FormRadioGroup
                name="voucher"
                value={formData.voucher}
                onChange={(value) => updateField('voucher', value)}
                options={[
                  { value: 'yes', label: t.voucherYes },
                  { value: 'no', label: t.voucherNo },
                  { value: 'not_sure', label: t.voucherNotSure },
                ]}
                direction="horizontal"
              />
            </FormField>

            {formData.voucher === 'yes' && (
              <>
                <FormField label={t.voucherBedroomSize} helperText={t.optional}>
                  <FormInput
                    value={formData.voucherBedroomSize}
                    onChange={(e) => updateField('voucherBedroomSize', e.target.value)}
                    placeholder={t.voucherBedroomSizePlaceholder}
                  />
                </FormField>

                <FormField label={t.voucherHousingAuthority} helperText={t.optional}>
                  <FormInput
                    value={formData.voucherHousingAuthority}
                    onChange={(e) => updateField('voucherHousingAuthority', e.target.value)}
                    placeholder={t.voucherHousingAuthorityPlaceholder}
                  />
                </FormField>
              </>
            )}

            {/* --- Household Income --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-4">{t.householdIncomeTitle}</h2>
            </div>

            <FormField label={t.householdIncomeLabel} helperText={t.optional}>
              <div className="space-y-2">
                {INCOME_KEYS.map((key, idx) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="householdIncome"
                      value={INCOME_VALUES[idx]}
                      checked={formData.householdIncome === INCOME_VALUES[idx]}
                      onChange={() => updateField('householdIncome', INCOME_VALUES[idx])}
                      className="accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--ink)]">{t[key]}</span>
                  </label>
                ))}
              </div>
            </FormField>

            <FormDocumentUpload
              label={t.incomeUploadLabel}
              helperText={t.incomeUploadHelper}
              maxFiles={5}
              maxSize={10 * 1024 * 1024}
              acceptedTypes={['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic']}
              documents={incomeDocuments}
              onDocumentsChange={setIncomeDocuments}
              errorMessages={{
                maxFiles: 'Maximum 5 files',
                fileSize: 'File must be under 10MB',
                fileType: 'PDF, JPG, PNG, or HEIC only',
              }}
            />

            {/* --- Occupants --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-4">{t.occupantsTitle}</h2>
            </div>

            <FormField label={t.numberOfOccupants} helperText={t.optional}>
              <FormInput
                type="number"
                min="1"
                max="20"
                value={formData.numberOfOccupants}
                onChange={(e) => updateField('numberOfOccupants', e.target.value)}
                placeholder={t.numberOfOccupantsPlaceholder}
              />
            </FormField>

            <FormField label={t.additionalOccupants} helperText={t.optional}>
              <FormTextarea
                value={formData.additionalOccupants}
                onChange={(e) => updateField('additionalOccupants', e.target.value)}
                placeholder={t.additionalOccupantsPlaceholder}
                rows={3}
              />
            </FormField>

            {/* --- Areas of Interest --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-1">{t.areasTitle}</h2>
              <p className="text-sm text-[var(--muted)] mb-4">{t.areasDescription}</p>
              <div className="grid grid-cols-2 gap-3">
                {AREA_KEYS.map((key, idx) => (
                  <FormCheckbox
                    key={key}
                    label={t[key]}
                    checked={formData.areasOfInterest.includes(AREA_VALUES[idx])}
                    onChange={() => handleAreaToggle(AREA_VALUES[idx])}
                  />
                ))}
              </div>
            </div>

            {/* --- Referral --- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <FormField label={t.referralSource} required error={errors.referralSource}>
                <FormSelect
                  value={formData.referralSource}
                  onChange={(e) => updateField('referralSource', e.target.value)}
                  error={!!errors.referralSource}
                >
                  <option value="">{t.referralPlaceholder}</option>
                  <option value="vivian">{t.referralVivian}</option>
                  <option value="maribel">{t.referralMaribel}</option>
                  <option value="online_listing">{t.referralOnlineListing}</option>
                  <option value="appfolio">{t.referralAppFolio}</option>
                  <option value="walk_in">{t.referralWalkIn}</option>
                  <option value="other">{t.referralOther}</option>
                </FormSelect>
              </FormField>

              {formData.referralSource === 'other' && (
                <div className="mt-4">
                  <FormField label={t.referralOther} helperText={t.optional}>
                    <FormInput
                      value={formData.referralOther}
                      onChange={(e) => updateField('referralOther', e.target.value)}
                      placeholder={t.referralOtherPlaceholder}
                    />
                  </FormField>
                </div>
              )}
            </div>

            {/* --- Comments --- */}
            <FormField label={t.comments} helperText={t.optional}>
              <FormTextarea
                value={formData.comments}
                onChange={(e) => updateField('comments', e.target.value)}
                placeholder={t.commentsPlaceholder}
                rows={3}
              />
            </FormField>

            {/* Submit */}
            {submitError && (
              <div className="border border-[var(--error)] bg-red-50 p-3 text-sm text-[var(--error)]">
                {submitError}
              </div>
            )}

            <FormButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.submitting : t.submit}
            </FormButton>
          </div>
        </form>
      </FormLayout>
      <Footer />
    </>
  );
}

export default function ApartmentInquiryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
          <p className="text-[var(--muted)]">Loading...</p>
        </div>
      }
    >
      <ApartmentInquiryFormContent />
    </Suspense>
  );
}
