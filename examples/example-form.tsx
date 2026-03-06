/**
 * Example Form Template
 * 
 * This is a fully functional example demonstrating how to build a form
 * using the standardized form components and patterns.
 * 
 * Copy this file as a starting point for new forms.
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';

// Import standardized form components
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormRadioGroup,
  FormCheckbox,
  FormButton,
  FormSection,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
} from '@/components/form';

// Import shared components
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';

// Import utilities and hooks
import { validateEmail, validatePhone, sanitizePhone } from '@/lib/formUtils';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

// Define form data structure
interface ExampleFormData {
  // Section 1: Basic Info
  fullName: string;
  email: string;
  phone: string;
  
  // Section 2: Details
  category: string;
  description: string;
  priority: string;
  
  // Section 3: Confirmation
  agreeToTerms: boolean;
}

// Initial form data
const initialFormData: ExampleFormData = {
  fullName: '',
  email: '',
  phone: '',
  category: '',
  description: '',
  priority: 'normal',
  agreeToTerms: false,
};

// Translations (simplified for example)
const translations: Record<Language, Record<string, string>> = {
  en: {
    formTitle: 'Example Form',
    formIntro: 'This is an example form demonstrating the standardized design pattern.',
    
    // Section 1
    basicInfoTitle: 'Basic Information',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    email: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    phone: 'Phone Number',
    phonePlaceholder: '(860) 555-0123',
    
    // Section 2
    detailsTitle: 'Details',
    category: 'Category',
    selectCategory: '-- Select a category --',
    description: 'Description',
    descriptionPlaceholder: 'Provide details...',
    priority: 'Priority',
    priorityNormal: 'Normal',
    priorityUrgent: 'Urgent',
    
    // Section 3
    reviewTitle: 'Review & Confirm',
    agreeToTerms: 'I agree to the terms and conditions',
    
    // Navigation
    continue: 'Continue',
    submit: 'Submit Form',
    submitting: 'Submitting...',
    
    // Tabs
    tabBasicInfo: 'Basic Info',
    tabDetails: 'Details',
    tabReview: 'Review',
    
    // Validation
    requiredFieldsMissing: 'Please complete all required fields',
    invalidEmail: 'Please enter a valid email address',
    invalidPhone: 'Please enter a valid 10-digit phone number',
    
    // Success
    successTitle: 'Thank You!',
    successMessage: 'Your form has been submitted successfully.',
  },
  es: {
    formTitle: 'Formulario de Ejemplo',
    formIntro: 'Este es un formulario de ejemplo que demuestra el patrón de diseño estandarizado.',
    basicInfoTitle: 'Información Básica',
    fullName: 'Nombre Completo',
    fullNamePlaceholder: 'Ingrese su nombre completo',
    email: 'Correo Electrónico',
    emailPlaceholder: 'su.correo@ejemplo.com',
    phone: 'Número de Teléfono',
    phonePlaceholder: '(860) 555-0123',
    detailsTitle: 'Detalles',
    category: 'Categoría',
    selectCategory: '-- Seleccione una categoría --',
    description: 'Descripción',
    descriptionPlaceholder: 'Proporcione detalles...',
    priority: 'Prioridad',
    priorityNormal: 'Normal',
    priorityUrgent: 'Urgente',
    reviewTitle: 'Revisar y Confirmar',
    agreeToTerms: 'Acepto los términos y condiciones',
    continue: 'Continuar',
    submit: 'Enviar Formulario',
    submitting: 'Enviando...',
    tabBasicInfo: 'Información',
    tabDetails: 'Detalles',
    tabReview: 'Revisar',
    requiredFieldsMissing: 'Complete todos los campos requeridos',
    invalidEmail: 'Ingrese una dirección de correo electrónico válida',
    invalidPhone: 'Ingrese un número de teléfono válido de 10 dígitos',
    successTitle: '¡Gracias!',
    successMessage: 'Su formulario ha sido enviado exitosamente.',
  },
  pt: {
    formTitle: 'Formulário de Exemplo',
    formIntro: 'Este é um formulário de exemplo que demonstra o padrão de design padronizado.',
    basicInfoTitle: 'Informações Básicas',
    fullName: 'Nome Completo',
    fullNamePlaceholder: 'Digite seu nome completo',
    email: 'Endereço de E-mail',
    emailPlaceholder: 'seu.email@exemplo.com',
    phone: 'Número de Telefone',
    phonePlaceholder: '(860) 555-0123',
    detailsTitle: 'Detalhes',
    category: 'Categoria',
    selectCategory: '-- Selecione uma categoria --',
    description: 'Descrição',
    descriptionPlaceholder: 'Forneça detalhes...',
    priority: 'Prioridade',
    priorityNormal: 'Normal',
    priorityUrgent: 'Urgente',
    reviewTitle: 'Revisar e Confirmar',
    agreeToTerms: 'Concordo com os termos e condições',
    continue: 'Continuar',
    submit: 'Enviar Formulário',
    submitting: 'Enviando...',
    tabBasicInfo: 'Informações',
    tabDetails: 'Detalhes',
    tabReview: 'Revisar',
    requiredFieldsMissing: 'Preencha todos os campos obrigatórios',
    invalidEmail: 'Digite um endereço de e-mail válido',
    invalidPhone: 'Digite um número de telefone válido de 10 dígitos',
    successTitle: 'Obrigado!',
    successMessage: 'Seu formulário foi enviado com sucesso.',
  },
};

function ExampleFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  // Language state
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  // Form data management
  const { formData, updateField } = useFormData(initialFormData);
  
  // Section navigation
  const {
    currentSection,
    nextSection,
    goToSection,
    isLastSection,
  } = useFormSection(3);
  
  // Validation
  const { errors, setFieldError, clearFieldError, clearAllErrors } = useFieldValidation<ExampleFormData>();
  
  // Submission
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    // Simulate API call
    const formDataToSend = new FormData();
    formDataToSend.append('language', language);
    formDataToSend.append('formData', JSON.stringify(data));
    
    const response = await fetch('/api/example-form', {
      method: 'POST',
      body: formDataToSend,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });
  
  const t = translations[language];
  
  // Show language landing if no language selected
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
  
  // Show success screen after submission
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
  
  // Validate section before proceeding
  const validateSection = (section: number): boolean => {
    clearAllErrors();
    
    if (section === 1) {
      let isValid = true;
      
      if (!formData.fullName.trim()) {
        setFieldError('fullName', t.requiredFieldsMissing);
        isValid = false;
      }
      
      if (!formData.email.trim()) {
        setFieldError('email', t.requiredFieldsMissing);
        isValid = false;
      } else if (!validateEmail(formData.email)) {
        setFieldError('email', t.invalidEmail);
        isValid = false;
      }
      
      if (!validatePhone(formData.phone)) {
        setFieldError('phone', t.invalidPhone);
        isValid = false;
      }
      
      return isValid;
    }
    
    if (section === 2) {
      if (!formData.category || !formData.description.trim()) {
        return false;
      }
      return true;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agreeToTerms) {
      setFieldError('agreeToTerms', 'You must agree to the terms');
      return;
    }
    
    await submit(formData);
  };
  
  // Tab configuration
  const tabs = [
    { id: 1, label: t.tabBasicInfo },
    { id: 2, label: t.tabDetails },
    { id: 3, label: t.tabReview },
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
          {/* Form Introduction */}
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <h1 className="font-serif text-xl text-[var(--primary)] mb-2">{t.formTitle}</h1>
              <p className="text-sm text-[var(--ink)] leading-relaxed">{t.formIntro}</p>
            </div>
          </div>
          
          {/* Animated Section Container */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* Section 1: Basic Information */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader
                    title={t.basicInfoTitle}
                    sectionNumber={1}
                    totalSections={3}
                  />
                  
                  <FormField
                    label={t.fullName}
                    required
                    error={errors.fullName}
                  >
                    <FormInput
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      placeholder={t.fullNamePlaceholder}
                      error={!!errors.fullName}
                      required
                    />
                  </FormField>
                  
                  <FormField
                    label={t.email}
                    required
                    error={errors.email}
                  >
                    <FormInput
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder={t.emailPlaceholder}
                      error={!!errors.email}
                      required
                    />
                  </FormField>
                  
                  <FormField
                    label={t.phone}
                    required
                    error={errors.phone}
                  >
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
              
              {/* Section 2: Details */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader
                    title={t.detailsTitle}
                    sectionNumber={2}
                    totalSections={3}
                  />
                  
                  <FormField label={t.category} required>
                    <FormSelect
                      value={formData.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      required
                    >
                      <option value="">{t.selectCategory}</option>
                      <option value="general">General Inquiry</option>
                      <option value="support">Support Request</option>
                      <option value="feedback">Feedback</option>
                    </FormSelect>
                  </FormField>
                  
                  <FormField label={t.description} required>
                    <FormTextarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder={t.descriptionPlaceholder}
                      rows={4}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.priority}>
                    <FormRadioGroup
                      name="priority"
                      options={[
                        { value: 'normal', label: t.priorityNormal },
                        { value: 'urgent', label: t.priorityUrgent },
                      ]}
                      value={formData.priority}
                      onChange={(value) => updateField('priority', value)}
                      direction="horizontal"
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
              
              {/* Section 3: Review & Confirm */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader
                    title={t.reviewTitle}
                    sectionNumber={3}
                    totalSections={3}
                  />
                  
                  {/* Review Summary */}
                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-[var(--muted)]">Name:</div>
                      <div className="font-medium">{formData.fullName}</div>
                      <div className="text-[var(--muted)]">Email:</div>
                      <div className="font-medium">{formData.email}</div>
                      <div className="text-[var(--muted)]">Phone:</div>
                      <div className="font-medium">{formData.phone}</div>
                      <div className="text-[var(--muted)]">Category:</div>
                      <div className="font-medium">{formData.category}</div>
                    </div>
                  </div>
                  
                  <FormCheckbox
                    label={t.agreeToTerms}
                    checked={formData.agreeToTerms}
                    onChange={(e) => updateField('agreeToTerms', e.target.checked)}
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

export default function ExampleForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <ExampleFormContent />
    </Suspense>
  );
}
