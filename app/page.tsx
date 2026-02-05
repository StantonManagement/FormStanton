'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, Language } from '@/lib/translations';
import { buildings, buildingToLLC } from '@/lib/buildings';
import { PET_ADDENDUM, VEHICLE_ADDENDUM } from '@/lib/addendums';
import { policyContent, petRentTable, llcTable, parkingFeeTable } from '@/lib/policyContent';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import InfoTable from '@/components/InfoTable';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProgressIndicator from '@/components/ProgressIndicator';
import SectionHeader from '@/components/SectionHeader';

export default function TenantOnboardingForm() {
  const [language, setLanguage] = useState<Language>('en');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    phoneIsNew: false,
    buildingAddress: '',
    unitNumber: '',
    hasPets: null as boolean | null,
    petType: '',
    petName: '',
    petBreed: '',
    petWeight: '',
    petColor: '',
    petSpayed: null as boolean | null,
    petVaccinationsCurrent: null as boolean | null,
    hasInsurance: null as boolean | null,
    insuranceProvider: '',
    insurancePolicyNumber: '',
    addInsuranceToRent: false,
    hasVehicle: null as boolean | null,
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
    finalConfirm: false,
  });

  const [files, setFiles] = useState({
    petVaccination: null as File | null,
    petPhoto: null as File | null,
    insuranceProof: null as File | null,
  });

  const [signatures, setSignatures] = useState({
    pet: '',
    vehicle: '',
  });

  const [currentSection, setCurrentSection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const t = translations[language];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: keyof typeof files, file: File | null) => {
    setFiles(prev => ({ ...prev, [field]: file }));
  };

  const handleSignature = (type: 'pet' | 'vehicle', dataUrl: string) => {
    setSignatures(prev => ({ ...prev, [type]: dataUrl }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('language', language);
      formDataToSend.append('formData', JSON.stringify(formData));
      formDataToSend.append('signatures', JSON.stringify(signatures));
      
      if (files.petVaccination) formDataToSend.append('petVaccination', files.petVaccination);
      if (files.petPhoto) formDataToSend.append('petPhoto', files.petPhoto);
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
                <span>Your information is secure and encrypted</span>
              </div>
            </div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  const totalSections = 4;

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      
      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden">
            
            <ProgressIndicator 
              currentSection={currentSection} 
              totalSections={totalSections}
              language={language}
            />

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              
              {/* Intro Section */}
              <div className="mb-8">
                <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
                  <p className="text-sm text-[var(--ink)] mb-3 leading-relaxed">{policyContent[language].introText}</p>
                  <p className="font-semibold text-[var(--primary)] mb-2 text-sm">{policyContent[language].introHeading}</p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-[var(--ink)]">
                    {t.introItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
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
                  {currentSection >= 1 && (
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
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="(860) 555-0123"
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.phoneIsNew}
                            onChange={(e) => handleInputChange('phoneIsNew', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                          />
                          <span className="text-sm text-gray-700">{t.phoneNew}</span>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">{t.building} <span className="text-red-500">*</span></span>
                          <select
                            required
                            value={formData.buildingAddress}
                            onChange={(e) => handleInputChange('buildingAddress', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 text-base border"
                          >
                            <option value="">Select...</option>
                            {buildings.map(building => (
                              <option key={building} value={building}>{building}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-gray-700">{t.unit} <span className="text-red-500">*</span></span>
                          <input
                            type="text"
                            required
                            value={formData.unitNumber}
                            onChange={(e) => handleInputChange('unitNumber', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 text-base border"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setCurrentSection(2)}
                          className="w-full bg-blue-600 text-white py-3 sm:py-2 px-4 rounded-md hover:bg-blue-700 transition text-base font-medium"
                        >
                          {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {currentSection >= 2 && (
                    <div className="space-y-4 border-t pt-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {language === 'en' ? 'Pet Information' : language === 'es' ? 'Información de Mascotas' : 'Informações sobre Animais'}
                </h2>

                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 sm:p-4 rounded">
                  <h3 className="font-bold text-gray-900 mb-2">{policyContent[language].petPolicyHeading}</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].petPolicyText}</p>
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
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">{t.petType} <span className="text-red-500">*</span></p>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petType"
                            required
                            value="dog"
                            checked={formData.petType === 'dog'}
                            onChange={(e) => handleInputChange('petType', e.target.value)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{t.dog}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petType"
                            required
                            value="cat"
                            checked={formData.petType === 'cat'}
                            onChange={(e) => handleInputChange('petType', e.target.value)}
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
                        required
                        value={formData.petName}
                        onChange={(e) => handleInputChange('petName', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.petBreed} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.petBreed}
                        onChange={(e) => handleInputChange('petBreed', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.petWeight} <span className="text-red-500">*</span></span>
                      <input
                        type="number"
                        required
                        value={formData.petWeight}
                        onChange={(e) => handleInputChange('petWeight', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.petColor} <span className="text-red-500">*</span></span>
                      <input
                        type="text"
                        required
                        value={formData.petColor}
                        onChange={(e) => handleInputChange('petColor', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                      />
                    </label>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">{t.petSpayed} <span className="text-red-500">*</span></p>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petSpayed"
                            required
                            checked={formData.petSpayed === true}
                            onChange={() => handleInputChange('petSpayed', true)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{t.yes}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petSpayed"
                            required
                            checked={formData.petSpayed === false}
                            onChange={() => handleInputChange('petSpayed', false)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{t.no}</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">{t.petVaccines} <span className="text-red-500">*</span></p>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petVaccines"
                            required
                            checked={formData.petVaccinationsCurrent === true}
                            onChange={() => handleInputChange('petVaccinationsCurrent', true)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{t.yes}</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="petVaccines"
                            required
                            checked={formData.petVaccinationsCurrent === false}
                            onChange={() => handleInputChange('petVaccinationsCurrent', false)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{t.no}</span>
                        </label>
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.petVaccineUpload} <span className="text-red-500">*</span></span>
                      <input
                        type="file"
                        required
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('petVaccination', e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t.petPhoto} <span className="text-red-500">*</span></span>
                      <input
                        type="file"
                        required
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('petPhoto', e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </label>
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
                    <SignatureCanvasComponent 
                      label={t.signature}
                      onSave={(dataUrl) => handleSignature('pet', dataUrl)}
                    />
                  </div>
                )}

                {formData.hasPets === false && (
                  <label className="flex items-start space-x-2">
                    <input
                      type="checkbox"
                      required
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{t.petAgreeNone}</span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentSection(3)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection >= 3 && (
              <div className="space-y-4 border-t pt-6">
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
                    <span className="font-semibold text-red-600">{policyContent[language].insuranceDeadline}</span>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1">{policyContent[language].insuranceOption1}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].insuranceOption1Text}</p>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1">{policyContent[language].insuranceOption2}</p>
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
                      <span className="text-sm font-medium text-gray-700">{t.insuranceUpload} <span className="text-red-500">*</span></span>
                      <input
                        type="file"
                        required
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('insuranceProof', e.target.files?.[0] || null)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </label>

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

                <button
                  type="button"
                  onClick={() => setCurrentSection(4)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection >= 4 && (
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {language === 'en' ? 'Vehicle Information' : language === 'es' ? 'Información de Vehículo' : 'Informações de Veículo'}
                </h2>

                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 sm:p-4 rounded space-y-3">
                  <h3 className="font-bold text-gray-900">{policyContent[language].parkingPolicyHeading}</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{policyContent[language].parkingIntro}</p>
                  
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-2">{policyContent[language].parkingStepsHeading}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">{policyContent[language].parkingStep1}</p>
                        <p className="text-gray-700">{policyContent[language].parkingStep1Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-gray-900">{policyContent[language].parkingStep2}</p>
                        <p className="text-gray-700">{policyContent[language].parkingStep2Text}</p>
                      </div>
                      
                      <div>
                        <p className="font-semibold text-gray-900">{policyContent[language].parkingStep3}</p>
                        <p className="text-gray-700 whitespace-pre-line">{policyContent[language].parkingStep3Text}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border border-purple-200">
                    <p className="font-semibold text-gray-900 text-sm mb-1">{policyContent[language].parkingDeadlinesHeading}</p>
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
                    <SignatureCanvasComponent 
                      label={t.signature}
                      onSave={(dataUrl) => handleSignature('vehicle', dataUrl)}
                    />
                  </div>
                )}

                {formData.hasVehicle === false && (
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-700">{t.vehicleNone}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentSection(5)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                >
                  {language === 'en' ? 'Continue' : language === 'es' ? 'Continuar' : 'Continuar'}
                </button>
              </div>
            )}

            {currentSection >= 5 && (
              <div className="space-y-4 border-t pt-6">
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
      
      <Footer />
    </>
  );
}
