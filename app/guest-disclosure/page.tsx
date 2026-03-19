'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { guestDisclosureTranslations } from '@/lib/guestDisclosureTranslations';
import {
  FormField,
  FormInput,
  FormSelect,
  FormCheckbox,
  FormButton,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
  FormTextarea,
  PrintableForm,
} from '@/components/form';
import { getFormById } from '@/lib/formsData';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { validateEmail, validatePhone, sanitizePhone } from '@/lib/formUtils';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

interface GuestDisclosureFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  guestName: string;
  relationship: string;
  arrivalDate: string;
  departureDate: string;
  lengthOfStay: string;
  reason: string;
  finalConfirm: boolean;
}

const initialFormData: GuestDisclosureFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  guestName: '',
  relationship: '',
  arrivalDate: '',
  departureDate: '',
  lengthOfStay: '',
  reason: '',
  finalConfirm: false,
};

function GuestDisclosureFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [showPrintable, setShowPrintable] = useState(false);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(3);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<GuestDisclosureFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    const response = await fetch('/api/forms/guest-disclosure', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = guestDisclosureTranslations[language];
  
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
  
  const validateSection = (section: number): boolean => {
    clearAllErrors();
    
    if (section === 1) {
      let isValid = true;
      
      if (!formData.tenantName.trim()) {
        setFieldError('tenantName', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.buildingAddress) {
        setFieldError('buildingAddress', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.unitNumber.trim()) {
        setFieldError('unitNumber', t.requiredFieldsMissing);
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
      
      return isValid;
    }
    
    if (section === 2) {
      let isValid = true;
      
      if (!formData.guestName.trim()) {
        setFieldError('guestName', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.relationship.trim()) {
        setFieldError('relationship', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.arrivalDate) {
        setFieldError('arrivalDate', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.departureDate) {
        setFieldError('departureDate', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.lengthOfStay.trim()) {
        setFieldError('lengthOfStay', t.requiredFieldsMissing);
        isValid = false;
      }
      
      return isValid;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signature) {
      return;
    }
    
    if (!formData.finalConfirm) {
      return;
    }
    
    await submit(formData);
  };
  
  const tabs = [
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabGuestInfo },
    { id: 3, label: t.tabReview },
  ];
  
  const formTemplate = getFormById(13); // Extended Guest Disclosure
  
  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      
      {showPrintable && formTemplate?.content && (
        <PrintableForm
          content={formTemplate.content}
          formTitle={formTemplate.title}
          formId={formTemplate.id}
          onClose={() => setShowPrintable(false)}
          showPrintButton
        />
      )}
      
      <FormLayout title={t.formTitle}>
        <TabNavigation
          tabs={tabs}
          activeTab={currentSection}
          onTabClick={goToSection}
        />
        
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="font-serif text-xl text-[var(--primary)] mb-2">{t.formTitle}</h1>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.formIntro}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintable(true)}
                  className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Blank
                </button>
              </div>
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
              {/* Section 1: Tenant Info */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader
                    title={t.tenantInfoTitle}
                    sectionNumber={1}
                    totalSections={3}
                  />
                  
                  <FormField label={t.tenantName} required error={errors.tenantName}>
                    <FormInput
                      type="text"
                      value={formData.tenantName}
                      onChange={(e) => updateField('tenantName', e.target.value)}
                      placeholder={t.tenantNamePlaceholder}
                      error={!!errors.tenantName}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.phone} required error={errors.phone}>
                    <FormInput
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', sanitizePhone(e.target.value))}
                      placeholder={t.phonePlaceholder}
                      maxLength={10}
                      error={!!errors.phone}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.email} error={errors.email}>
                    <FormInput
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder={t.emailPlaceholder}
                      error={!!errors.email}
                    />
                  </FormField>
                  
                  <FormField label={t.building} required error={errors.buildingAddress}>
                    <BuildingAutocomplete
                      value={formData.buildingAddress}
                      onChange={(val) => {
                        updateField('buildingAddress', val);
                        updateField('unitNumber', '');
                      }}
                      buildings={buildings}
                      placeholder={t.selectBuilding}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.unit} required error={errors.unitNumber}>
                    {formData.buildingAddress && buildingUnits[formData.buildingAddress] ? (
                      <FormSelect
                        value={formData.unitNumber}
                        onChange={(e) => updateField('unitNumber', e.target.value)}
                        error={!!errors.unitNumber}
                        required
                      >
                        <option value="">{t.selectUnit}</option>
                        {buildingUnits[formData.buildingAddress].map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </FormSelect>
                    ) : (
                      <FormInput
                        type="text"
                        value={formData.unitNumber}
                        onChange={(e) => updateField('unitNumber', e.target.value)}
                        placeholder={t.enterUnit}
                        error={!!errors.unitNumber}
                        required
                      />
                    )}
                  </FormField>
                  
                  <FormField label={t.dateSubmitted}>
                    <FormInput
                      type="date"
                      value={formData.dateSubmitted}
                      onChange={(e) => updateField('dateSubmitted', e.target.value)}
                      readOnly
                    />
                  </FormField>
                  
                  <FormButton
                    type="button"
                    onClick={() => {
                      if (validateSection(1)) nextSection();
                    }}
                    fullWidth
                  >
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}
              
              {/* Section 2: Guest Info */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.guestInfoTitle}
                    sectionNumber={2}
                    totalSections={3}
                  />
                  
                  <FormField label={t.guestName} required error={errors.guestName}>
                    <FormInput
                      type="text"
                      value={formData.guestName}
                      onChange={(e) => updateField('guestName', e.target.value)}
                      placeholder={t.guestNamePlaceholder}
                      error={!!errors.guestName}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.relationship} required error={errors.relationship}>
                    <FormInput
                      type="text"
                      value={formData.relationship}
                      onChange={(e) => updateField('relationship', e.target.value)}
                      placeholder={t.relationshipPlaceholder}
                      error={!!errors.relationship}
                      required
                    />
                  </FormField>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label={t.arrivalDate} required error={errors.arrivalDate}>
                      <FormInput
                        type="date"
                        value={formData.arrivalDate}
                        onChange={(e) => updateField('arrivalDate', e.target.value)}
                        error={!!errors.arrivalDate}
                        required
                      />
                    </FormField>
                    
                    <FormField label={t.departureDate} required error={errors.departureDate}>
                      <FormInput
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => updateField('departureDate', e.target.value)}
                        error={!!errors.departureDate}
                        required
                      />
                    </FormField>
                  </div>
                  
                  <FormField label={t.lengthOfStay} required error={errors.lengthOfStay}>
                    <FormInput
                      type="text"
                      value={formData.lengthOfStay}
                      onChange={(e) => updateField('lengthOfStay', e.target.value)}
                      placeholder={t.lengthPlaceholder}
                      error={!!errors.lengthOfStay}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.reason}>
                    <FormTextarea
                      value={formData.reason}
                      onChange={(e) => updateField('reason', e.target.value)}
                      placeholder={t.reasonPlaceholder}
                      rows={3}
                    />
                  </FormField>
                  
                  <FormButton
                    type="button"
                    onClick={() => {
                      if (validateSection(2)) nextSection();
                    }}
                    fullWidth
                  >
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}
              
              {/* Section 3: Review & Sign */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader
                    title={t.reviewTitle}
                    sectionNumber={3}
                    totalSections={3}
                  />
                  
                  <p className="text-sm text-[var(--muted)] mb-6">{t.reviewSummary}</p>
                  
                  {/* Tenant Info Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewTenantInfo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-[var(--muted)]">{t.tenantName}:</div>
                      <div className="font-medium">{formData.tenantName}</div>
                      <div className="text-[var(--muted)]">{t.building}:</div>
                      <div className="font-medium">{formData.buildingAddress}</div>
                      <div className="text-[var(--muted)]">{t.unit}:</div>
                      <div className="font-medium">{formData.unitNumber}</div>
                      <div className="text-[var(--muted)]">{t.phone}:</div>
                      <div className="font-medium">{formData.phone}</div>
                      {formData.email && (
                        <>
                          <div className="text-[var(--muted)]">{t.email}:</div>
                          <div className="font-medium">{formData.email}</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Guest Info Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewGuestInfo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-[var(--muted)]">{t.guestName}:</div>
                      <div className="font-medium">{formData.guestName}</div>
                      <div className="text-[var(--muted)]">{t.relationship}:</div>
                      <div className="font-medium">{formData.relationship}</div>
                      <div className="text-[var(--muted)]">{t.arrivalDate}:</div>
                      <div className="font-medium">{formData.arrivalDate}</div>
                      <div className="text-[var(--muted)]">{t.departureDate}:</div>
                      <div className="font-medium">{formData.departureDate}</div>
                      <div className="text-[var(--muted)]">{t.lengthOfStay}:</div>
                      <div className="font-medium">{formData.lengthOfStay}</div>
                      {formData.reason && (
                        <>
                          <div className="text-[var(--muted)]">{t.reason}:</div>
                          <div className="font-medium">{formData.reason}</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Terms */}
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.termsTitle}</h4>
                    <p className="text-xs text-[var(--muted)] mb-3">{t.termsIntro}</p>
                    <ul className="text-xs text-[var(--ink)] space-y-2 list-disc list-inside">
                      <li>{t.term1}</li>
                      <li>{t.term2}</li>
                      <li>{t.term3}</li>
                      <li>{t.term4}</li>
                      <li>{t.term5}</li>
                    </ul>
                  </div>
                  
                  {/* Signature */}
                  <div className="space-y-2 mb-4">
                    <SignatureCanvasComponent
                      label={t.signature}
                      value={signature}
                      onSave={(dataUrl) => setSignature(dataUrl)}
                    />
                  </div>
                  
                  <FormField label={t.signatureDate}>
                    <FormInput
                      type="date"
                      value={formData.dateSubmitted}
                      readOnly
                    />
                  </FormField>
                  
                  <FormCheckbox
                    label={t.finalConfirm}
                    checked={formData.finalConfirm}
                    onChange={(e) => updateField('finalConfirm', e.target.checked)}
                    required
                  />
                  
                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}
                  
                  <FormButton
                    type="submit"
                    variant="success"
                    fullWidth
                    loading={isSubmitting}
                  >
                    {isSubmitting ? t.submitting : t.submit}
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

export default function GuestDisclosureForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <GuestDisclosureFormContent />
    </Suspense>
  );
}
