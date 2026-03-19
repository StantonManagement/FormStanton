'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { maintenanceRequestTranslations } from '@/lib/maintenanceRequestTranslations';
import {
  FormField,
  FormInput,
  FormSelect,
  FormRadioGroup,
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

interface MaintenanceRequestFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  location: string;
  issueType: string;
  description: string;
  isEmergency: boolean | null;
  entryAllowed: boolean;
  hasPet: boolean;
  petDetails: string;
  finalConfirm: boolean;
}

const initialFormData: MaintenanceRequestFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  location: '',
  issueType: '',
  description: '',
  isEmergency: null,
  entryAllowed: true,
  hasPet: false,
  petDetails: '',
  finalConfirm: false,
};

function MaintenanceRequestFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [showPrintable, setShowPrintable] = useState(false);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<MaintenanceRequestFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    photos.forEach((photo, index) => {
      formDataToSend.append(`photo_${index}`, photo);
    });
    
    const response = await fetch('/api/forms/maintenance-request', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = maintenanceRequestTranslations[language];
  
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
      
      if (!formData.location.trim()) {
        setFieldError('location', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.issueType) {
        setFieldError('issueType', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.description.trim()) {
        setFieldError('description', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (formData.isEmergency === null) {
        setFieldError('isEmergency', t.requiredFieldsMissing);
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
    { id: 2, label: t.tabIssueDetails },
    { id: 3, label: t.tabPhotos },
    { id: 4, label: t.tabReview },
  ];
  
  const formTemplate = getFormById(8); // Maintenance Request Form
  
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
              
              {/* Section 2: Issue Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.issueDetailsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <FormField label={t.location} required error={errors.location}>
                    <FormInput
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder={t.locationPlaceholder}
                      error={!!errors.location}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.issueType} required error={errors.issueType}>
                    <FormSelect
                      value={formData.issueType}
                      onChange={(e) => updateField('issueType', e.target.value)}
                      error={!!errors.issueType}
                      required
                    >
                      <option value="">{t.selectIssueType}</option>
                      <option value="plumbing">{t.issueTypePlumbing}</option>
                      <option value="electrical">{t.issueTypeElectrical}</option>
                      <option value="hvac">{t.issueTypeHVAC}</option>
                      <option value="appliance">{t.issueTypeAppliance}</option>
                      <option value="door">{t.issueTypeDoor}</option>
                      <option value="floor">{t.issueTypeFloor}</option>
                      <option value="wall">{t.issueTypeWall}</option>
                      <option value="pest">{t.issueTypePest}</option>
                      <option value="other">{t.issueTypeOther}</option>
                    </FormSelect>
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
                  
                  <FormField label={t.isEmergency} required error={errors.isEmergency}>
                    <FormRadioGroup
                      name="isEmergency"
                      options={[
                        { value: 'yes', label: t.yes },
                        { value: 'no', label: t.no },
                      ]}
                      value={formData.isEmergency === true ? 'yes' : formData.isEmergency === false ? 'no' : ''}
                      onChange={(value) => updateField('isEmergency', value === 'yes')}
                      direction="horizontal"
                    />
                    {formData.isEmergency === true && (
                      <div className="mt-2 bg-red-50 border border-red-200 rounded-sm p-3">
                        <p className="text-xs text-red-700">{t.emergencyNote}</p>
                      </div>
                    )}
                  </FormField>
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">{t.entryTitle}</h4>
                    <p className="text-xs text-[var(--muted)] mb-3">{t.entryIntro}</p>
                    
                    <FormCheckbox
                      label={t.entryAllowed}
                      checked={formData.entryAllowed}
                      onChange={(e) => updateField('entryAllowed', e.target.checked)}
                    />
                    
                    <FormCheckbox
                      label={t.hasPet}
                      checked={formData.hasPet}
                      onChange={(e) => updateField('hasPet', e.target.checked)}
                    />
                    
                    {formData.hasPet && (
                      <FormField label={t.petDetails}>
                        <FormInput
                          type="text"
                          value={formData.petDetails}
                          onChange={(e) => updateField('petDetails', e.target.value)}
                          placeholder={t.petDetailsPlaceholder}
                        />
                      </FormField>
                    )}
                  </div>
                  
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
              
              {/* Section 3: Photos */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader
                    title={t.photosTitle}
                    sectionNumber={3}
                    totalSections={4}
                  />
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)]">{t.photosIntro}</p>
                  </div>
                  
                  <FormPhotoUpload
                    maxPhotos={5}
                    label={t.uploadPhotos}
                    helperText={t.uploadHelper}
                    photos={photos}
                    onPhotosChange={setPhotos}
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
                  
                  {/* Issue Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewIssue}</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">{t.location}: </span>
                        <span className="font-medium">{formData.location}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.issueType}: </span>
                        <span className="font-medium">{formData.issueType}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.description}: </span>
                        <p className="font-medium mt-1">{formData.description}</p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.isEmergency}: </span>
                        <span className={`font-medium ${formData.isEmergency ? 'text-red-600' : ''}`}>
                          {formData.isEmergency ? t.yes : t.no}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Entry Authorization Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewEntry}</h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-[var(--ink)]">
                        {formData.entryAllowed ? '✓ ' + t.entryAllowed : '✗ ' + t.entryNoticeRequired}
                      </p>
                      {formData.hasPet && (
                        <p className="text-[var(--ink)]">
                          ✓ {t.hasPet}: {formData.petDetails || 'No details provided'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Photos Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewPhotos}</h4>
                    {photos.length > 0 ? (
                      <p className="text-sm text-[var(--ink)]">{photos.length} photo(s) uploaded</p>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">{t.noPhotos}</p>
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

export default function MaintenanceRequestForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <MaintenanceRequestFormContent />
    </Suspense>
  );
}
