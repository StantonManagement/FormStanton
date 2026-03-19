'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { moveInInspectionTranslations } from '@/lib/moveInInspectionTranslations';
import {
  FormField,
  FormInput,
  FormCheckbox,
  FormButton,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
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
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

interface InspectionItem {
  item: string;
  condition: string;
  notes: string;
}

interface MoveInInspectionFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  moveInDate: string;
  unitKeys: number;
  mailboxKeys: number;
  fobs: number;
  livingRoom: InspectionItem[];
  kitchen: InspectionItem[];
  bathroom: InspectionItem[];
  bedroom: InspectionItem[];
  otherAreas: InspectionItem[];
  finalConfirm: boolean;
}

const createInspectionItems = (items: string[]): InspectionItem[] => {
  return items.map(item => ({ item, condition: '', notes: '' }));
};

const initialFormData: MoveInInspectionFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  moveInDate: new Date().toISOString().split('T')[0],
  unitKeys: 0,
  mailboxKeys: 0,
  fobs: 0,
  livingRoom: createInspectionItems(['walls', 'ceiling', 'floors', 'windows', 'windowScreens', 'blinds', 'doors', 'doorHardware', 'lightFixtures', 'outlets', 'baseboards']),
  kitchen: createInspectionItems(['walls', 'ceiling', 'floors', 'cabinets', 'countertops', 'sink', 'stove', 'refrigerator', 'dishwasher', 'microwave', 'lightFixtures', 'outlets']),
  bathroom: createInspectionItems(['tiles', 'ceiling', 'floors', 'toilet', 'sink', 'shower', 'showerCurtain', 'lightFixtures', 'outlets']),
  bedroom: createInspectionItems(['walls', 'ceiling', 'floors', 'windows', 'windowScreens', 'blinds', 'closets', 'doors', 'doorHardware', 'lightFixtures', 'outlets']),
  otherAreas: createInspectionItems(['smokeDetector', 'coDetector']),
  finalConfirm: false,
};

function MoveInInspectionFormContent() {
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
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<MoveInInspectionFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    photos.forEach((photo, index) => {
      formDataToSend.append(`photo_${index}`, photo);
    });
    
    const response = await fetch('/api/forms/move-in-inspection', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = moveInInspectionTranslations[language];
  
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
  
  const updateInspectionItem = (room: keyof Pick<MoveInInspectionFormData, 'livingRoom' | 'kitchen' | 'bathroom' | 'bedroom' | 'otherAreas'>, index: number, field: keyof InspectionItem, value: string) => {
    const roomData = [...formData[room]];
    roomData[index] = { ...roomData[index], [field]: value };
    updateField(room, roomData);
  };
  
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
  
  const renderInspectionTable = (
    room: keyof Pick<MoveInInspectionFormData, 'livingRoom' | 'kitchen' | 'bathroom' | 'bedroom' | 'otherAreas'>,
    title: string
  ) => {
    const items = formData[room];
    
    return (
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[var(--primary)] mb-3 font-serif">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[var(--border)]">
            <thead>
              <tr className="bg-[var(--bg-section)]">
                <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--ink)]">Item</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] w-24">{t.condition}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left text-sm font-medium text-[var(--ink)]">{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inspectionItem, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-section)]/50">
                  <td className="border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)]">
                    {t[inspectionItem.item as keyof typeof t] || inspectionItem.item}
                  </td>
                  <td className="border border-[var(--border)] px-3 py-2">
                    <input
                      type="text"
                      value={inspectionItem.condition}
                      onChange={(e) => updateInspectionItem(room, idx, 'condition', e.target.value)}
                      placeholder={t.conditionPlaceholder}
                      className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                      maxLength={4}
                    />
                  </td>
                  <td className="border border-[var(--border)] px-3 py-2">
                    <input
                      type="text"
                      value={inspectionItem.notes}
                      onChange={(e) => updateInspectionItem(room, idx, 'notes', e.target.value)}
                      placeholder={t.notesPlaceholder}
                      className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  const countIssues = () => {
    let count = 0;
    const allRooms = [...formData.livingRoom, ...formData.kitchen, ...formData.bathroom, ...formData.bedroom, ...formData.otherAreas];
    allRooms.forEach(item => {
      if (item.condition && item.condition.toUpperCase() !== 'G' && item.condition.toUpperCase() !== 'N/A') {
        count++;
      }
    });
    return count;
  };
  
  const tabs = [
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabInspection },
    { id: 3, label: t.tabPhotos },
    { id: 4, label: t.tabReview },
  ];
  
  const formTemplate = getFormById(1); // Move-In Inspection Form
  
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
                    <FormInput
                      type="text"
                      value={formData.unitNumber}
                      onChange={(e) => updateField('unitNumber', e.target.value)}
                      placeholder={t.enterUnit}
                      error={!!errors.unitNumber}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.moveInDate} required>
                    <FormInput
                      type="date"
                      value={formData.moveInDate}
                      onChange={(e) => updateField('moveInDate', e.target.value)}
                      required
                    />
                  </FormField>
                  
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">{t.keysReceived}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField label={t.unitKeys}>
                        <FormInput
                          type="number"
                          value={formData.unitKeys}
                          onChange={(e) => updateField('unitKeys', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </FormField>
                      
                      <FormField label={t.mailboxKeys}>
                        <FormInput
                          type="number"
                          value={formData.mailboxKeys}
                          onChange={(e) => updateField('mailboxKeys', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </FormField>
                      
                      <FormField label={t.fobs}>
                        <FormInput
                          type="number"
                          value={formData.fobs}
                          onChange={(e) => updateField('fobs', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </FormField>
                    </div>
                  </div>
                  
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
              
              {/* Section 2: Inspection */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.instructionsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)] mb-3">{t.instructionsText}</p>
                    <ul className="text-xs text-[var(--ink)] space-y-1 ml-4">
                      <li>• {t.codeG}</li>
                      <li>• {t.codeD}</li>
                      <li>• {t.codeM}</li>
                      <li>• {t.codeNA}</li>
                    </ul>
                    <p className="text-xs text-[var(--muted)] mt-3">{t.photoNote}</p>
                  </div>
                  
                  {renderInspectionTable('livingRoom', t.livingRoomTitle)}
                  {renderInspectionTable('kitchen', t.kitchenTitle)}
                  {renderInspectionTable('bathroom', t.bathroomTitle)}
                  {renderInspectionTable('bedroom', t.bedroomTitle)}
                  {renderInspectionTable('otherAreas', t.otherAreasTitle)}
                  
                  <FormButton
                    type="button"
                    onClick={() => nextSection()}
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
                    maxPhotos={20}
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
                      <div className="text-[var(--muted)]">{t.moveInDate}:</div>
                      <div className="font-medium">{formData.moveInDate}</div>
                      <div className="text-[var(--muted)]">{t.keysReceived}:</div>
                      <div className="font-medium">
                        {formData.unitKeys} unit, {formData.mailboxKeys} mailbox, {formData.fobs} fobs
                      </div>
                    </div>
                  </div>
                  
                  {/* Inspection Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewInspection}</h4>
                    <div className="text-sm space-y-1">
                      <p className="text-[var(--ink)]">
                        {formData.livingRoom.length + formData.kitchen.length + formData.bathroom.length + formData.bedroom.length + formData.otherAreas.length} {t.itemsInspected}
                      </p>
                      <p className="text-[var(--ink)]">
                        {countIssues()} {t.issuesNoted}
                      </p>
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
                      value={formData.moveInDate}
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

export default function MoveInInspectionForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <MoveInInspectionFormContent />
    </Suspense>
  );
}
