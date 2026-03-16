'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { billingDisputeTranslations } from '@/lib/billingDisputeTranslations';
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
  FormPhotoUpload,
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

interface BillingDisputeFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  disputeType: string;
  chargeAmount: string;
  chargeDate: string;
  invoiceNumber: string;
  description: string;
  requestedResolution: string;
  finalConfirm: boolean;
}

const initialFormData: BillingDisputeFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  disputeType: '',
  chargeAmount: '',
  chargeDate: '',
  invoiceNumber: '',
  description: '',
  requestedResolution: '',
  finalConfirm: false,
};

function BillingDisputeFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [showPrintable, setShowPrintable] = useState(false);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [evidence, setEvidence] = useState<File[]>([]);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<BillingDisputeFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    evidence.forEach((file, index) => {
      formDataToSend.append(`evidence_${index}`, file);
    });
    
    const response = await fetch('/api/forms/billing-dispute', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = billingDisputeTranslations[language];
  
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
      
      if (!formData.disputeType) {
        setFieldError('disputeType', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.chargeAmount.trim()) {
        setFieldError('chargeAmount', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.chargeDate) {
        setFieldError('chargeDate', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.description.trim()) {
        setFieldError('description', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.requestedResolution.trim()) {
        setFieldError('requestedResolution', t.requiredFieldsMissing);
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
    { id: 2, label: t.tabDisputeDetails },
    { id: 3, label: t.tabEvidence },
    { id: 4, label: t.tabReview },
  ];
  
  const formTemplate = getFormById(19); // Tenant Billing Dispute Form
  
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
      
      <FormLayout>
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
                    totalSections={4}
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
              
              {/* Section 2: Dispute Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.disputeDetailsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <FormField label={t.disputeType} required error={errors.disputeType}>
                    <FormSelect
                      value={formData.disputeType}
                      onChange={(e) => updateField('disputeType', e.target.value)}
                      error={!!errors.disputeType}
                      required
                    >
                      <option value="">{t.selectDisputeType}</option>
                      <option value="rent">{t.disputeTypeRent}</option>
                      <option value="late">{t.disputeTypeLate}</option>
                      <option value="maintenance">{t.disputeTypeMaintenance}</option>
                      <option value="damage">{t.disputeTypeDamage}</option>
                      <option value="deposit">{t.disputeTypeDeposit}</option>
                      <option value="utility">{t.disputeTypeUtility}</option>
                      <option value="other">{t.disputeTypeOther}</option>
                    </FormSelect>
                  </FormField>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label={t.chargeAmount} required error={errors.chargeAmount}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]">$</span>
                        <FormInput
                          type="number"
                          value={formData.chargeAmount}
                          onChange={(e) => updateField('chargeAmount', e.target.value)}
                          placeholder={t.chargeAmountPlaceholder}
                          error={!!errors.chargeAmount}
                          className="pl-7"
                          step="0.01"
                          min="0"
                          required
                        />
                      </div>
                    </FormField>
                    
                    <FormField label={t.chargeDate} required error={errors.chargeDate}>
                      <FormInput
                        type="date"
                        value={formData.chargeDate}
                        onChange={(e) => updateField('chargeDate', e.target.value)}
                        error={!!errors.chargeDate}
                        required
                      />
                    </FormField>
                  </div>
                  
                  <FormField label={t.invoiceNumber}>
                    <FormInput
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => updateField('invoiceNumber', e.target.value)}
                      placeholder={t.invoiceNumberPlaceholder}
                    />
                  </FormField>
                  
                  <FormField label={t.description} required error={errors.description}>
                    <FormTextarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder={t.descriptionPlaceholder}
                      rows={5}
                      error={!!errors.description}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.requestedResolution} required error={errors.requestedResolution}>
                    <FormTextarea
                      value={formData.requestedResolution}
                      onChange={(e) => updateField('requestedResolution', e.target.value)}
                      placeholder={t.resolutionPlaceholder}
                      rows={3}
                      error={!!errors.requestedResolution}
                      required
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
              
              {/* Section 3: Evidence */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader
                    title={t.evidenceTitle}
                    sectionNumber={3}
                    totalSections={4}
                  />
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)]">{t.evidenceIntro}</p>
                  </div>
                  
                  <FormPhotoUpload
                    maxPhotos={10}
                    label={t.uploadEvidence}
                    helperText={t.uploadHelper}
                    photos={evidence}
                    onPhotosChange={setEvidence}
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                  />
                  
                  <FormButton
                    type="button"
                    onClick={() => nextSection()}
                    fullWidth
                  >
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}
              
              {/* Section 4: Review & Submit */}
              {currentSection === 4 && (
                <FormSection>
                  <SectionHeader
                    title={t.reviewTitle}
                    sectionNumber={4}
                    totalSections={4}
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
                  
                  {/* Dispute Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewDispute}</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">{t.disputeType}: </span>
                        <span className="font-medium">{formData.disputeType}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.chargeAmount}: </span>
                        <span className="font-medium">${formData.chargeAmount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.chargeDate}: </span>
                        <span className="font-medium">{formData.chargeDate}</span>
                      </div>
                      {formData.invoiceNumber && (
                        <div>
                          <span className="text-[var(--muted)]">{t.invoiceNumber}: </span>
                          <span className="font-medium">{formData.invoiceNumber}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-[var(--muted)]">{t.description}: </span>
                        <p className="font-medium mt-1">{formData.description}</p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.requestedResolution}: </span>
                        <p className="font-medium mt-1">{formData.requestedResolution}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Evidence Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewEvidence}</h4>
                    {evidence.length > 0 ? (
                      <p className="text-sm text-[var(--ink)]">{evidence.length} file(s) uploaded</p>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">{t.noEvidence}</p>
                    )}
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

export default function BillingDisputeForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <BillingDisputeFormContent />
    </Suspense>
  );
}
