'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { bulkDisposalTranslations } from '@/lib/bulkDisposalTranslations';
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

interface BulkDisposalFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  itemType: string;
  itemDescription: string;
  quantity: number;
  estimatedWeight: string;
  disposalReason: string;
  proposedDate: string;
  proposedLocation: string;
  finalConfirm: boolean;
}

const initialFormData: BulkDisposalFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  itemType: '',
  itemDescription: '',
  quantity: 1,
  estimatedWeight: '',
  disposalReason: '',
  proposedDate: '',
  proposedLocation: '',
  finalConfirm: false,
};

function BulkDisposalFormContent() {
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
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<BulkDisposalFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    photos.forEach((photo, index) => {
      formDataToSend.append(`photo_${index}`, photo);
    });
    
    const response = await fetch('/api/forms/bulk-disposal', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = bulkDisposalTranslations[language];
  
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
      
      if (!formData.itemType.trim()) {
        setFieldError('itemType', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.itemDescription.trim()) {
        setFieldError('itemDescription', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.estimatedWeight.trim()) {
        setFieldError('estimatedWeight', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.disposalReason.trim()) {
        setFieldError('disposalReason', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.proposedDate) {
        setFieldError('proposedDate', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.proposedLocation.trim()) {
        setFieldError('proposedLocation', t.requiredFieldsMissing);
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
    { id: 2, label: t.tabItemDetails },
    { id: 3, label: t.tabPhotos },
    { id: 4, label: t.tabReview },
  ];
  
  const formTemplate = getFormById(11); // Bulk Item Disposal Request
  
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
              
              {/* Section 2: Item Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.itemDetailsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <FormField label={t.itemType} required error={errors.itemType}>
                    <FormInput
                      type="text"
                      value={formData.itemType}
                      onChange={(e) => updateField('itemType', e.target.value)}
                      placeholder={t.itemTypePlaceholder}
                      error={!!errors.itemType}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.itemDescription} required error={errors.itemDescription}>
                    <FormTextarea
                      value={formData.itemDescription}
                      onChange={(e) => updateField('itemDescription', e.target.value)}
                      placeholder={t.descriptionPlaceholder}
                      rows={3}
                      error={!!errors.itemDescription}
                      required
                    />
                  </FormField>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label={t.quantity} required>
                      <FormInput
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                        placeholder={t.quantityPlaceholder}
                        min="1"
                        required
                      />
                    </FormField>
                    
                    <FormField label={t.estimatedWeight} required error={errors.estimatedWeight}>
                      <FormInput
                        type="text"
                        value={formData.estimatedWeight}
                        onChange={(e) => updateField('estimatedWeight', e.target.value)}
                        placeholder={t.weightPlaceholder}
                        error={!!errors.estimatedWeight}
                        required
                      />
                    </FormField>
                  </div>
                  
                  <FormField label={t.disposalReason} required error={errors.disposalReason}>
                    <FormTextarea
                      value={formData.disposalReason}
                      onChange={(e) => updateField('disposalReason', e.target.value)}
                      placeholder={t.reasonPlaceholder}
                      rows={3}
                      error={!!errors.disposalReason}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.proposedDate} required error={errors.proposedDate}>
                    <FormInput
                      type="date"
                      value={formData.proposedDate}
                      onChange={(e) => updateField('proposedDate', e.target.value)}
                      error={!!errors.proposedDate}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.proposedLocation} required error={errors.proposedLocation}>
                    <FormInput
                      type="text"
                      value={formData.proposedLocation}
                      onChange={(e) => updateField('proposedLocation', e.target.value)}
                      placeholder={t.locationPlaceholder}
                      error={!!errors.proposedLocation}
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
                    maxPhotos={3}
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
                  
                  {/* Item Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewItem}</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">{t.itemType}: </span>
                        <span className="font-medium">{formData.itemType}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.itemDescription}: </span>
                        <p className="font-medium mt-1">{formData.itemDescription}</p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.quantity}: </span>
                        <span className="font-medium">{formData.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.estimatedWeight}: </span>
                        <span className="font-medium">{formData.estimatedWeight}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.disposalReason}: </span>
                        <p className="font-medium mt-1">{formData.disposalReason}</p>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.proposedDate}: </span>
                        <span className="font-medium">{formData.proposedDate}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.proposedLocation}: </span>
                        <span className="font-medium">{formData.proposedLocation}</span>
                      </div>
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

export default function BulkDisposalForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <BulkDisposalFormContent />
    </Suspense>
  );
}
