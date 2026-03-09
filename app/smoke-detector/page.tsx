'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { smokeDetectorTranslations } from '@/lib/smokeDetectorTranslations';
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
  FormPhotoUpload,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { validatePhone, sanitizePhone } from '@/lib/formUtils';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

interface SmokeDetectorFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  dateSubmitted: string;
  bedroomCount: string;
  smokeDetectorCount: string;
  coDetectorCount: string;
  allWorking: boolean;
  testedAll: boolean;
  knowsLocations: boolean;
  understandsResponsibility: boolean;
  finalConfirm: boolean;
}

const initialFormData: SmokeDetectorFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  bedroomCount: '',
  smokeDetectorCount: '',
  coDetectorCount: '',
  allWorking: false,
  testedAll: false,
  knowsLocations: false,
  understandsResponsibility: false,
  finalConfirm: false,
};

function SmokeDetectorFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<SmokeDetectorFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    photos.forEach((photo, index) => {
      formDataToSend.append(`photo_${index}`, photo);
    });
    
    const response = await fetch('/api/forms/smoke-detector', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = smokeDetectorTranslations[language];
  
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
      
      return isValid;
    }
    
    if (section === 2) {
      let isValid = true;
      
      if (!formData.bedroomCount) {
        setFieldError('bedroomCount', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.smokeDetectorCount) {
        setFieldError('smokeDetectorCount', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.coDetectorCount) {
        setFieldError('coDetectorCount', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.allWorking) {
        setFieldError('allWorking', t.mustConfirmWorking);
        isValid = false;
      }
      
      if (!formData.testedAll) {
        setFieldError('testedAll', t.mustConfirmTested);
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
    
    if (!formData.knowsLocations || !formData.understandsResponsibility) {
      return;
    }
    
    await submit(formData);
  };
  
  const tabs = [
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabDetectorInfo },
    { id: 3, label: t.tabPhotos },
    { id: 4, label: t.tabReview },
  ];
  
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
              
              {/* Section 2: Detector Information */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.detectorInfoTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)] mb-2">{t.detectorInfoIntro}</p>
                    <p className="text-xs text-[var(--muted)]">{t.detectorInfoNote}</p>
                  </div>
                  
                  <FormField label={t.bedroomCount} required error={errors.bedroomCount}>
                    <FormSelect
                      value={formData.bedroomCount}
                      onChange={(e) => updateField('bedroomCount', e.target.value)}
                      error={!!errors.bedroomCount}
                      required
                    >
                      <option value="">{t.selectCount}</option>
                      <option value="0">Studio (0 bedrooms)</option>
                      <option value="1">1 bedroom</option>
                      <option value="2">2 bedrooms</option>
                      <option value="3">3 bedrooms</option>
                      <option value="4">4+ bedrooms</option>
                    </FormSelect>
                  </FormField>
                  
                  <FormField label={t.smokeDetectorCount} required error={errors.smokeDetectorCount}>
                    <FormSelect
                      value={formData.smokeDetectorCount}
                      onChange={(e) => updateField('smokeDetectorCount', e.target.value)}
                      error={!!errors.smokeDetectorCount}
                      required
                    >
                      <option value="">{t.selectCount}</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5+</option>
                    </FormSelect>
                  </FormField>
                  
                  <FormField label={t.coDetectorCount} required error={errors.coDetectorCount}>
                    <FormSelect
                      value={formData.coDetectorCount}
                      onChange={(e) => updateField('coDetectorCount', e.target.value)}
                      error={!!errors.coDetectorCount}
                      required
                    >
                      <option value="">{t.selectCount}</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                    </FormSelect>
                  </FormField>
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">{t.confirmationsTitle}</h4>
                    
                    <FormCheckbox
                      label={t.allWorking}
                      checked={formData.allWorking}
                      onChange={(e) => updateField('allWorking', e.target.checked)}
                      required
                    />
                    {errors.allWorking && (
                      <p className="text-xs text-red-600 mt-1">{errors.allWorking}</p>
                    )}
                    
                    <FormCheckbox
                      label={t.testedAll}
                      checked={formData.testedAll}
                      onChange={(e) => updateField('testedAll', e.target.checked)}
                      required
                    />
                    {errors.testedAll && (
                      <p className="text-xs text-red-600 mt-1">{errors.testedAll}</p>
                    )}
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-4 mb-4">
                    <p className="text-xs text-yellow-800">{t.importantNote}</p>
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
              
              {/* Section 3: Photos (Optional) */}
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
                    </div>
                  </div>
                  
                  {/* Detector Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewDetectors}</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--muted)]">{t.bedroomCount}: </span>
                        <span className="font-medium">{formData.bedroomCount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.smokeDetectorCount}: </span>
                        <span className="font-medium">{formData.smokeDetectorCount}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)]">{t.coDetectorCount}: </span>
                        <span className="font-medium">{formData.coDetectorCount}</span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)]">
                        <p className="text-[var(--ink)]">✓ {t.allWorking}</p>
                        <p className="text-[var(--ink)]">✓ {t.testedAll}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Photos Summary */}
                  {photos.length > 0 && (
                    <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                      <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewPhotos}</h4>
                      <p className="text-sm text-[var(--ink)]">{photos.length} photo(s) uploaded</p>
                    </div>
                  )}
                  
                  {/* Acknowledgments */}
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">{t.acknowledgmentTitle}</h4>
                    
                    <FormCheckbox
                      label={t.knowsLocations}
                      checked={formData.knowsLocations}
                      onChange={(e) => updateField('knowsLocations', e.target.checked)}
                      required
                    />
                    
                    <FormCheckbox
                      label={t.understandsResponsibility}
                      checked={formData.understandsResponsibility}
                      onChange={(e) => updateField('understandsResponsibility', e.target.checked)}
                      required
                    />
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

export default function SmokeDetectorForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <SmokeDetectorFormContent />
    </Suspense>
  );
}
