'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { petApprovalTranslations } from '@/lib/petApprovalTranslations';
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

interface PetData {
  petType: string;
  petBreed: string;
  petName: string;
  petWeight: string;
  petAge: string;
  petColor: string;
  petSpayed: boolean | null;
  petVaccinations: boolean | null;
}

interface PetApprovalFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  email: string;
  dateSubmitted: string;
  pets: PetData[];
  finalConfirm: boolean;
}

const emptyPet: PetData = {
  petType: '',
  petBreed: '',
  petName: '',
  petWeight: '',
  petAge: '',
  petColor: '',
  petSpayed: null,
  petVaccinations: null,
};

const initialFormData: PetApprovalFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  email: '',
  dateSubmitted: new Date().toISOString().split('T')[0],
  pets: [{ ...emptyPet }],
  finalConfirm: false,
};

function PetApprovalFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [showPrintable, setShowPrintable] = useState(false);
  
  const MAX_PETS = 5;
  
  const { formData, updateField } = useFormData(initialFormData);
  const [petPhotos, setPetPhotos] = useState<File[][]>([[]]);
  const [petVaccinationDocs, setPetVaccinationDocs] = useState<(File | null)[]>([null]);
  const [petSpayNeuterDocs, setPetSpayNeuterDocs] = useState<(File | null)[]>([null]);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, goToSection } = useFormSection(4);
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<PetApprovalFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    formDataToSend.append('signature', signature);
    
    petPhotos.forEach((photos, petIndex) => {
      photos.forEach((photo, photoIndex) => {
        formDataToSend.append(`pet_${petIndex}_photo_${photoIndex}`, photo);
      });
    });

    petVaccinationDocs.forEach((doc, petIndex) => {
      if (doc) {
        formDataToSend.append(`pet_${petIndex}_vaccination`, doc);
      }
    });

    petSpayNeuterDocs.forEach((doc, petIndex) => {
      if (doc) {
        formDataToSend.append(`pet_${petIndex}_spay_neuter`, doc);
      }
    });
    
    const response = await fetch('/api/forms/pet-approval', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = petApprovalTranslations[language];
  
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
  
  const handlePetChange = (index: number, field: keyof PetData, value: any) => {
    const newPets = [...formData.pets];
    newPets[index] = { ...newPets[index], [field]: value };
    updateField('pets', newPets);
  };
  
  const addPet = () => {
    if (formData.pets.length < MAX_PETS) {
      updateField('pets', [...formData.pets, { ...emptyPet }]);
      setPetPhotos([...petPhotos, []]);
      setPetVaccinationDocs([...petVaccinationDocs, null]);
      setPetSpayNeuterDocs([...petSpayNeuterDocs, null]);
    }
  };
  
  const removePet = (index: number) => {
    if (formData.pets.length > 1) {
      updateField('pets', formData.pets.filter((_, i) => i !== index));
      setPetPhotos(petPhotos.filter((_, i) => i !== index));
      setPetVaccinationDocs(petVaccinationDocs.filter((_, i) => i !== index));
      setPetSpayNeuterDocs(petSpayNeuterDocs.filter((_, i) => i !== index));
    }
  };
  
  const handlePetPhotosChange = (petIndex: number, photos: File[]) => {
    const newPetPhotos = [...petPhotos];
    newPetPhotos[petIndex] = photos;
    setPetPhotos(newPetPhotos);
  };

  const handlePetVaccinationDocChange = (petIndex: number, file: File | null) => {
    const newDocs = [...petVaccinationDocs];
    newDocs[petIndex] = file;
    setPetVaccinationDocs(newDocs);
  };

  const handlePetSpayNeuterDocChange = (petIndex: number, file: File | null) => {
    const newDocs = [...petSpayNeuterDocs];
    newDocs[petIndex] = file;
    setPetSpayNeuterDocs(newDocs);
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
      for (const pet of formData.pets) {
        if (!pet.petType || !pet.petName || !pet.petWeight || !pet.petAge || !pet.petColor) {
          return false;
        }
        if (pet.petSpayed === null || pet.petVaccinations === null) {
          return false;
        }
      }
      return true;
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
    { id: 1, label: t.tenantInfoTitle },
    { id: 2, label: t.petInfoTitle },
    { id: 3, label: t.photosTitle },
    { id: 4, label: t.reviewTitle },
  ];
  
  const formTemplate = getFormById(12); // Pet Approval Request Form
  
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
              
              {/* Section 2: Pet Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.petDetailsTitle}
                    sectionNumber={2}
                    totalSections={4}
                  />
                  
                  <div className="space-y-6">
                    {formData.pets.map((pet, idx) => (
                      <div key={idx} className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-[var(--ink)]">{t.petNumber}{idx + 1}</h4>
                          {formData.pets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePet(idx)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
                            >
                              {t.removePet}
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label={t.petType} required>
                              <FormInput
                                type="text"
                                value={pet.petType}
                                onChange={(e) => handlePetChange(idx, 'petType', e.target.value)}
                                placeholder={t.petTypePlaceholder}
                                required
                              />
                            </FormField>
                            
                            <FormField label={t.petBreed}>
                              <FormInput
                                type="text"
                                value={pet.petBreed}
                                onChange={(e) => handlePetChange(idx, 'petBreed', e.target.value)}
                                placeholder={t.petBreedPlaceholder}
                              />
                            </FormField>
                          </div>
                          
                          <FormField label={t.petName} required>
                            <FormInput
                              type="text"
                              value={pet.petName}
                              onChange={(e) => handlePetChange(idx, 'petName', e.target.value)}
                              placeholder={t.petNamePlaceholder}
                              required
                            />
                          </FormField>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField label={t.petWeight} required>
                              <FormInput
                                type="number"
                                value={pet.petWeight}
                                onChange={(e) => handlePetChange(idx, 'petWeight', e.target.value)}
                                placeholder={t.petWeightPlaceholder}
                                min="0"
                                required
                              />
                            </FormField>
                            
                            <FormField label={t.petAge} required>
                              <FormInput
                                type="text"
                                value={pet.petAge}
                                onChange={(e) => handlePetChange(idx, 'petAge', e.target.value)}
                                placeholder={t.petAgePlaceholder}
                                required
                              />
                            </FormField>
                            
                            <FormField label={t.petColor} required>
                              <FormInput
                                type="text"
                                value={pet.petColor}
                                onChange={(e) => handlePetChange(idx, 'petColor', e.target.value)}
                                placeholder={t.petColorPlaceholder}
                                required
                              />
                            </FormField>
                          </div>
                          
                          <FormField label={t.petSpayed} required>
                            <FormRadioGroup
                              name={`pet_${idx}_spayed`}
                              options={[
                                { value: 'yes', label: t.yes },
                                { value: 'no', label: t.no },
                              ]}
                              value={pet.petSpayed === true ? 'yes' : pet.petSpayed === false ? 'no' : ''}
                              onChange={(value) => handlePetChange(idx, 'petSpayed', value === 'yes')}
                              direction="horizontal"
                            />
                          </FormField>
                          
                          <FormField label={t.petVaccinations} required>
                            <FormRadioGroup
                              name={`pet_${idx}_vaccinations`}
                              options={[
                                { value: 'yes', label: t.yes },
                                { value: 'no', label: t.no },
                              ]}
                              value={pet.petVaccinations === true ? 'yes' : pet.petVaccinations === false ? 'no' : ''}
                              onChange={(value) => handlePetChange(idx, 'petVaccinations', value === 'yes')}
                              direction="horizontal"
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}
                    
                    {formData.pets.length < MAX_PETS ? (
                      <button
                        type="button"
                        onClick={addPet}
                        className="w-full py-2.5 px-4 border-2 border-dashed border-[var(--primary)]/30 rounded-sm text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50 transition-colors text-sm font-medium"
                      >
                        + {t.addPet}
                      </button>
                    ) : (
                      <p className="text-xs text-center text-[var(--muted)]">{t.maxPetsReached}</p>
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
                  
                  <div className="space-y-6">
                    {formData.pets.map((pet, idx) => (
                      <div key={idx} className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--ink)]">
                          {pet.petName || `${t.petNumber}${idx + 1}`}
                        </h4>
                        
                        <FormPhotoUpload
                          maxPhotos={3}
                          label={t.uploadPhotos}
                          helperText={t.uploadHelper}
                          photos={petPhotos[idx] || []}
                          onPhotosChange={(photos) => handlePetPhotosChange(idx, photos)}
                        />

                        <FormField label={t.uploadVaccination}>
                          <FormInput
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handlePetVaccinationDocChange(idx, e.target.files?.[0] || null)}
                          />
                          {petVaccinationDocs[idx] && (
                            <p className="text-xs text-[var(--muted)] mt-1">{petVaccinationDocs[idx]?.name}</p>
                          )}
                        </FormField>

                        <FormField label={t.uploadSpayNeuter}>
                          <FormInput
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handlePetSpayNeuterDocChange(idx, e.target.files?.[0] || null)}
                          />
                          {petSpayNeuterDocs[idx] && (
                            <p className="text-xs text-[var(--muted)] mt-1">{petSpayNeuterDocs[idx]?.name}</p>
                          )}
                        </FormField>
                      </div>
                    ))}
                  </div>
                  
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
                      <div className="font-medium">{formData.phone}</div>
                      {formData.email && (
                        <>
                          <div className="text-[var(--muted)]">{t.email}:</div>
                          <div className="font-medium">{formData.email}</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Pets Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewPets}</h4>
                    <div className="space-y-3">
                      {formData.pets.map((pet, idx) => (
                        <div key={idx} className="border-l-2 border-[var(--primary)] pl-3">
                          <p className="font-medium text-sm">{pet.petName}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {pet.petType} • {pet.petBreed} • {pet.petWeight} lbs • {pet.petAge} years old
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {pet.petColor} • {pet.petSpayed ? 'Spayed/Neutered' : 'Not spayed/neutered'} • 
                            {pet.petVaccinations ? ' Vaccinations current' : ' Vaccinations not current'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Photos Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] mb-6">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewPhotos}</h4>
                    {petPhotos.some(photos => photos.length > 0) ? (
                      <div className="space-y-2">
                        {petPhotos.map((photos, idx) => (
                          photos.length > 0 && (
                            <p key={idx} className="text-sm text-[var(--ink)]">
                              {formData.pets[idx].petName}: {photos.length} photo(s)
                            </p>
                          )
                        ))}
                      </div>
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

export default function PetApprovalForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <PetApprovalFormContent />
    </Suspense>
  );
}
