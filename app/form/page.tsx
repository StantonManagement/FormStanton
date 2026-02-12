'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from '@/lib/translations';
import { buildings, buildingToLLC, buildingsWithParking, buildingUnits } from '@/lib/buildings';
import { PET_ADDENDUM, VEHICLE_ADDENDUM } from '@/lib/addendums';
import { policyContent, petRentTable, llcTable, parkingFeeTable } from '@/lib/policyContent';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import InfoTable from '@/components/InfoTable';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import InsuranceUpdateModal from '@/components/InsuranceUpdateModal';

function FormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const initialLang = (langParam === 'es' || langParam === 'pt') ? langParam : 'en';
  const [language, setLanguage] = useState<Language>(initialLang);
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
  });
  const [isInsuranceModalOpen, setIsInsuranceModalOpen] = useState(false);

  const t = translations[language];
  const hasParking = buildingsWithParking.has(formData.buildingAddress);

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

  const handleSignature = (type: 'pet' | 'vehicle', dataUrl: string) => {
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

    if (section === 3) {
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
      return true;
    }

    if (section === 4) {
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
        if (!signatures.vehicle) {
          setSectionError(t.signatureRequired);
          return false;
        }
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
    const newSignatureErrors = { pet: '', vehicle: '' };

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
          setCurrentSection(2);
          return;
        }
      }
    }

    // Validate vehicle fields are complete (only for buildings with parking)
    if (hasParking && formData.hasVehicle === true) {
      if (!formData.vehicleMake || !formData.vehicleModel || !formData.vehicleYear || !formData.vehicleColor || !formData.vehiclePlate) {
        setSubmitError(t.incompleteVehicleEntry);
        setIsSubmitting(false);
        setCurrentSection(4);
        return;
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Submission failed');
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
    { id: 2, label: language === 'en' ? 'Pets' : language === 'es' ? 'Mascotas' : 'Animais' },
    { id: 3, label: language === 'en' ? 'Insurance' : language === 'es' ? 'Seguro' : 'Seguro' },
    { id: 4, label: language === 'en' ? 'Vehicle' : language === 'es' ? 'Vehículo' : 'Veículo' },
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
              
              {/* Intro Section */}
              <div className="mb-8">
                <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
                  <p className="text-sm text-[var(--ink)] mb-3 leading-relaxed">{policyContent[language].introText}</p>
                  <p className="font-semibold text-[var(--primary)] mb-2 text-sm">{policyContent[language].introHeading}</p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-[var(--ink)]">
                    {t.introItems.map((item, idx) => (
                      <li key={idx} dangerouslySetInnerHTML={{ __html: item }} />
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setIsInsuranceModalOpen(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      {language === 'en' ? 'Already submitted? Upload insurance documents here' :
                       language === 'es' ? '¿Ya envió el formulario? Suba documentos de seguro aquí' :
                       'Já enviou? Carregar documentos de seguro aqui'}
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
                          <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              handleInputChange('phone', value);
                              if (value.length !== 10 && value.length > 0) {
                                setPhoneValidationError(t.phoneValidationError);
                              } else {
                                setPhoneValidationError('');
                              }
                            }}
                            placeholder="(860) 555-0123"
                            maxLength={10}
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          {phoneValidationError && (
                            <p className="text-xs text-[var(--error)] mt-1">{phoneValidationError}</p>
                          )}
                          <label className="flex items-center space-x-2 mt-2">
                            <input
                              type="checkbox"
                              checked={formData.phoneIsNew}
                              onChange={(e) => handleInputChange('phoneIsNew', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
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
                          <span className="text-sm font-medium text-gray-700">{t.building} <span className="text-red-500">*</span></span>
                          <div className="relative mt-1">
                            <select
                              required
                              value={formData.buildingAddress}
                              onChange={(e) => { handleInputChange('buildingAddress', e.target.value); handleInputChange('unitNumber', ''); }}
                              className="block w-full appearance-none rounded-none border border-[var(--border)] bg-[var(--bg-input)] text-[var(--ink)] px-4 py-3 pr-10 text-base focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                            >
                              <option value="">{language === 'en' ? '-- Select your building --' : language === 'es' ? '-- Seleccione su edificio --' : '-- Selecione seu prédio --'}</option>
                              {buildings.map(building => (
                                <option key={building} value={building}>{building}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <svg className="h-5 w-5 text-[var(--muted)]" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">{t.unit} <span className="text-red-500">*</span></span>
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
                          className="w-full bg-blue-600 text-white py-3 sm:py-2 px-4 rounded-md hover:bg-blue-700 transition text-base font-medium"
                        >
                          {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSection === 2 && (
                    <div className="space-y-4">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                        {language === 'en' ? 'Pet Information' : language === 'es' ? 'Información de Mascotas' : 'Informações sobre Animais'}
                      </h2>

                      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded">
                        <h3 className="font-bold text-gray-900 mb-2">{policyContent[language].petPolicyHeading}</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: policyContent[language].petPolicyText }} />
                      </div>

                      <div className="bg-white border border-gray-300 p-3 sm:p-4 rounded">
                        <InfoTable 
                          headers={policyContent[language].petRentTableHeaders}
                          rows={petRentTable}
                          className="mb-0"
                        />
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">{t.petQuestion} <span className="text-red-500">*</span></p>
                        <div className="flex space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="hasPets"
                              required
                              checked={formData.hasPets === true}
                              onChange={() => handleInputChange('hasPets', true)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{t.yes}</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="hasPets"
                              required
                              checked={formData.hasPets === false}
                              onChange={() => handleInputChange('hasPets', false)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{t.no}</span>
                          </label>
                        </div>
                      </div>

                      {formData.hasPets === true && (
                        <div className="space-y-4">
                          {formData.pets.map((pet, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900">{t.petNumber}{idx + 1}</h4>
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
                                  <p className="text-sm font-medium text-gray-700">{t.petType} <span className="text-red-500">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petType_${idx}`}
                                        value="dog"
                                        checked={pet.petType === 'dog'}
                                        onChange={(e) => handlePetChange(idx, 'petType', e.target.value)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.dog}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petType_${idx}`}
                                        value="cat"
                                        checked={pet.petType === 'cat'}
                                        onChange={(e) => handlePetChange(idx, 'petType', e.target.value)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.cat}</span>
                                    </label>
                                  </div>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-gray-700">{t.petName} <span className="text-red-500">*</span></span>
                                  <input
                                    type="text"
                                    value={pet.petName}
                                    onChange={(e) => handlePetChange(idx, 'petName', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-gray-700">{t.petBreed} <span className="text-red-500">*</span></span>
                                  <input
                                    type="text"
                                    value={pet.petBreed}
                                    onChange={(e) => handlePetChange(idx, 'petBreed', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                  />
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                  <label className="block">
                                    <span className="text-sm font-medium text-gray-700">{t.petWeight} <span className="text-red-500">*</span></span>
                                    <input
                                      type="number"
                                      value={pet.petWeight}
                                      onChange={(e) => handlePetChange(idx, 'petWeight', e.target.value)}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-sm font-medium text-gray-700">{t.petColor} <span className="text-red-500">*</span></span>
                                    <input
                                      type="text"
                                      value={pet.petColor}
                                      onChange={(e) => handlePetChange(idx, 'petColor', e.target.value)}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    />
                                  </label>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-gray-700">{t.petSpayed} <span className="text-red-500">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petSpayed_${idx}`}
                                        checked={pet.petSpayed === true}
                                        onChange={() => handlePetChange(idx, 'petSpayed', true)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.yes}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petSpayed_${idx}`}
                                        checked={pet.petSpayed === false}
                                        onChange={() => handlePetChange(idx, 'petSpayed', false)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.no}</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-gray-700">{t.petVaccines} <span className="text-red-500">*</span></p>
                                  <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petVaccines_${idx}`}
                                        checked={pet.petVaccinationsCurrent === true}
                                        onChange={() => handlePetChange(idx, 'petVaccinationsCurrent', true)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.yes}</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        name={`petVaccines_${idx}`}
                                        checked={pet.petVaccinationsCurrent === false}
                                        onChange={() => handlePetChange(idx, 'petVaccinationsCurrent', false)}
                                        className="text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-700">{t.no}</span>
                                    </label>
                                  </div>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-gray-700">{t.petVaccineUpload} <span className="text-[var(--muted)] font-normal">{t.optional}</span></span>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => handlePetFileChange(idx, 'vaccination', e.target.files?.[0] || null)}
                                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-gray-700">{t.petPhoto} <span className="text-[var(--muted)] font-normal">{t.optional}</span></span>
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png"
                                    onChange={(e) => handlePetFileChange(idx, 'photo', e.target.files?.[0] || null)}
                                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}

                          {formData.pets.length < MAX_PETS ? (
                            <button
                              type="button"
                              onClick={addPet}
                              className="w-full py-2.5 px-4 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm font-medium"
                            >
                              + {t.addAnotherPet}
                            </button>
                          ) : (
                            <p className="text-xs text-center text-gray-500">{t.maxPetsReached}</p>
                          )}
                        </div>
                      )}

                      {language === 'en' && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h3 className="font-semibold text-gray-900 mb-2">Pet Addendum</h3>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{PET_ADDENDUM}</p>
                        </div>
                      )}

                      {formData.hasPets === true && (
                        <div className="space-y-4">
                          <label className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              required
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{t.petAgree}</span>
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
                            <span className="text-sm font-medium text-gray-700">{t.date} <span className="text-red-500">*</span></span>
                            <input
                              type="date"
                              required
                              value={formData.petSignatureDate}
                              onChange={(e) => handleInputChange('petSignatureDate', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
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
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{t.petAgreeNone}</span>
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
                            <span className="text-sm font-medium text-gray-700">{t.date} <span className="text-red-500">*</span></span>
                            <input
                              type="date"
                              required
                              value={formData.petSignatureDate}
                              onChange={(e) => handleInputChange('petSignatureDate', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            />
                          </label>
                        </div>
                      )}

                      {sectionError && currentSection === 2 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-700">{sectionError}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => { if (validateSection(2)) setCurrentSection(3); }}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                      >
                        {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                      </button>
                    </div>
                  )}

            {currentSection === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {language === 'en' ? 'Insurance Information' : language === 'es' ? 'Información de Seguro' : 'Informações de Seguro'}
                </h2>

                <div className="bg-green-50 border-l-4 border-green-500 p-3 sm:p-4 rounded space-y-3">
                  <h3 className="font-bold text-gray-900">{policyContent[language].insurancePolicyHeading}</h3>
                  
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{policyContent[language].insuranceWhyHeading}</p>
                    <p className="text-sm text-gray-700">{policyContent[language].insuranceWhyText}</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 text-sm">
                    <span className="font-semibold text-gray-900">{policyContent[language].insuranceCost}</span>
                    <span className="font-semibold text-red-600" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceDeadline }} />
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceOption1 }} />
                    <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].insuranceOption1Text}</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].insuranceOption2 }} />
                    <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].insuranceOption2Text}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">{t.insuranceQuestion} <span className="text-red-500">*</span></p>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasInsurance"
                        required
                        checked={formData.hasInsurance === true}
                        onChange={() => handleInputChange('hasInsurance', true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasInsurance"
                        required
                        checked={formData.hasInsurance === false}
                        onChange={() => handleInputChange('hasInsurance', false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.no}</span>
                    </label>
                  </div>
                </div>

                {formData.hasInsurance === true && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.insuranceProvider} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.insuranceProvider}
                        onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.insurancePolicyNumber} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.insurancePolicyNumber}
                        onChange={(e) => handleInputChange('insurancePolicyNumber', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        {t.insuranceUpload} {!formData.insuranceUploadPending && <span className="text-red-500">*</span>}
                      </span>
                      <input
                        type="file"
                        required={!formData.insuranceUploadPending}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('insuranceProof', e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </label>

                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.insuranceUploadPending}
                        onChange={(e) => handleInputChange('insuranceUploadPending', e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.insuranceUploadLater}</span>
                    </label>

                    {formData.insuranceUploadPending && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                        <p className="text-sm text-gray-700">{t.insuranceUploadLaterHelper}</p>
                      </div>
                    )}

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                      <p className="text-sm font-semibold text-gray-900 mb-2">{policyContent[language].insuranceLLCTableHeading}</p>
                      <InfoTable 
                        headers={policyContent[language].insuranceLLCTableHeaders}
                        rows={llcTable}
                        className="mb-2"
                      />
                      <p className="text-sm text-gray-700 mt-2">{policyContent[language].insuranceLLCAddress}</p>
                    </div>
                  </div>
                )}

                {formData.hasInsurance === false && (
                  <div className="space-y-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-gray-700">{t.insuranceNotice}</p>
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.addInsuranceToRent}
                        onChange={(e) => handleInputChange('addInsuranceToRent', e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.insuranceAddToRent}</span>
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
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {language === 'en' ? 'Vehicle Information' : language === 'es' ? 'Información de Vehículo' : 'Informações de Veículo'}
                </h2>

                {!hasParking ? (
                  <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded">
                    <p className="text-sm text-gray-700">{t.noParkingMessage}</p>
                  </div>
                ) : (
                  <>
                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 sm:p-4 rounded space-y-3">
                  <h3 className="font-bold text-gray-900">{policyContent[language].parkingPolicyHeading}</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].parkingIntro}</p>
                  
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-2">{policyContent[language].parkingStepsHeading}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep1 }} />
                        <p className="text-gray-700">{policyContent[language].parkingStep1Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep2 }} />
                        <p className="text-gray-700">{policyContent[language].parkingStep2Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingStep3 }} />
                        <p className="text-gray-700 whitespace-pre-line">{policyContent[language].parkingStep3Text}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-purple-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: policyContent[language].parkingDeadlinesHeading }} />
                    <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].parkingDeadlines}</p>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded border border-red-300">
                    <p className="text-sm font-semibold text-red-800">{policyContent[language].parkingWarning}</p>
                    <p className="text-sm text-gray-700 mt-1">{policyContent[language].parkingDisplay}</p>
                  </div>
                </div>

                <div className="bg-white border border-gray-300 p-3 sm:p-4 rounded">
                  <InfoTable 
                    headers={policyContent[language].parkingFeeTableHeaders}
                    rows={parkingFeeTable}
                    className="mb-0"
                  />
                </div>

                <div className="bg-red-50 border-l-4 border-red-600 p-3 sm:p-4 rounded space-y-2">
                  <h3 className="font-bold text-red-800 text-sm sm:text-base">⚠️ {policyContent[language].towingHeading}</h3>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: policyContent[language].towingText }} />
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded">
                  <p className="text-sm font-semibold text-amber-800">
                    {language === 'en' ? '⚠️ Each tenant is limited to 1 parking permit. If you need a 2nd permit, contact the office — availability is first-come, first-served and not all buildings allow a 2nd permit.' :
                     language === 'es' ? '⚠️ Cada inquilino tiene derecho a 1 permiso de estacionamiento. Si necesita un 2do permiso, contacte la oficina — la disponibilidad es por orden de llegada y no todos los edificios permiten un 2do permiso.' :
                     '⚠️ Cada inquilino tem direito a 1 autorização de estacionamento. Se precisar de uma 2ª autorização, entre em contato com o escritório — a disponibilidade é por ordem de chegada e nem todos os prédios permitem uma 2ª autorização.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">{t.vehicleQuestion} <span className="text-red-500">*</span></p>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasVehicle"
                        required
                        checked={formData.hasVehicle === true}
                        onChange={() => handleInputChange('hasVehicle', true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.yes}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="hasVehicle"
                        required
                        checked={formData.hasVehicle === false}
                        onChange={() => handleInputChange('hasVehicle', false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.no}</span>
                    </label>
                  </div>
                </div>

                {formData.hasVehicle === true && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.vehicleMake} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleMake}
                        onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.vehicleModel} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleModel}
                        onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.vehicleYear} <span className="text-red-500">*</span></span>
                      <input
                        type="number"
                        required
                        min="1900"
                        max="2030"
                        value={formData.vehicleYear}
                        onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.vehicleColor} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehicleColor}
                        onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.vehiclePlate} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.vehiclePlate}
                        onChange={(e) => handleInputChange('vehiclePlate', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="text-sm text-gray-700">{t.vehicleNotice}</p>
                    </div>
                  </div>
                )}

                {language === 'en' && formData.hasVehicle === true && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-2">Vehicle and Parking Addendum</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{VEHICLE_ADDENDUM}</p>
                  </div>
                )}

                {formData.hasVehicle === true && (
                  <div className="space-y-4">
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        required
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{t.vehicleAgree}</span>
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
                      <span className="text-sm font-medium text-gray-700">{t.date} <span className="text-red-500">*</span></span>
                      <input
                        type="date"
                        required
                        value={formData.vehicleSignatureDate}
                        onChange={(e) => handleInputChange('vehicleSignatureDate', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>
                  </div>
                )}

                {formData.hasVehicle === false && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-700">{t.vehicleNone}</p>
                  </div>
                )}
                  </>
                )}

                {sectionError && currentSection === 4 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{sectionError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { if (validateSection(4)) setCurrentSection(5); }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection === 5 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {language === 'en' ? 'Final Confirmation' : language === 'es' ? 'Confirmación Final' : 'Confirmação Final'}
                </h2>

                <label className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    required
                    checked={formData.finalConfirm}
                    onChange={(e) => handleInputChange('finalConfirm', e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t.finalConfirm}</span>
                </label>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  {isSubmitting 
                    ? (language === 'en' ? 'Submitting...' : language === 'es' ? 'Enviando...' : 'Enviando...')
                    : t.submit
                  }
                </button>
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
