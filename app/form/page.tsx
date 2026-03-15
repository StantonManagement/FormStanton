'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from '@/lib/translations';
import { buildings, buildingToLLC, buildingsWithParking, buildingUnits, newAcquisitionBuildings } from '@/lib/buildings';
import { PET_ADDENDUM, VEHICLE_ADDENDUM } from '@/lib/addendums';
import { policyContent, petRentTable, llcTable, parkingFeeTable } from '@/lib/policyContent';
import { allowsMultipleVehicles } from '@/lib/buildingAssetIds';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import InfoTable from '@/components/InfoTable';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import { FormPhoneInput } from '@/components/form';
import { formatPhone } from '@/lib/formUtils';
import SectionHeader from '@/components/SectionHeader';
import InsuranceUpdateModal from '@/components/InsuranceUpdateModal';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';

function LanguageLanding({ onSelect }: { onSelect: (lang: Language) => void }) {
  return (
    <>
      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="/Stanton-logo.PNG"
                alt="Stanton Management"
                className="max-w-[280px] w-full h-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--primary)] mb-1">Tenant Onboarding Form</h1>
            <p className="text-[var(--muted)] text-sm tracking-wide uppercase">Stanton Management LLC</p>
          </div>

          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden mb-8 p-6 sm:p-8">
            <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
              As you may know, Stanton Management is now managing your building. We want to introduce you to a few new changes and requirements that may have not been required by the prior owner/manager.
            </p>
            <p className="text-center text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Please select your language to continue:
            </p>
            <div className="space-y-3">
              <button onClick={() => onSelect('en')} className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base">
                Continue in English
              </button>
              <button onClick={() => onSelect('es')} className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base">
                Continuar en Español
              </button>
              <button onClick={() => onSelect('pt')} className="w-full bg-[var(--primary)] text-white py-3.5 px-6 rounded-sm hover:bg-[var(--primary-light)] transition-colors font-medium text-base">
                Continuar em Português
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Your information is transmitted securely</span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function FormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);

  const MAX_PETS = 5;
  const emptyPet = {
    petType: '',
    petName: '',
    petBreed: '',
    petWeight: '',
    petColor: '',
    petSpayed: null as boolean | null,
    petVaccinationsCurrent: null as boolean | null,
  };

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    phoneIsNew: false,
    buildingAddress: '',
    unitNumber: '',
    hasPets: null as boolean | null,
    pets: [{ ...emptyPet }],
    petSignatureDate: new Date().toISOString().split('T')[0],
    hasInsurance: null as boolean | null,
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceUploadPending: false,
    addInsuranceToRent: false,
    hasVehicle: null as boolean | null,
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
    wantsAdditionalVehicle: null as boolean | null,
    additionalVehicles: [] as { vehicleMake: string; vehicleModel: string; vehicleYear: string; vehicleColor: string; vehiclePlate: string }[],
    vehicleSignatureDate: new Date().toISOString().split('T')[0],
    finalConfirm: false,
  });

  const [petFiles, setPetFiles] = useState<{ vaccination: File | null; photo: File | null }[]>([{ vaccination: null, photo: null }]);

  const [files, setFiles] = useState({
    insuranceProof: null as File | null,
  });

  const [signatures, setSignatures] = useState({
    pet: '',
    vehicle: '',
    insurance: '',
  });

  const [currentSection, setCurrentSection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phoneValidationError, setPhoneValidationError] = useState('');
  const [emailValidationError, setEmailValidationError] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [signatureErrors, setSignatureErrors] = useState({
    pet: '',
    vehicle: '',
    insurance: '',
  });
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);

  if (!showForm) {
    return <LanguageLanding onSelect={(lang) => { setLanguage(lang); setShowForm(true); }} />;
  }

  const t = translations[language];
  const hasParking = buildingsWithParking.has(formData.buildingAddress);
  const isNewAcquisition = newAcquisitionBuildings.has(formData.buildingAddress);
  const canHaveMultipleVehicles = allowsMultipleVehicles(formData.buildingAddress);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    setFiles(prev => ({ ...prev, [field]: file }));
  };

  const handlePetChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newPets = [...prev.pets];
      newPets[index] = { ...newPets[index], [field]: value };
      return { ...prev, pets: newPets };
    });
  };

  const handlePetFileChange = (index: number, field: 'vaccination' | 'photo', file: File | null) => {
    setPetFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], [field]: file };
      return newFiles;
    });
  };

  const addPet = () => {
    if (formData.pets.length < MAX_PETS) {
      setFormData(prev => ({ ...prev, pets: [...prev.pets, { ...emptyPet }] }));
      setPetFiles(prev => [...prev, { vaccination: null, photo: null }]);
    }
  };

  const removePet = (index: number) => {
    if (formData.pets.length > 1) {
      setFormData(prev => ({
        ...prev,
        pets: prev.pets.filter((_, i) => i !== index),
      }));
      setPetFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSignature = (type: 'pet' | 'vehicle' | 'insurance', dataUrl: string) => {
    setSignatures(prev => ({ ...prev, [type]: dataUrl }));
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateSection = (section: number): boolean => {
    setSectionError('');
    setPhoneValidationError('');
    setEmailValidationError('');

    if (section === 1) {
      if (!formData.fullName.trim() || !formData.buildingAddress || !formData.unitNumber.trim()) {
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.phone.length !== 10) {
        setPhoneValidationError(t.phoneValidationError);
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.email.trim() && !isValidEmail(formData.email.trim())) {
        setEmailValidationError(t.emailValidationError);
        setSectionError(t.emailValidationError);
        return false;
      }
      return true;
    }

    if (section === 2) {
      if (!hasParking) return true;
      if (formData.hasVehicle === null) {
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.hasVehicle === true) {
        if (!formData.vehicleMake || !formData.vehicleModel || !formData.vehicleYear || !formData.vehicleColor || !formData.vehiclePlate) {
          setSectionError(t.incompleteVehicleEntry);
          return false;
        }
        // Validate additional vehicles
        for (const av of formData.additionalVehicles) {
          if (!av.vehicleMake || !av.vehicleModel || !av.vehicleYear || !av.vehicleColor || !av.vehiclePlate) {
            setSectionError(t.incompleteVehicleEntry);
            return false;
          }
        }
        if (!signatures.vehicle) {
          setSectionError(t.signatureRequired);
          return false;
        }
      }
      return true;
    }

    if (section === 3) {
      if (formData.hasPets === null) {
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.hasPets === true) {
        for (const pet of formData.pets) {
          if (!pet.petType || !pet.petName || !pet.petBreed || !pet.petWeight || !pet.petColor || pet.petSpayed === null || pet.petVaccinationsCurrent === null) {
            setSectionError(t.incompletePetEntry);
            return false;
          }
        }
        if (!signatures.pet) {
          setSectionError(t.signatureRequired);
          return false;
        }
      }
      if (formData.hasPets === false && !signatures.pet) {
        setSectionError(t.signatureRequired);
        return false;
      }
      return true;
    }

    if (section === 4) {
      if (formData.hasInsurance === null) {
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.hasInsurance === true) {
        if (!formData.insuranceProvider.trim() || !formData.insurancePolicyNumber.trim()) {
          setSectionError(t.requiredFieldsMissing);
          return false;
        }
      }
      if (formData.addInsuranceToRent && !signatures.insurance) {
        setSectionError(t.signatureRequired);
        return false;
      }
      return true;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    let hasValidationErrors = false;
    const newSignatureErrors = { pet: '', vehicle: '', insurance: '' };

    // Validate phone number is exactly 10 digits
    if (formData.phone.length !== 10) {
      setPhoneValidationError(t.phoneValidationError);
      setSubmitError(language === 'en' ? 'Phone number must be exactly 10 digits' : language === 'es' ? 'El número de teléfono debe tener exactamente 10 dígitos' : 'O número de telefone deve ter exatamente 10 dígitos');
      setIsSubmitting(false);
      setCurrentSection(1);
      return;
    }

    // Validate email format if provided
    if (formData.email.trim() && !isValidEmail(formData.email.trim())) {
      setEmailValidationError(t.emailValidationError);
      setSubmitError(t.emailValidationError);
      setIsSubmitting(false);
      setCurrentSection(1);
      return;
    }

    // Validate pet entries are complete
    if (formData.hasPets === true) {
      for (const pet of formData.pets) {
        if (!pet.petType || !pet.petName || !pet.petBreed || !pet.petWeight || !pet.petColor || pet.petSpayed === null || pet.petVaccinationsCurrent === null) {
          setSubmitError(t.incompletePetEntry);
          setIsSubmitting(false);
          setCurrentSection(3);
          return;
        }
      }
    }

    // Validate vehicle fields are complete (only for buildings with parking)
    if (hasParking && formData.hasVehicle === true) {
      if (!formData.vehicleMake || !formData.vehicleModel || !formData.vehicleYear || !formData.vehicleColor || !formData.vehiclePlate) {
        setSubmitError(t.incompleteVehicleEntry);
        setIsSubmitting(false);
        setCurrentSection(2);
        return;
      }
      // Validate additional vehicles
      for (const av of formData.additionalVehicles) {
        if (!av.vehicleMake || !av.vehicleModel || !av.vehicleYear || !av.vehicleColor || !av.vehiclePlate) {
          setSubmitError(t.incompleteVehicleEntry);
          setIsSubmitting(false);
          setCurrentSection(2);
          return;
        }
      }
    }

    if (formData.hasPets !== null && !signatures.pet) {
      newSignatureErrors.pet = t.signatureRequired;
      hasValidationErrors = true;
    }

    if (hasParking && formData.hasVehicle === true && !signatures.vehicle) {
      newSignatureErrors.vehicle = t.signatureRequired;
      hasValidationErrors = true;
    }

    if (formData.addInsuranceToRent && !signatures.insurance) {
      newSignatureErrors.insurance = t.signatureRequired;
      hasValidationErrors = true;
    }

    if (hasValidationErrors) {
      setSignatureErrors(newSignatureErrors);
      setSubmitError(t.signatureRequired);
      setIsSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('language', language);
      formDataToSend.append('formData', JSON.stringify(formData));
      formDataToSend.append('signatures', JSON.stringify(signatures));
      
      // Append per-pet files with indexed keys
      petFiles.forEach((pf, i) => {
        if (pf.vaccination) formDataToSend.append(`petVaccination_${i}`, pf.vaccination);
        if (pf.photo) formDataToSend.append(`petPhoto_${i}`, pf.photo);
      });
      if (files.insuranceProof) formDataToSend.append('insuranceProof', files.insuranceProof);

      const response = await fetch('/api/submit', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Submission failed');
      }

      // Check for warnings
      if (result.warnings) {
        let warningMessage = '';
        if (result.warnings.emailFailed) {
          warningMessage += language === 'en' 
            ? 'Note: Confirmation email could not be sent. Please contact the office to confirm your submission. ' 
            : language === 'es'
            ? 'Nota: No se pudo enviar el correo de confirmación. Comuníquese con la oficina para confirmar su envío. '
            : 'Nota: Não foi possível enviar o e-mail de confirmação. Entre em contato com o escritório para confirmar seu envio. ';
        }
        if (result.warnings.documentsFailed) {
          warningMessage += language === 'en'
            ? 'Note: Document generation encountered an issue. The office will generate your documents manually. '
            : language === 'es'
            ? 'Nota: La generación de documentos encontró un problema. La oficina generará sus documentos manualmente. '
            : 'Nota: A geração de documentos encontrou um problema. O escritório gerará seus documentos manualmente. ';
        }
        if (warningMessage) {
          setSubmitError(warningMessage);
        }
      }

      setSubmitSuccess(true);
    } catch (error: any) {
      setSubmitError(error.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-[var(--border)] rounded-sm shadow-sm p-8 max-w-md w-full text-center"
          >
            <div className="mb-6">
              <motion.svg 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mx-auto h-16 w-16 text-[var(--success)]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </motion.svg>
            </div>
            <h2 className="font-serif text-2xl text-[var(--primary)] mb-3">
              {language === 'en' ? 'Thank You!' : language === 'es' ? '¡Gracias!' : 'Obrigado!'}
            </h2>
            <p className="text-[var(--muted)] leading-relaxed">
              {language === 'en' 
                ? 'Your form has been submitted successfully. You will receive a confirmation email shortly.'
                : language === 'es'
                ? 'Su formulario ha sido enviado exitosamente. Recibirá un correo de confirmación pronto.'
                : 'Seu formulário foi enviado com sucesso. Você receberá um email de confirmação em breve.'}
            </p>
            <div className="mt-6 pt-6 border-t border-[var(--divider)]">
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Your information is transmitted securely</span>
              </div>
            </div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  const totalSections = 4;

  const tabs = [
    { id: 1, label: language === 'en' ? 'Resident Info' : language === 'es' ? 'Información' : 'Informações' },
    { id: 2, label: language === 'en' ? 'Vehicle' : language === 'es' ? 'Vehículo' : 'Veículo' },
    { id: 3, label: language === 'en' ? 'Pets' : language === 'es' ? 'Mascotas' : 'Animais' },
    { id: 4, label: language === 'en' ? 'Insurance' : language === 'es' ? 'Seguro' : 'Seguro' },
    { id: 5, label: language === 'en' ? 'Review' : language === 'es' ? 'Revisar' : 'Revisar' },
  ];

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />

      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden">

            <TabNavigation
              tabs={tabs}
              activeTab={currentSection}
              onTabClick={setCurrentSection}
            />

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              
              {/* Intro Section - Shows after building selection */}
              {formData.buildingAddress && (
                <div className="mb-8">
                  <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
                    <p className="text-sm text-[var(--ink)] mb-3 leading-relaxed">
                      {isNewAcquisition ? policyContent[language].introText : policyContent[language].existingTenantIntroText}
                    </p>
                    <p className="font-semibold text-[var(--primary)] mb-2 text-sm">
                      {isNewAcquisition ? policyContent[language].introHeading : policyContent[language].existingTenantIntroHeading}
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-[var(--ink)]">
                      {(isNewAcquisition ? t.introItems : t.existingTenantIntroItems).map((item, idx) => (
                        <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
                      ))}
                    </ul>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setIsInsuranceModalOpen(true)}
                        className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)] font-medium underline"
                      >
                        {language === 'en' ? 'Already submitted? Upload insurance documents here' :
                         language === 'es' ? '¿Ya envió el formulario? Suba documentos de seguro aquí' :
                         'Já enviou? Carregar documentos de seguro aqui'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {currentSection === 1 && (
                    <div className="space-y-6">
                      <SectionHeader
                        title={language === 'en' ? 'Resident Information' : language === 'es' ? 'Información del Residente' : 'Informações do Residente'}
                        sectionNumber={1}
                        totalSections={totalSections}
                      />
                      
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.fullName} <span className="text-[var(--error)]">*</span></span>
                          <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                            placeholder="Enter your full legal name"
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          <p className="text-xs text-[var(--muted)] mt-1">As it appears on your lease</p>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.phone} <span className="text-[var(--error)]">*</span></span>
                          <FormPhoneInput
                            value={formData.phone}
                            onChange={(digits) => {
                              handleInputChange('phone', digits);
                              setPhoneValidationError('');
                            }}
                            placeholder="(860) 555-0123"
                            error={!!phoneValidationError}
                            errorMessage={phoneValidationError}
                            required
                          />
                          <label className="flex items-center space-x-2 mt-2">
                            <input
                              type="checkbox"
                              checked={formData.phoneIsNew}
                              onChange={(e) => handleInputChange('phoneIsNew', e.target.checked)}
                              className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4"
                            />
                            <span className="text-sm text-[var(--muted)]">{t.phoneNew}</span>
                          </label>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.email}</span>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => {
                              handleInputChange('email', e.target.value);
                              if (e.target.value.trim() && !isValidEmail(e.target.value.trim())) {
                                setEmailValidationError(t.emailValidationError);
                              } else {
                                setEmailValidationError('');
                              }
                            }}
                            placeholder="your.email@example.com"
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          {emailValidationError && (
                            <p className="text-xs text-[var(--error)] mt-1">{emailValidationError}</p>
                          )}
                          <p className="text-xs text-[var(--muted)] mt-1">{language === 'en' ? 'Optional - but recommended for important updates' : language === 'es' ? 'Opcional - pero recomendado para actualizaciones importantes' : 'Opcional - mas recomendado para atualizações importantes'}</p>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.building} <span className="text-[var(--error)]">*</span></span>
                          <BuildingAutocomplete
                            value={formData.buildingAddress}
                            onChange={(val) => { handleInputChange('buildingAddress', val); handleInputChange('unitNumber', ''); }}
                            buildings={buildings}
                            placeholder={language === 'en' ? '-- Search your building --' : language === 'es' ? '-- Busque su edificio --' : '-- Pesquise seu prédio --'}
                            required
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.unit} <span className="text-[var(--error)]">*</span></span>
                          {formData.buildingAddress && buildingUnits[formData.buildingAddress] ? (
                            <div className="relative mt-1">
                              <select
                                required
                                value={formData.unitNumber}
                                onChange={(e) => handleInputChange('unitNumber', e.target.value)}
                                className="block w-full appearance-none rounded-none border border-[var(--border)] bg-[var(--bg-input)] text-[var(--ink)] px-4 py-3 pr-10 text-base focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              >
                                <option value="">{language === 'en' ? '-- Select your unit --' : language === 'es' ? '-- Seleccione su unidad --' : '-- Selecione sua unidade --'}</option>
                                {buildingUnits[formData.buildingAddress].map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <svg className="h-5 w-5 text-[var(--muted)]" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <input
                              type="text"
                              required
                              value={formData.unitNumber}
                              onChange={(e) => handleInputChange('unitNumber', e.target.value)}
                              placeholder={language === 'en' ? 'Enter your unit number' : language === 'es' ? 'Ingrese su número de unidad' : 'Digite o número da sua unidade'}
                              className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                            />
                          )}
                        </label>

                        {sectionError && currentSection === 1 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700">{sectionError}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => { if (validateSection(1)) setCurrentSection(2); }}
                          className="w-full bg-[var(--primary)] text-white py-3 sm:py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition text-base font-medium"
                        >
                          {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSection === 3 && (
                    <div className="space-y-6">
                      <SectionHeader
                        title={language === 'en' ? 'Pet Information' : language === 'es' ? 'Información de Mascotas' : 'Informações sobre Animais'}
                        sectionNumber={3}
                        totalSections={totalSections}
                      />

                      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded-sm">
                        <h3 className="font-bold text-[var(--ink)] mb-2">{policyContent[language].petPolicyHeading}</h3>
                        <p className="text-sm text-[var(--ink)] whitespace-pre-line" dangerouslySetInnerHTML={{ __html: policyContent[language].petPolicyText }} />
                      </div>

                      <div className="bg-white border border-[var(--border)] p-3 sm:p-4 rounded-sm">
                        <InfoTable 
                          headers={policyContent[language].petRentTableHeaders}
                          rows={petRentTable}
                          className="mb-0"
                        />
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-[var(--ink)]">{t.petQuestion} <span className="text-[var(--error)]">*</span></p>
                        <div className="flex space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="hasPets"
                              required
                              checked={formData.hasPets === true}
                              onChange={() => handleInputChange('hasPets', true)}
                              className="text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="hasPets"
                              required
                              checked={formData.hasPets === false}
                              onChange={() => handleInputChange('hasPets', false)}
                              className="text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <span className="text-sm text-[var(--ink)]">{t.no}</span>
                          </label>
                        </div>
                      </div>

                      {formData.hasPets === true && (
                        <div className="space-y-4">
                          {formData.pets.map((pet, idx) => (
                            <div key={idx} className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] relative">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-[var(--ink)]">{t.petNumber}{idx + 1}</h4>
                                {formData.pets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removePet(idx)}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                  >
                                    {t.removePet}
                                  </button>
                                )}
                              </div>

                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-[var(--ink)]">{t.petType} <span className="text-[var(--error)]">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petType_${idx}`}
                                        value="dog"
                                        checked={pet.petType === 'dog'}
                                        onChange={(e) => handlePetChange(idx, 'petType', e.target.value)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.dog}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petType_${idx}`}
                                        value="cat"
                                        checked={pet.petType === 'cat'}
                                        onChange={(e) => handlePetChange(idx, 'petType', e.target.value)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.cat}</span>
                                    </label>
                                  </div>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.petName} <span className="text-[var(--error)]">*</span></span>
                                  <input
                                    type="text"
                                    value={pet.petName}
                                    onChange={(e) => handlePetChange(idx, 'petName', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.petBreed} <span className="text-[var(--error)]">*</span></span>
                                  <input
                                    type="text"
                                    value={pet.petBreed}
                                    onChange={(e) => handlePetChange(idx, 'petBreed', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  />
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                  <label className="block">
                                    <span className="text-sm font-medium text-[var(--ink)]">{t.petWeight} <span className="text-[var(--error)]">*</span></span>
                                    <input
                                      type="number"
                                      value={pet.petWeight}
                                      onChange={(e) => handlePetChange(idx, 'petWeight', e.target.value)}
                                      className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-sm font-medium text-[var(--ink)]">{t.petColor} <span className="text-[var(--error)]">*</span></span>
                                    <input
                                      type="text"
                                      value={pet.petColor}
                                      onChange={(e) => handlePetChange(idx, 'petColor', e.target.value)}
                                      className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                    />
                                  </label>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-[var(--ink)]">{t.petSpayed} <span className="text-[var(--error)]">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petSpayed_${idx}`}
                                        checked={pet.petSpayed === true}
                                        onChange={() => handlePetChange(idx, 'petSpayed', true)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petSpayed_${idx}`}
                                        checked={pet.petSpayed === false}
                                        onChange={() => handlePetChange(idx, 'petSpayed', false)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.no}</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-[var(--ink)]">{t.petVaccines} <span className="text-[var(--error)]">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petVaccines_${idx}`}
                                        checked={pet.petVaccinationsCurrent === true}
                                        onChange={() => handlePetChange(idx, 'petVaccinationsCurrent', true)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petVaccines_${idx}`}
                                        checked={pet.petVaccinationsCurrent === false}
                                        onChange={() => handlePetChange(idx, 'petVaccinationsCurrent', false)}
                                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-sm text-[var(--ink)]">{t.no}</span>
                                    </label>
                                  </div>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.petVaccineUpload} <span className="text-[var(--muted)] font-normal">{t.optional}</span></span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => handlePetFileChange(idx, 'vaccination', e.target.files?.[0] || null)}
                                    className="mt-1 block w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/5 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/10"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.petPhoto} <span className="text-[var(--muted)] font-normal">{t.optional}</span></span>
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png"
                                    onChange={(e) => handlePetFileChange(idx, 'photo', e.target.files?.[0] || null)}
                                    className="mt-1 block w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/5 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/10"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}

                          {formData.pets.length < MAX_PETS ? (
                            <button
                              type="button"
                              onClick={addPet}
                              className="w-full py-2.5 px-4 border-2 border-dashed border-[var(--primary)]/30 rounded-sm text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50 transition-colors text-sm font-medium"
                            >
                              + {t.addAnotherPet}
                            </button>
                          ) : (
                            <p className="text-xs text-center text-[var(--muted)]">{t.maxPetsReached}</p>
                          )}
                        </div>
                      )}

                      {language === 'en' && (
                        <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                          <h3 className="font-semibold text-[var(--ink)] mb-2">Pet Addendum</h3>
                          <p className="text-sm text-[var(--ink)] whitespace-pre-line">{PET_ADDENDUM}</p>
                        </div>
                      )}

                      {formData.hasPets === true && (
                        <div className="space-y-4">
                          <label className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              required
                              className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <span className="text-sm text-[var(--ink)]">{t.petAgree}</span>
                          </label>
                          <div className="space-y-2">
                            <SignatureCanvasComponent
                              label={t.signature}
                              value={signatures.pet}
                              onSave={(dataUrl) => {
                                handleSignature('pet', dataUrl);
                                setSignatureErrors(prev => ({ ...prev, pet: '' }));
                              }}
                            />
                            {signatureErrors.pet && (
                              <p className="text-sm text-red-600">{signatureErrors.pet}</p>
                            )}
                          </div>
                          <label className="block">
                            <span className="text-sm font-medium text-[var(--ink)]">{t.date} <span className="text-[var(--error)]">*</span></span>
                            <input
                              type="date"
                              required
                              value={formData.petSignatureDate}
                              onChange={(e) => handleInputChange('petSignatureDate', e.target.value)}
                              className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                            />
                          </label>
                        </div>
                      )}

                      {formData.hasPets === false && (
                        <div className="space-y-4">
                          <label className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              required
                              className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <span className="text-sm text-[var(--ink)]">{t.petAgreeNone}</span>
                          </label>
                          <div className="space-y-2">
                            <SignatureCanvasComponent
                              label={t.signature}
                              value={signatures.pet}
                              onSave={(dataUrl) => {
                                handleSignature('pet', dataUrl);
                                setSignatureErrors(prev => ({ ...prev, pet: '' }));
                              }}
                            />
                            {signatureErrors.pet && (
                              <p className="text-sm text-red-600">{signatureErrors.pet}</p>
                            )}
                          </div>
                          <label className="block">
                            <span className="text-sm font-medium text-[var(--ink)]">{t.date} <span className="text-[var(--error)]">*</span></span>
                            <input
                              type="date"
                              required
                              value={formData.petSignatureDate}
                              onChange={(e) => handleInputChange('petSignatureDate', e.target.value)}
                              className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                            />
                          </label>
                        </div>
                      )}

                      {sectionError && currentSection === 3 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-700">{sectionError}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => { if (validateSection(3)) setCurrentSection(4); }}
                        className="w-full bg-[var(--primary)] text-white py-3 sm:py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition text-base font-medium"
                      >
                        {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                      </button>
                    </div>
                  )}

            {currentSection === 4 && (
              <div className="space-y-6">
                <SectionHeader
                  title={language === 'en' ? 'Insurance Information' : language === 'es' ? 'Información de Seguro' : 'Informações de Seguro'}
                  sectionNumber={4}
                  totalSections={totalSections}
                />

                <div className="bg-green-50 border-l-4 border-green-500 p-3 sm:p-4 rounded-sm space-y-3">
                  <h3 className="font-bold text-[var(--ink)]">{policyContent[language].insurancePolicyHeading}</h3>
                  
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm">{policyContent[language].insuranceWhyHeading}</p>
                    <p className="text-sm text-[var(--ink)]">{policyContent[language].insuranceWhyText}</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 text-sm">
                    <span className="font-semibold text-[var(--ink)]">{policyContent[language].insuranceCost}</span>
                    <span className="font-semibold text-red-600" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceDeadline }} />
                  </div>
                  
                  <div className="bg-white p-3 rounded-sm border border-green-200">
                    <p className="font-semibold text-[var(--ink)] text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceOption1 }} />
                    <p className="text-sm text-[var(--ink)] whitespace-pre-line">{policyContent[language].insuranceOption1Text}</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-sm border border-green-200">
                    <p className="font-semibold text-[var(--ink)] text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceOption2 }} />
                    <p className="text-sm text-[var(--ink)] whitespace-pre-line">{policyContent[language].insuranceOption2Text}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--ink)]">{t.insuranceQuestion} <span className="text-[var(--error)]">*</span></p>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasInsurance"
                        required
                        checked={formData.hasInsurance === true}
                        onChange={() => handleInputChange('hasInsurance', true)}
                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasInsurance"
                        required
                        checked={formData.hasInsurance === false}
                        onChange={() => handleInputChange('hasInsurance', false)}
                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.no}</span>
                    </label>
                  </div>
                </div>

                {formData.hasInsurance === true && (
                  <div className="space-y-4 bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.insuranceProvider} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.insuranceProvider}
                        onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.insurancePolicyNumber} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.insurancePolicyNumber}
                        onChange={(e) => handleInputChange('insurancePolicyNumber', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">
                        {t.insuranceUpload} {!formData.insuranceUploadPending && <span className="text-[var(--error)]">*</span>}
                      </span>
                      <input
                        type="file"
                        required={!formData.insuranceUploadPending}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('insuranceProof', e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/5 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/10"
                      />
                    </label>

                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.insuranceUploadPending}
                        onChange={(e) => handleInputChange('insuranceUploadPending', e.target.checked)}
                        className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.insuranceUploadLater}</span>
                    </label>

                    {formData.insuranceUploadPending && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-sm">
                        <p className="text-sm text-[var(--ink)]">{t.insuranceUploadLaterHelper}</p>
                      </div>
                    )}

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-sm">
                      <p className="text-sm font-semibold text-[var(--ink)] mb-2">{policyContent[language].insuranceLLCTableHeading}</p>
                      <InfoTable 
                        headers={policyContent[language].insuranceLLCTableHeaders}
                        rows={llcTable}
                        className="mb-2"
                      />
                      <p className="text-sm text-[var(--ink)] mt-2">{policyContent[language].insuranceLLCAddress}</p>
                    </div>
                  </div>
                )}

                {formData.hasInsurance === false && (
                  <div className="space-y-4 bg-yellow-50 p-4 rounded-sm border border-yellow-200">
                    <p className="text-sm text-[var(--ink)]">{t.insuranceNotice}</p>
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.addInsuranceToRent}
                        onChange={(e) => handleInputChange('addInsuranceToRent', e.target.checked)}
                        className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.insuranceAddToRent}</span>
                    </label>

                    {formData.addInsuranceToRent && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm text-[var(--ink)] font-medium">{t.insuranceAuthSignature}</p>
                        <SignatureCanvasComponent
                          onSave={(dataUrl) => handleSignature('insurance', dataUrl)}
                          label={language === 'en' ? 'Authorization Signature' : language === 'es' ? 'Firma de Autorización' : 'Assinatura de Autorização'}
                        />
                        {signatureErrors.insurance && (
                          <p className="text-sm text-red-600">{signatureErrors.insurance}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {sectionError && currentSection === 4 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{sectionError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { if (validateSection(4)) setCurrentSection(5); }}
                  className="w-full bg-[var(--primary)] text-white py-3 sm:py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition text-base font-medium"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection === 2 && (
              <div className="space-y-6">
                <SectionHeader
                  title={language === 'en' ? 'Vehicle Information' : language === 'es' ? 'Información de Vehículo' : 'Informações de Veículo'}
                  sectionNumber={2}
                  totalSections={totalSections}
                />

                {hasParking && (
                  <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-sm space-y-2">
                    <p className="text-sm font-bold text-red-800">⚠️ {t.vehicleDueToday}</p>
                    <p className="text-sm text-red-700">{t.permitRequiresOtherDocs}</p>
                  </div>
                )}

                {!hasParking ? (
                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--muted)] p-4 rounded-sm">
                    <p className="text-sm text-[var(--ink)]">{t.noParkingMessage}</p>
                  </div>
                ) : (
                  <>
                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 sm:p-4 rounded-sm space-y-3">
                  <h3 className="font-bold text-[var(--ink)]">{policyContent[language].parkingPolicyHeading}</h3>
                  <p className="text-sm text-[var(--ink)] whitespace-pre-line">{policyContent[language].parkingIntro}</p>
                  
                  <div>
                    <p className="font-semibold text-[var(--ink)] text-sm mb-2">{policyContent[language].parkingStepsHeading}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep1 }} />
                        <p className="text-[var(--ink)]">{policyContent[language].parkingStep1Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep2 }} />
                        <p className="text-[var(--ink)]">{policyContent[language].parkingStep2Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep3 }} />
                        <p className="text-[var(--ink)] whitespace-pre-line">{policyContent[language].parkingStep3Text}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-sm border border-purple-200">
                    <p className="font-semibold text-[var(--ink)] text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingDeadlinesHeading }} />
                    <p className="text-sm text-[var(--ink)] whitespace-pre-line">{policyContent[language].parkingDeadlines}</p>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded-sm border border-red-300">
                    <p className="text-sm font-semibold text-red-800">{policyContent[language].parkingWarning}</p>
                    <p className="text-sm text-[var(--ink)] mt-1">{policyContent[language].parkingDisplay}</p>
                  </div>
                </div>

                <div className="bg-white border border-[var(--border)] p-3 sm:p-4 rounded-sm">
                  <InfoTable 
                    headers={policyContent[language].parkingFeeTableHeaders}
                    rows={parkingFeeTable}
                    className="mb-0"
                  />
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 sm:p-4 rounded-sm">
                  <p className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line">{policyContent[language].parkingNotice}</p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-600 p-3 sm:p-4 rounded-sm space-y-2">
                  <h3 className="font-bold text-red-800 text-sm sm:text-base">⚠️ {policyContent[language].towingHeading}</h3>
                  <div className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: policyContent[language].towingText }} />
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-[var(--ink)]">{t.vehicleQuestion} <span className="text-[var(--error)]">*</span></p>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasVehicle"
                        required
                        checked={formData.hasVehicle === true}
                        onChange={() => handleInputChange('hasVehicle', true)}
                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasVehicle"
                        required
                        checked={formData.hasVehicle === false}
                        onChange={() => handleInputChange('hasVehicle', false)}
                        className="text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.no}</span>
                    </label>
                  </div>
                </div>

                {formData.hasVehicle === true && (
                  <div className="space-y-4 bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleMake} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleMake}
                        onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleModel} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleModel}
                        onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleYear} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="number"
                        required
                        min="1900"
                        max="2030"
                        value={formData.vehicleYear}
                        onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleColor} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleColor}
                        onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.vehiclePlate} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehiclePlate}
                        onChange={(e) => handleInputChange('vehiclePlate', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>

                    <div className="bg-blue-50 p-3 rounded-sm border border-blue-200">
                      <p className="text-sm text-[var(--ink)]">{t.vehicleNotice}</p>
                    </div>
                  </div>
                )}

                {formData.hasVehicle === true && !canHaveMultipleVehicles && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded-sm">
                    <p className="text-sm font-medium text-amber-900">{t.limitedParkingMessage}</p>
                  </div>
                )}

                {formData.hasVehicle === true && canHaveMultipleVehicles && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border-l-4 border-green-500 p-3 sm:p-4 rounded-sm">
                      <p className="text-sm font-medium text-[var(--ink)]">{t.additionalVehicleQuestion}</p>
                      <div className="flex space-x-4 mt-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="wantsAdditionalVehicle"
                            checked={formData.wantsAdditionalVehicle === true}
                            onChange={() => {
                              handleInputChange('wantsAdditionalVehicle', true);
                              if (formData.additionalVehicles.length === 0) {
                                handleInputChange('additionalVehicles', [{ vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleColor: '', vehiclePlate: '' }]);
                              }
                            }}
                            className="text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm text-[var(--ink)]">{t.yes}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="wantsAdditionalVehicle"
                            checked={formData.wantsAdditionalVehicle === false}
                            onChange={() => {
                              handleInputChange('wantsAdditionalVehicle', false);
                              handleInputChange('additionalVehicles', []);
                            }}
                            className="text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="text-sm text-[var(--ink)]">{t.no}</span>
                        </label>
                      </div>
                    </div>

                    {formData.wantsAdditionalVehicle === true && (
                      <div className="space-y-4">
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-sm">
                          <p className="text-sm text-amber-800">{t.additionalVehicleNotice}</p>
                        </div>

                        {formData.additionalVehicles.map((av, index) => (
                          <div key={index} className="space-y-3 bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-[var(--ink)] text-sm">{t.additionalVehicle} #{index + 1}</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formData.additionalVehicles.filter((_, i) => i !== index);
                                  handleInputChange('additionalVehicles', updated);
                                  if (updated.length === 0) {
                                    handleInputChange('wantsAdditionalVehicle', false);
                                  }
                                }}
                                className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              >
                                {t.removeVehicle}
                              </button>
                            </div>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleMake} <span className="text-[var(--error)]">*</span></span>
                              <input
                                type="text"
                                required
                                value={av.vehicleMake}
                                onChange={(e) => {
                                  const updated = [...formData.additionalVehicles];
                                  updated[index] = { ...updated[index], vehicleMake: e.target.value };
                                  handleInputChange('additionalVehicles', updated);
                                }}
                                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleModel} <span className="text-[var(--error)]">*</span></span>
                              <input
                                type="text"
                                required
                                value={av.vehicleModel}
                                onChange={(e) => {
                                  const updated = [...formData.additionalVehicles];
                                  updated[index] = { ...updated[index], vehicleModel: e.target.value };
                                  handleInputChange('additionalVehicles', updated);
                                }}
                                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleYear} <span className="text-[var(--error)]">*</span></span>
                              <input
                                type="number"
                                required
                                min="1900"
                                max="2030"
                                value={av.vehicleYear}
                                onChange={(e) => {
                                  const updated = [...formData.additionalVehicles];
                                  updated[index] = { ...updated[index], vehicleYear: e.target.value };
                                  handleInputChange('additionalVehicles', updated);
                                }}
                                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--ink)]">{t.vehicleColor} <span className="text-[var(--error)]">*</span></span>
                              <input
                                type="text"
                                required
                                value={av.vehicleColor}
                                onChange={(e) => {
                                  const updated = [...formData.additionalVehicles];
                                  updated[index] = { ...updated[index], vehicleColor: e.target.value };
                                  handleInputChange('additionalVehicles', updated);
                                }}
                                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-[var(--ink)]">{t.vehiclePlate} <span className="text-[var(--error)]">*</span></span>
                              <input
                                type="text"
                                required
                                value={av.vehiclePlate}
                                onChange={(e) => {
                                  const updated = [...formData.additionalVehicles];
                                  updated[index] = { ...updated[index], vehiclePlate: e.target.value };
                                  handleInputChange('additionalVehicles', updated);
                                }}
                                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                              />
                            </label>
                          </div>
                        ))}

                        {formData.additionalVehicles.length < 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleInputChange('additionalVehicles', [
                                ...formData.additionalVehicles,
                                { vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleColor: '', vehiclePlate: '' },
                              ]);
                            }}
                            className="w-full py-2.5 px-4 border-2 border-dashed border-[var(--primary)]/30 rounded-sm text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50 transition-colors text-sm font-medium"
                          >
                            + {t.addAnotherVehicle}
                          </button>
                        )}

                        {formData.additionalVehicles.length >= 2 && (
                          <p className="text-xs text-center text-[var(--muted)]">{t.maxVehiclesReached}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {language === 'en' && formData.hasVehicle === true && (
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <h3 className="font-semibold text-[var(--ink)] mb-2">Vehicle and Parking Addendum</h3>
                    <p className="text-sm text-[var(--ink)] whitespace-pre-line">{VEHICLE_ADDENDUM}</p>
                  </div>
                )}

                {formData.hasVehicle === true && (
                  <div className="space-y-4">
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        required
                        className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--ink)]">{t.vehicleAgree}</span>
                    </label>
                    <div className="space-y-2">
                      <SignatureCanvasComponent
                        label={t.signature}
                        value={signatures.vehicle}
                        onSave={(dataUrl) => {
                          handleSignature('vehicle', dataUrl);
                          setSignatureErrors(prev => ({ ...prev, vehicle: '' }));
                        }}
                      />
                      {signatureErrors.vehicle && (
                        <p className="text-sm text-red-600">{signatureErrors.vehicle}</p>
                      )}
                    </div>
                    <label className="block">
                      <span className="text-sm font-medium text-[var(--ink)]">{t.date} <span className="text-[var(--error)]">*</span></span>
                      <input
                        type="date"
                        required
                        value={formData.vehicleSignatureDate}
                        onChange={(e) => handleInputChange('vehicleSignatureDate', e.target.value)}
                        className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                      />
                    </label>
                  </div>
                )}

                {formData.hasVehicle === false && (
                  <div className="bg-[var(--bg-section)] p-3 rounded-sm border border-[var(--border)]">
                    <p className="text-sm text-[var(--ink)]">{t.vehicleNone}</p>
                  </div>
                )}
                  </>
                )}

                {sectionError && currentSection === 2 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{sectionError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { if (validateSection(2)) setCurrentSection(3); }}
                  className="w-full bg-[var(--primary)] text-white py-3 sm:py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition text-base font-medium"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection === 5 && (
              <div className="space-y-6">
                <SectionHeader
                  title={language === 'en' ? 'Review & Submit' : language === 'es' ? 'Revisar y Enviar' : 'Revisar e Enviar'}
                  sectionNumber={5}
                  totalSections={5}
                />

                <div className="space-y-4">
                  <p className="text-sm text-[var(--muted)]">
                    {language === 'en' ? 'Please review your information before submitting.' : language === 'es' ? 'Por favor revise su información antes de enviar.' : 'Por favor, revise suas informações antes de enviar.'}
                  </p>

                  {/* Resident Info Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">
                      {language === 'en' ? 'Resident Information' : language === 'es' ? 'Información del Residente' : 'Informações do Residente'}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--muted)]">{t.fullName}:</span></div>
                      <div className="font-medium">{formData.fullName}</div>
                      <div><span className="text-[var(--muted)]">{t.building}:</span></div>
                      <div className="font-medium">{formData.buildingAddress}</div>
                      <div><span className="text-[var(--muted)]">{t.unit}:</span></div>
                      <div className="font-medium">{formData.unitNumber}</div>
                      <div><span className="text-[var(--muted)]">{t.phone}:</span></div>
                      <div className="font-medium">{formatPhone(formData.phone)}</div>
                      {formData.email && (
                        <>
                          <div><span className="text-[var(--muted)]">{t.email}:</span></div>
                          <div className="font-medium">{formData.email}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Summary */}
                  {hasParking && formData.hasVehicle !== null && (
                    <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                      <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">
                        {language === 'en' ? 'Vehicle Information' : language === 'es' ? 'Información de Vehículo' : 'Informações de Veículo'}
                      </h4>
                      {formData.hasVehicle ? (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div><span className="text-[var(--muted)]">{t.vehicleMake}:</span></div>
                            <div className="font-medium">{formData.vehicleMake}</div>
                            <div><span className="text-[var(--muted)]">{t.vehicleModel}:</span></div>
                            <div className="font-medium">{formData.vehicleModel}</div>
                            <div><span className="text-[var(--muted)]">{t.vehicleYear}:</span></div>
                            <div className="font-medium">{formData.vehicleYear}</div>
                            <div><span className="text-[var(--muted)]">{t.vehicleColor}:</span></div>
                            <div className="font-medium">{formData.vehicleColor}</div>
                            <div><span className="text-[var(--muted)]">{t.vehiclePlate}:</span></div>
                            <div className="font-medium">{formData.vehiclePlate}</div>
                          </div>
                          {formData.additionalVehicles.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[var(--divider)]">
                              <p className="text-[var(--muted)] mb-1">{t.additionalVehicle}s:</p>
                              {formData.additionalVehicles.map((av, idx) => (
                                <p key={idx} className="font-medium">{av.vehicleYear} {av.vehicleMake} {av.vehicleModel} - {av.vehiclePlate}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">{t.vehicleNone}</p>
                      )}
                    </div>
                  )}

                  {/* Pet Summary */}
                  {formData.hasPets !== null && (
                    <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                      <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">
                        {language === 'en' ? 'Pet Information' : language === 'es' ? 'Información de Mascotas' : 'Informações sobre Animais'}
                      </h4>
                      {formData.hasPets ? (
                        <div className="space-y-2 text-sm">
                          {formData.pets.map((pet, idx) => (
                            <div key={idx} className="pb-2 border-b border-[var(--divider)] last:border-0">
                              <p className="font-medium">{pet.petName} - {pet.petType === 'dog' ? t.dog : t.cat}</p>
                              <p className="text-[var(--muted)]">{pet.petBreed}, {pet.petWeight} lbs, {pet.petColor}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">{language === 'en' ? 'No pets' : language === 'es' ? 'Sin mascotas' : 'Sem animais'}</p>
                      )}
                    </div>
                  )}

                  {/* Insurance Summary */}
                  {formData.hasInsurance !== null && (
                    <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                      <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">
                        {language === 'en' ? 'Insurance Information' : language === 'es' ? 'Información de Seguro' : 'Informações de Seguro'}
                      </h4>
                      {formData.hasInsurance ? (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-[var(--muted)]">{t.insuranceProvider}:</span></div>
                          <div className="font-medium">{formData.insuranceProvider}</div>
                          <div><span className="text-[var(--muted)]">{t.insurancePolicyNumber}:</span></div>
                          <div className="font-medium">{formData.insurancePolicyNumber}</div>
                          <div><span className="text-[var(--muted)]">{language === 'en' ? 'Document:' : language === 'es' ? 'Documento:' : 'Documento:'}:</span></div>
                          <div className="font-medium">{formData.insuranceUploadPending ? (language === 'en' ? 'Will upload later' : language === 'es' ? 'Subirá más tarde' : 'Enviará mais tarde') : (language === 'en' ? 'Uploaded' : language === 'es' ? 'Subido' : 'Enviado')}</div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">{formData.addInsuranceToRent ? t.insuranceAddToRent : (language === 'en' ? 'No insurance provided' : language === 'es' ? 'No se proporcionó seguro' : 'Nenhum seguro fornecido')}</p>
                      )}
                    </div>
                  )}

                  {/* Final Confirmation */}
                  <label className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      required
                      checked={formData.finalConfirm}
                      onChange={(e) => handleInputChange('finalConfirm', e.target.checked)}
                      className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--ink)]">{t.finalConfirm}</span>
                  </label>

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[var(--success)] text-white py-3 px-4 rounded-sm hover:bg-green-700 transition disabled:bg-[var(--muted)] disabled:cursor-not-allowed font-semibold"
                  >
                    {isSubmitting 
                      ? (language === 'en' ? 'Submitting...' : language === 'es' ? 'Enviando...' : 'Enviando...')
                      : t.submit
                    }
                  </button>
                </div>
              </div>
            )}
                </motion.div>
              </AnimatePresence>
            </form>
          </div>
        </div>
      </main>
      
      <InsuranceUpdateModal 
        isOpen={isInsuranceModalOpen}
        onClose={() => setIsInsuranceModalOpen(false)}
        language={language}
      />
      
      <Footer />
    </>
  );
}

export default function TenantOnboardingForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <FormContent />
    </Suspense>
  );
}
