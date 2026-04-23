'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings } from '@/lib/buildings';
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

type InspectionMode = 'tenant' | 'joint' | 'manager';

interface InspectionItem {
  item: string;
  condition: string;
  notes: string;
}

interface MoveInInspectionFormData {
  tenantName: string;
  tenantEmail: string;
  buildingAddress: string;
  unitNumber: string;
  unitSize: string;
  moveInDate: string;
  unitKeys: number;
  mailboxKeys: number;
  fobs: number;
  entranceHalls: InspectionItem[];
  bedroom: InspectionItem[];
  kitchen: InspectionItem[];
  livingRoom: InspectionItem[];
  bathroom: InspectionItem[];
  otherAreas: InspectionItem[];
  finalConfirm: boolean;
}

const DRAFT_KEY = 'move_in_inspection_draft';

const blankRows = (n: number): InspectionItem[] =>
  Array.from({ length: n }, () => ({ item: '', condition: '', notes: '' }));

const initialFormData: MoveInInspectionFormData = {
  tenantName: '',
  tenantEmail: '',
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

type RoomKey = 'entranceHalls' | 'bedroom' | 'kitchen' | 'livingRoom' | 'bathroom' | 'otherAreas';

const DAMAGED_CONDITIONS = new Set(['damage', 'immediate_repair', 'missing']);

function MoveInInspectionFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';

  const [language, setLanguage] = useState<Language>(hasLangParam ? (langParam as Language) : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [mode, setMode] = useState<InspectionMode>('tenant');
  const [modeExpanded, setModeExpanded] = useState(false);
  const [draftBanner, setDraftBanner] = useState(false);
  const [savedDraft, setSavedDraft] = useState<MoveInInspectionFormData | null>(null);

  const { formData, updateField, updateFields } = useFormData(initialFormData);
  const [photos, setPhotos] = useState<File[]>([]);
  const [rowPhotos, setRowPhotos] = useState<Record<string, File[]>>({});
  const rowPhotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [managerSignature, setManagerSignature] = useState('');
  const [signature, setSignature] = useState('');

  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<MoveInInspectionFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('mode', mode);
    formDataToSend.append('formData', JSON.stringify(data));
    if (mode !== 'manager') formDataToSend.append('signature', signature);
    if (mode !== 'tenant') formDataToSend.append('managerSignature', managerSignature);

    let photoIndex = 0;
    photos.forEach((photo) => {
      formDataToSend.append(`photo_${photoIndex}`, photo);
      photoIndex++;
    });
    Object.values(rowPhotos).forEach((files) => {
      files.forEach((file) => {
        formDataToSend.append(`photo_${photoIndex}`, file);
        photoIndex++;
      });
    });

    const response = await fetch('/api/forms/move-in-inspection', {
      method: 'POST',
      body: formDataToSend,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }

    localStorage.removeItem(DRAFT_KEY);
  });

  const t = moveInInspectionTranslations[language];

  const formIntro =
    mode === 'joint'
      ? t.formIntroJoint
      : mode === 'manager'
      ? t.formIntroManager
      : t.formIntroTenant;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MoveInInspectionFormData;
        setSavedDraft(parsed);
        setDraftBanner(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!showForm) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // ignore
    }
  }, [formData, showForm]);

  const handleRowPhotoChange = (key: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const existing = rowPhotos[key] || [];
    setRowPhotos((prev) => ({ ...prev, [key]: [...existing, ...Array.from(files)] }));
  };

  const totalRowPhotoCount = Object.values(rowPhotos).reduce((sum, arr) => sum + arr.length, 0);
  const totalPhotoCount = photos.length + totalRowPhotoCount;

  const modePicker = (
    <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2 min-h-[28px]">
      <button
        type="button"
        onClick={() => setModeExpanded(!modeExpanded)}
        className="text-xs text-[var(--muted)] hover:text-[var(--ink)] font-medium transition-colors flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {t.modePickerLabel}
        <svg className={`w-3 h-3 transition-transform ${modeExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!modeExpanded && mode !== 'tenant' && (
        <span className="text-xs text-[var(--primary)] font-medium">
          · {mode === 'joint' ? t.modeJoint : t.modeManagerOnly}
        </span>
      )}
      {modeExpanded && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => { setMode('joint'); setModeExpanded(false); }}
            className={`text-xs px-2 py-1 border transition-colors rounded-none ${
              mode === 'joint'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            {t.modeJoint}
          </button>
          <button
            type="button"
            onClick={() => { setMode('manager'); setModeExpanded(false); }}
            className={`text-xs px-2 py-1 border transition-colors rounded-none ${
              mode === 'manager'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--ink)] hover:border-[var(--primary)]'
            }`}
          >
            {t.modeManagerOnly}
          </button>
          {mode !== 'tenant' && (
            <button
              type="button"
              onClick={() => { setMode('tenant'); setModeExpanded(false); }}
              className="text-xs text-[var(--muted)] hover:text-red-600 ml-1 transition-colors"
            >
              &#x2715;
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!showForm) {
    return (
      <LanguageLanding
        title={t.formTitle}
        description={formIntro}
        onSelect={(lang) => {
          setLanguage(lang);
          setShowForm(true);
        }}
        bottomSlot={modePicker}
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

  const updateInspectionItem = (
    room: RoomKey,
    index: number,
    field: keyof InspectionItem,
    value: string
  ) => {
    const roomData = [...formData[room]];
    roomData[index] = { ...roomData[index], [field]: value };
    updateField(room, roomData);
  };

  const addRow = (room: RoomKey) => {
    updateField(room, [...formData[room], { item: '', condition: '', notes: '' }]);
  };

  const removeRow = (room: RoomKey, index: number) => {
    const roomData = [...formData[room]];
    if (roomData.length <= 1) return;
    roomData.splice(index, 1);
    setRowPhotos((prev) => {
      const next = { ...prev };
      delete next[`${room}_${index}`];
      return next;
    });
    updateField(room, roomData);
  };

  const validateSection = (section: number): boolean => {
    clearAllErrors();
    if (section === 1) {
      let valid = true;
      if (!formData.tenantName.trim()) { setFieldError('tenantName', t.requiredFieldsMissing); valid = false; }
      if (!formData.buildingAddress) { setFieldError('buildingAddress', t.requiredFieldsMissing); valid = false; }
      if (!formData.unitNumber.trim()) { setFieldError('unitNumber', t.requiredFieldsMissing); valid = false; }
      return valid;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.finalConfirm) return;
    if (mode !== 'manager' && !signature) return;
    if (mode !== 'tenant' && !managerSignature) return;
    await submit(formData);
  };

  const conditionOptions = [
    { value: '', label: t.conditionPlaceholder },
    { value: 'good', label: t.conditionGood },
    { value: 'damage', label: t.conditionDamage },
    { value: 'immediate_repair', label: t.conditionImmediateRepair },
    { value: 'missing', label: t.conditionMissing },
    { value: 'na', label: t.conditionNA },
  ];

  const renderInspectionTable = (room: RoomKey, title: string) => {
    const items = formData[room];
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold text-[var(--primary)] mb-2 uppercase tracking-widest">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[var(--border)]">
            <thead>
              <tr className="bg-[var(--bg-section)]">
                <th className="border border-[var(--border)] px-3 py-2 text-left text-xs font-medium text-[var(--ink)]">{t.itemColumn}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left text-xs font-medium text-[var(--ink)] w-44">{t.condition}</th>
                <th className="border border-[var(--border)] px-3 py-2 text-left text-xs font-medium text-[var(--ink)]">{t.notes}</th>
                <th className="border border-[var(--border)] px-2 py-2 w-8 text-center">
                  <svg className="w-3.5 h-3.5 mx-auto text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </th>
                <th className="border border-[var(--border)] px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((inspectionItem, idx) => {
                const rowKey = `${room}_${idx}`;
                const rowPhotoFiles = rowPhotos[rowKey] || [];
                const photoCount = rowPhotoFiles.length;
                const isDamaged = DAMAGED_CONDITIONS.has(inspectionItem.condition);
                return (
                  <tr key={idx} className="hover:bg-[var(--bg-section)]/50">
                    <td className="border border-[var(--border)] px-2 py-1.5">
                      <input
                        type="text"
                        value={inspectionItem.item}
                        onChange={(e) => updateInspectionItem(room, idx, 'item', e.target.value)}
                        placeholder={t.itemPlaceholder}
                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                      />
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5">
                      <select
                        value={inspectionItem.condition}
                        onChange={(e) => updateInspectionItem(room, idx, 'condition', e.target.value)}
                        className={`w-full px-2 py-1 text-sm border rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] ${
                          isDamaged ? 'border-amber-400' : 'border-[var(--border)]'
                        }`}
                      >
                        {conditionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5">
                      <input
                        type="text"
                        value={inspectionItem.notes}
                        onChange={(e) => updateInspectionItem(room, idx, 'notes', e.target.value)}
                        placeholder={t.notesPlaceholder}
                        className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                      />
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-center">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => rowPhotoInputRefs.current[rowKey]?.click()}
                          className={`transition-colors ${
                            photoCount > 0
                              ? 'text-[var(--primary)]'
                              : isDamaged
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-[var(--muted)] hover:text-[var(--primary)]'
                          }`}
                          aria-label={t.rowPhotosLabel}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        {photoCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-[var(--primary)] text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none pointer-events-none">
                            {photoCount > 9 ? '9+' : photoCount}
                          </span>
                        )}
                        <input
                          ref={(el) => { rowPhotoInputRefs.current[rowKey] = el; }}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleRowPhotoChange(rowKey, e.target.files)}
                          className="hidden"
                        />
                      </div>
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(room, idx)}
                        disabled={items.length <= 1}
                        aria-label={t.removeItem}
                        className="text-base leading-none text-[var(--muted)] hover:text-red-600 disabled:opacity-25 transition-colors"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => addRow(room)}
          className="mt-2 text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors"
        >
          {t.addItem}
        </button>
      </div>
    );
  };

  const allItems = [
    ...formData.entranceHalls,
    ...formData.bedroom,
    ...formData.kitchen,
    ...formData.livingRoom,
    ...formData.bathroom,
    ...formData.otherAreas,
  ];

  const countItems = () => allItems.filter((i) => i.item.trim() !== '').length;
  const countIssues = () => allItems.filter((i) => DAMAGED_CONDITIONS.has(i.condition)).length;

  const modeBadge =
    mode === 'joint' ? t.modeBadgeJoint : mode === 'manager' ? t.modeBadgeManager : null;

  const tabs = [
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabInspection },
    { id: 3, label: t.tabPhotos },
    { id: 4, label: t.tabReview },
  ];

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />

      {draftBanner && savedDraft && (
        <div className="bg-[var(--bg-section)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--ink)]">{t.draftFound}</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { updateFields(savedDraft); setDraftBanner(false); }}
              className="px-3 py-1 text-xs font-medium bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors"
            >
              {t.resumeDraft}
            </button>
            <button
              type="button"
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setDraftBanner(false); setSavedDraft(null); }}
              className="px-3 py-1 text-xs font-medium border border-[var(--border)] text-[var(--muted)] rounded-none hover:bg-white transition-colors"
            >
              {t.startFresh}
            </button>
          </div>
        </div>
      )}

      <FormLayout>
        <TabNavigation tabs={tabs} activeTab={currentSection} onTabClick={goToSection} />

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-serif text-xl text-[var(--primary)]">{t.formTitle}</h1>
                {modeBadge && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--primary)] border border-[var(--primary)] px-2 py-0.5 flex-shrink-0">
                    {modeBadge}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--ink)] leading-relaxed">{formIntro}</p>
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
              {/* ── SECTION 1: Tenant Info ── */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader title={t.tenantInfoTitle} sectionNumber={1} totalSections={4} />

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

                  <FormField label={t.tenantEmail}>
                    <FormInput
                      type="email"
                      value={formData.tenantEmail}
                      onChange={(e) => updateField('tenantEmail', e.target.value)}
                      placeholder={t.tenantEmailPlaceholder}
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

                  <FormField label={t.unitSize}>
                    <FormInput
                      type="text"
                      value={formData.unitSize}
                      onChange={(e) => updateField('unitSize', e.target.value)}
                      placeholder={t.unitSizePlaceholder}
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
                        <FormInput type="number" value={formData.unitKeys} onChange={(e) => updateField('unitKeys', parseInt(e.target.value) || 0)} min="0" />
                      </FormField>
                      <FormField label={t.mailboxKeys}>
                        <FormInput type="number" value={formData.mailboxKeys} onChange={(e) => updateField('mailboxKeys', parseInt(e.target.value) || 0)} min="0" />
                      </FormField>
                      <FormField label={t.fobs}>
                        <FormInput type="number" value={formData.fobs} onChange={(e) => updateField('fobs', parseInt(e.target.value) || 0)} min="0" />
                      </FormField>
                    </div>
                  </div>

                  <FormButton type="button" onClick={() => { if (validateSection(1)) nextSection(); }} fullWidth>
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}

              {/* ── SECTION 2: Inspection ── */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader title={t.instructionsTitle} sectionNumber={2} totalSections={4} />

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

                  <FormButton type="button" onClick={() => nextSection()} fullWidth>
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}

              {/* ── SECTION 3: Additional Photos ── */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader title={t.additionalPhotosTitle} sectionNumber={3} totalSections={4} />

                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)]">{t.additionalPhotosIntro}</p>
                    {totalRowPhotoCount > 0 && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        {totalRowPhotoCount} {t.rowPhotosLabel} from the inspection above.
                      </p>
                    )}
                  </div>

                  <FormPhotoUpload
                    maxPhotos={Math.max(0, 20 - totalRowPhotoCount)}
                    label={t.uploadPhotos}
                    helperText={t.uploadHelper}
                    photos={photos}
                    onPhotosChange={setPhotos}
                  />

                  <FormButton type="button" onClick={() => nextSection()} fullWidth>
                    {t.continue}
                  </FormButton>
                </FormSection>
              )}

              {/* ── SECTION 4: Review & Sign ── */}
              {currentSection === 4 && (
                <FormSection>
                  <SectionHeader title={t.reviewTitle} sectionNumber={4} totalSections={4} />

                  <p className="text-sm text-[var(--muted)] mb-6">{t.reviewSummary}</p>

                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewTenantInfo}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-[var(--muted)]">{t.tenantName}:</div>
                      <div className="font-medium">{formData.tenantName}</div>
                      <div className="text-[var(--muted)]">{t.building}:</div>
                      <div className="font-medium">{formData.buildingAddress}</div>
                      <div className="text-[var(--muted)]">{t.unit}:</div>
                      <div className="font-medium">{formData.unitNumber}</div>
                      {formData.unitSize && (
                        <>
                          <div className="text-[var(--muted)]">{t.unitSize}:</div>
                          <div className="font-medium">{formData.unitSize}</div>
                        </>
                      )}
                      <div className="text-[var(--muted)]">{t.moveInDate}:</div>
                      <div className="font-medium">{formData.moveInDate}</div>
                      <div className="text-[var(--muted)]">{t.keysReceived}:</div>
                      <div className="font-medium">{formData.unitKeys} unit, {formData.mailboxKeys} mailbox, {formData.fobs} fobs</div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewInspection}</h4>
                    <div className="text-sm space-y-1">
                      <p className="text-[var(--ink)]">{countItems()} {t.itemsInspected}</p>
                      <p className="text-[var(--ink)]">{countIssues()} {t.issuesNoted}</p>
                      {totalRowPhotoCount > 0 && (
                        <p className="text-[var(--ink)]">{totalRowPhotoCount} {t.rowPhotosLabel}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewPhotos}</h4>
                    {totalPhotoCount > 0 ? (
                      <p className="text-sm text-[var(--ink)]">{totalPhotoCount} photo(s) attached</p>
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
                      {mode === 'tenant' ? (
                        <p className="text-sm text-[var(--muted)] italic">{t.managerAckPending}</p>
                      ) : (
                        <>
                          <p className="text-sm text-[var(--ink)] italic mb-4">{t.managerAckText}</p>
                          <SignatureCanvasComponent
                            label="Manager's Signature"
                            value={managerSignature}
                            onSave={(dataUrl) => setManagerSignature(dataUrl)}
                          />
                          <p className="text-xs text-[var(--muted)] mt-3">{t.signatureDate}: {formData.moveInDate}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tenant Acknowledgment */}
                  <div className="border border-[var(--border)] rounded-sm mb-4 overflow-hidden">
                    <div className="bg-[var(--primary)] px-4 py-2">
                      <p className="text-xs font-semibold text-white uppercase tracking-wide">{t.tenantAckTitle}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-[var(--ink)] mb-4">{t.tenantAckText}</p>
                      {mode === 'manager' ? (
                        <div className="pt-3 border-t border-[var(--border)]">
                          <p className="text-xs text-[var(--muted)]">
                            Tenant Signature _________________________________________________ Date __________
                          </p>
                          <p className="text-xs text-[var(--muted)] mt-2 italic">{t.tenantSigPending}</p>
                        </div>
                      ) : (
                        <>
                          <SignatureCanvasComponent
                            label={t.signature}
                            value={signature}
                            onSave={(dataUrl) => setSignature(dataUrl)}
                          />
                          <p className="text-xs text-[var(--muted)] mt-3">{t.signatureDate}: {formData.moveInDate}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <FormCheckbox
                    label={t.finalConfirm}
                    checked={formData.finalConfirm}
                    onChange={(e) => updateField('finalConfirm', e.target.checked)}
                    required
                  />

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-sm p-4 mt-4">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <FormButton type="submit" variant="success" fullWidth loading={isSubmitting}>
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
