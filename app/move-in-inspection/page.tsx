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
} from '@/components/form';
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
  unitSize: string;
  moveInDate: string;
  unitKeys: number;
  mailboxKeys: number;
  fobs: number;
  entranceHalls: InspectionItem[];
  livingRoom: InspectionItem[];
  kitchen: InspectionItem[];
  bathroom: InspectionItem[];
  bedroom: InspectionItem[];
  otherAreas: InspectionItem[];
  finalConfirm: boolean;
}

const blankRows = (n = 3): InspectionItem[] =>
  Array.from({ length: n }, () => ({ item: '', condition: '', notes: '' }));

const initialFormData: MoveInInspectionFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  unitSize: '',
  moveInDate: new Date().toISOString().split('T')[0],
  unitKeys: 0,
  mailboxKeys: 0,
  fobs: 0,
  entranceHalls: blankRows(3),
  bedroom: blankRows(3),
  kitchen: blankRows(3),
  livingRoom: blankRows(3),
  bathroom: blankRows(3),
  otherAreas: blankRows(2),
  finalConfirm: false,
};

function MoveInInspectionFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  const handlePrintBlank = async () => {
    setIsPrintLoading(true);
    try {
      const res = await fetch('/api/forms/1/blank-pdf');
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPrintLoading(false);
    }
  };
  
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
  
  type RoomKey = 'entranceHalls' | 'livingRoom' | 'kitchen' | 'bathroom' | 'bedroom' | 'otherAreas';

  const updateInspectionItem = (room: RoomKey, index: number, field: keyof InspectionItem, value: string) => {
    const roomData = [...formData[room]];
    roomData[index] = { ...roomData[index], [field]: value };
    updateField(room, roomData);
  };

  const addRow = (room: RoomKey) => {
    updateField(room, [...formData[room], { item: '', condition: '', notes: '' }]);
  };

  const removeRow = (room: RoomKey, index: number) => {
    if (formData[room].length <= 1) return;
    const roomData = formData[room].filter((_, i) => i !== index);
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
  
  const CONDITION_OPTIONS = [
    { value: '', label: t.conditionPlaceholder },
    { value: 'good', label: t.conditionGood },
    { value: 'damage', label: t.conditionDamage },
    { value: 'immediate_repair', label: t.conditionImmediateRepair },
    { value: 'missing', label: t.conditionMissing },
    { value: 'na', label: t.conditionNA },
  ];

  const conditionColor = (val: string) => {
    if (val === 'good') return 'text-green-700';
    if (val === 'damage' || val === 'immediate_repair') return 'text-amber-700';
    if (val === 'missing') return 'text-red-700';
    return 'text-[var(--ink)]';
  };

  const renderInspectionTable = (room: RoomKey, title: string) => {
    const items = formData[room];
    return (
      <div className="mb-8">
        <div className="bg-[var(--primary)] px-4 py-2 mb-0">
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
        </div>
        <div className="overflow-x-auto border border-[var(--border)] border-t-0">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg-section)] border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--muted)] w-2/5">{t.itemColumn}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--muted)] w-1/4">{t.condition}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--muted)]">{t.notes}</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((inspectionItem, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[var(--bg-section)]/40'}>
                  <td className="px-3 py-1.5 border-b border-[var(--border)]/50">
                    <input
                      type="text"
                      value={inspectionItem.item}
                      onChange={(e) => updateInspectionItem(room, idx, 'item', e.target.value)}
                      placeholder={t.itemPlaceholder}
                      className="w-full px-0 py-0.5 text-sm bg-transparent text-[var(--ink)] placeholder:text-[var(--muted)]/50 border-none outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-[var(--border)]/50">
                    <select
                      value={inspectionItem.condition}
                      onChange={(e) => updateInspectionItem(room, idx, 'condition', e.target.value)}
                      className={`w-full px-0 py-0.5 text-sm bg-transparent border-none outline-none cursor-pointer ${conditionColor(inspectionItem.condition)}`}
                    >
                      {CONDITION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 border-b border-[var(--border)]/50">
                    <input
                      type="text"
                      value={inspectionItem.notes}
                      onChange={(e) => updateInspectionItem(room, idx, 'notes', e.target.value)}
                      placeholder={t.notesPlaceholder}
                      className="w-full px-0 py-0.5 text-sm bg-transparent text-[var(--ink)] placeholder:text-[var(--muted)]/50 border-none outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b border-[var(--border)]/50 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(room, idx)}
                      disabled={items.length <= 1}
                      className="text-[var(--muted)] hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed text-base leading-none transition-colors"
                      title={t.removeItem}
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => addRow(room)}
          className="mt-2 text-xs text-[var(--primary)] hover:underline font-medium transition-colors"
        >
          {t.addItem}
        </button>
      </div>
    );
  };
  
  const countIssues = () => {
    const allRooms = [...formData.entranceHalls, ...formData.livingRoom, ...formData.kitchen, ...formData.bathroom, ...formData.bedroom, ...formData.otherAreas];
    return allRooms.filter(item => item.condition && item.condition !== 'good' && item.condition !== 'na').length;
  };

  const countItems = () => {
    return [...formData.entranceHalls, ...formData.livingRoom, ...formData.kitchen, ...formData.bathroom, ...formData.bedroom, ...formData.otherAreas]
      .filter(item => item.item.trim() !== '').length;
  };
  
  const tabs = [
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabInspection },
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="font-serif text-xl text-[var(--primary)] mb-2">{t.formTitle}</h1>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">{t.formIntro}</p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintBlank}
                  disabled={isPrintLoading}
                  className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {isPrintLoading ? 'Generating...' : 'Print Blank'}
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
                  
                  <FormField label={t.unitSize}>
                    <FormInput
                      type="text"
                      value={formData.unitSize}
                      onChange={(e) => updateField('unitSize', e.target.value)}
                      placeholder={t.unitSizePlaceholder}
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
                    <p className="text-sm text-[var(--ink)] mb-2">{t.instructionsText}</p>
                    <p className="text-xs text-[var(--muted)]">{t.photoNote}</p>
                  </div>
                  
                  {renderInspectionTable('entranceHalls', t.entranceHallsTitle)}
                  {renderInspectionTable('bedroom', t.bedroomTitle)}
                  {renderInspectionTable('kitchen', t.kitchenTitle)}
                  {renderInspectionTable('livingRoom', t.livingRoomTitle)}
                  {renderInspectionTable('bathroom', t.bathroomTitle)}
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
                      {formData.unitSize && (<>
                        <div className="text-[var(--muted)]">{t.unitSize}:</div>
                        <div className="font-medium">{formData.unitSize}</div>
                      </>)}
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
                      <p className="text-[var(--ink)]">{countItems()} {t.itemsInspected}</p>
                      <p className="text-[var(--ink)]">{countIssues()} {t.issuesNoted}</p>
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
                  
                  {/* Manager Acknowledgment */}
                  <div className="border border-[var(--border)] rounded-sm mb-4 overflow-hidden">
                    <div className="bg-[var(--primary)] px-4 py-2">
                      <p className="text-xs font-semibold text-white uppercase tracking-wide">{t.managerAckTitle}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-[var(--ink)] italic">{t.managerAckText}</p>
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <p className="text-xs text-[var(--muted)]">Manager&apos;s Signature _____________________________________ Date __________</p>
                      </div>
                    </div>
                  </div>

                  {/* Tenant Acknowledgment & Signature */}
                  <div className="border border-[var(--border)] rounded-sm mb-4 overflow-hidden">
                    <div className="bg-[var(--primary)] px-4 py-2">
                      <p className="text-xs font-semibold text-white uppercase tracking-wide">{t.tenantAckTitle}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-[var(--ink)] mb-4">{t.tenantAckText}</p>
                      <SignatureCanvasComponent
                        label={t.signature}
                        value={signature}
                        onSave={(dataUrl) => setSignature(dataUrl)}
                      />
                      <p className="text-xs text-[var(--muted)] mt-3">{t.signatureDate}: {formData.moveInDate}</p>
                    </div>
                  </div>

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
