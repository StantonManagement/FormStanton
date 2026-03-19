'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { petFeeExemptionTranslations } from '@/lib/petFeeExemptionTranslations';
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormButton,
  FormCheckbox,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
  FormDocumentUpload,
  FormPhoneInput,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { validateEmail, validatePhone, formatPhone } from '@/lib/formUtils';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

interface PetFeeExemptionFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  exemptionReason: string;
  reasonExplanation: string;
  petDescription: string;
  finalConfirm: boolean;
}

const initialFormData: PetFeeExemptionFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  exemptionReason: '',
  reasonExplanation: '',
  petDescription: '',
  finalConfirm: false,
};

const EXEMPTION_REASONS = [
  { value: 'emotional_support', label: 'Emotional Support Animal (ESA)' },
  { value: 'service_animal', label: 'Service Animal (ADA)' },
  { value: 'medical_necessity', label: 'Medical Necessity' },
  { value: 'other', label: 'Other' },
];

function PetFeeExemptionFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [documents, setDocuments] = useState<File[]>([]);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<PetFeeExemptionFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    documents.forEach((doc, index) => {
      formDataToSend.append(`document_${index}`, doc);
    });
    
    const response = await fetch('/api/forms/pet-fee-exemption', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = petFeeExemptionTranslations[language];
  
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
      
      if (!formData.exemptionReason) {
        setFieldError('exemptionReason', t.exemptionReasonRequired);
        isValid = false;
      }
      
      if (!formData.reasonExplanation.trim()) {
        setFieldError('reasonExplanation', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.petDescription.trim()) {
        setFieldError('petDescription', t.requiredFieldsMissing);
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
    { id: 2, label: t.tabExemptionDetails },
    { id: 3, label: t.tabDocuments },
    { id: 4, label: t.tabReview },
  ];
  
  const getReasonDescription = (reason: string) => {
    switch (reason) {
      case 'emotional_support':
        return t.esaDescription;
      case 'service_animal':
        return t.serviceDescription;
      case 'medical_necessity':
        return t.medicalDescription;
      case 'other':
        return t.otherDescription;
      default:
        return '';
    }
  };
  
  const getRequiredDocuments = (reason: string) => {
    switch (reason) {
      case 'emotional_support':
        return t.esaDocuments;
      case 'service_animal':
        return t.serviceDocuments;
      case 'medical_necessity':
        return t.medicalDocuments;
      case 'other':
        return t.otherDocuments;
      default:
        return '';
    }
  };
  
  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      
      <FormLayout>
        <TabNavigation
          tabs={tabs}
          activeTab={currentSection}
          onTabClick={goToSection}
        />
        
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <h1 className="font-serif text-xl text-[var(--primary)] mb-2">{t.formTitle}</h1>
              <p className="text-sm text-[var(--ink)] leading-relaxed">{t.formIntro}</p>
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
                    <FormPhoneInput
                      value={formData.phone}
                      onChange={(digits) => updateField('phone', digits)}
                      placeholder={t.phonePlaceholder}
                      error={!!errors.phone}
                      errorMessage={errors.phone}
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
              
              {/* Section 2: Exemption Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.exemptionDetailsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <FormField label={t.exemptionReason} required error={errors.exemptionReason}>
                    <FormSelect
                      value={formData.exemptionReason}
                      onChange={(e) => {
                        updateField('exemptionReason', e.target.value);
                        updateField('reasonExplanation', '');
                      }}
                      error={!!errors.exemptionReason}
                      required
                    >
                      <option value="">{t.exemptionReasonPlaceholder}</option>
                      {EXEMPTION_REASONS.map(reason => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                  
                  {formData.exemptionReason && (
                    <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-4">
                      <p className="text-sm text-[var(--ink)]">
                        {getReasonDescription(formData.exemptionReason)}
                      </p>
                    </div>
                  )}
                  
                  <FormField label={t.reasonExplanation} required error={errors.reasonExplanation}>
                    <FormTextarea
                      value={formData.reasonExplanation}
                      onChange={(e) => updateField('reasonExplanation', e.target.value)}
                      placeholder={t.reasonExplanationPlaceholder}
                      rows={4}
                      error={!!errors.reasonExplanation}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.petDescription} required error={errors.petDescription}>
                    <FormTextarea
                      value={formData.petDescription}
                      onChange={(e) => updateField('petDescription', e.target.value)}
                      placeholder={t.petDescriptionPlaceholder}
                      rows={3}
                      error={!!errors.petDescription}
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
              
              {/* Section 3: Documents */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader
                    title={t.documentsTitle}
                    sectionNumber={3}
                    totalSections={4}
                  />
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)] mb-2">{t.documentsIntro}</p>
                    {formData.exemptionReason && (
                      <p className="text-xs text-[var(--muted)] mt-2">
                        <strong>Required:</strong> {getRequiredDocuments(formData.exemptionReason)}
                      </p>
                    )}
                  </div>
                  
                  <FormDocumentUpload
                    maxFiles={5}
                    maxSize={10 * 1024 * 1024} // 10MB
                    acceptedTypes={['application/pdf', 'image/jpeg', 'image/png']}
                    label={t.uploadDocuments}
                    helperText={t.uploadHelper}
                    documents={documents}
                    onDocumentsChange={setDocuments}
                    errorMessages={{
                      maxFiles: t.maxFilesReached,
                      fileSize: t.fileTooLarge,
                      fileType: t.invalidFileType,
                    }}
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
              
              {/* Section 4: Review & Sign */}
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
                      <div className="font-medium">{formatPhone(formData.phone)}</div>
                      {formData.email && (
                        <>
                          <div className="text-[var(--muted)]">{t.email}:</div>
                          <div className="font-medium">{formData.email}</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Exemption Details Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewExemptionDetails}</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">{t.exemptionReason}: </span>
                        <span className="font-medium">
                          {EXEMPTION_REASONS.find(r => r.value === formData.exemptionReason)?.label}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.reasonExplanation}: </span>
                        <p className="font-medium mt-1">{formData.reasonExplanation}</p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.petDescription}: </span>
                        <p className="font-medium mt-1">{formData.petDescription}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Documents Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewDocuments}</h4>
                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map((doc, idx) => (
                          <p key={idx} className="text-sm text-[var(--ink)]">
                            {doc.name} ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No documents uploaded</p>
                    )}
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

export default function PetFeeExemptionForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <PetFeeExemptionFormContent />
    </Suspense>
  );
}
