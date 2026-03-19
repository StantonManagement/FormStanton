'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import { reimbursementTranslations, expenseCategories } from '@/lib/reimbursementTranslations';
import { emptyExpenseEntry } from '@/lib/types';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { PrintableForm } from '@/components/form';
import { getFormById } from '@/lib/formsData';

function ReimbursementLanguageLanding({ onSelect }: { onSelect: (lang: Language) => void }) {
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
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--primary)] mb-1">Tenant Reimbursement Request</h1>
            <p className="text-[var(--muted)] text-sm tracking-wide uppercase">Stanton Management LLC</p>
          </div>

          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden mb-8 p-6 sm:p-8">
            <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
              Please complete the information below to request reimbursement for expenses. Submit completed forms through the office mailbox or upload via AppFolio.
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

function ReimbursementFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const [showPrintable, setShowPrintable] = useState(false);

  const MAX_EXPENSES = 10;
  const MAX_FILES = 5;

  const [formData, setFormData] = useState({
    tenantName: '',
    buildingAddress: '',
    unitNumber: '',
    phone: '',
    email: '',
    dateSubmitted: new Date().toISOString().split('T')[0],
    expenses: [{ ...emptyExpenseEntry }],
    paymentPreference: '',
    urgency: 'normal',
    finalConfirm: false,
  });

  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [signature, setSignature] = useState('');

  const [currentSection, setCurrentSection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phoneValidationError, setPhoneValidationError] = useState('');
  const [emailValidationError, setEmailValidationError] = useState('');
  const [sectionError, setSectionError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [signatureError, setSignatureError] = useState('');

  const getCategoryLabel = (categoryValue: string, translations: Record<string, string>): string => {
    const category = expenseCategories.find(c => c.value === categoryValue);
    if (!category || !category.labelKey) return categoryValue;
    return translations[category.labelKey] || categoryValue;
  };

  if (!showForm) {
    return <ReimbursementLanguageLanding onSelect={(lang) => { setLanguage(lang); setShowForm(true); }} />;
  }

  const t = reimbursementTranslations[language];

  useEffect(() => {
    document.title = `${t.formTitle} - Stanton Management`;
  }, [t.formTitle]);

  const totalAmount = formData.expenses.reduce((sum, exp) => {
    const amt = parseFloat(exp.amount);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExpenseChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newExpenses = [...prev.expenses];
      newExpenses[index] = { ...newExpenses[index], [field]: value };
      return { ...prev, expenses: newExpenses };
    });
  };

  const addExpense = () => {
    if (formData.expenses.length < MAX_EXPENSES) {
      setFormData(prev => ({ ...prev, expenses: [...prev.expenses, { ...emptyExpenseEntry }] }));
    }
  };

  const removeExpense = (index: number) => {
    if (formData.expenses.length > 1) {
      setFormData(prev => ({
        ...prev,
        expenses: prev.expenses.filter((_, i) => i !== index),
      }));
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setReceiptFiles(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateSection = (section: number): boolean => {
    setSectionError('');
    setPhoneValidationError('');
    setEmailValidationError('');

    if (section === 1) {
      if (!formData.tenantName.trim() || !formData.buildingAddress || !formData.unitNumber.trim() || !formData.email.trim()) {
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (formData.phone.length !== 10) {
        setPhoneValidationError(t.phoneValidationError);
        setSectionError(t.requiredFieldsMissing);
        return false;
      }
      if (!isValidEmail(formData.email.trim())) {
        setEmailValidationError(t.emailValidationError);
        setSectionError(t.emailValidationError);
        return false;
      }
      return true;
    }

    if (section === 2) {
      for (const exp of formData.expenses) {
        if (!exp.date || !exp.category || !exp.description.trim() || !exp.amount) {
          setSectionError(t.incompleteExpenseEntry);
          return false;
        }
        if (isNaN(parseFloat(exp.amount)) || parseFloat(exp.amount) <= 0) {
          setSectionError(t.incompleteExpenseEntry);
          return false;
        }
      }
      return true;
    }

    if (section === 3) {
      return true;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    setSignatureError('');

    if (formData.phone.length !== 10) {
      setPhoneValidationError(t.phoneValidationError);
      setSubmitError(t.requiredFieldsMissing);
      setIsSubmitting(false);
      setCurrentSection(1);
      return;
    }

    if (!isValidEmail(formData.email.trim())) {
      setEmailValidationError(t.emailValidationError);
      setSubmitError(t.emailValidationError);
      setIsSubmitting(false);
      setCurrentSection(1);
      return;
    }

    for (const exp of formData.expenses) {
      if (!exp.date || !exp.category || !exp.description.trim() || !exp.amount) {
        setSubmitError(t.incompleteExpenseEntry);
        setIsSubmitting(false);
        setCurrentSection(2);
        return;
      }
    }

    if (!signature) {
      setSignatureError(t.signatureRequired);
      setSubmitError(t.signatureRequired);
      setIsSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('language', language);
      formDataToSend.append('formData', JSON.stringify(formData));
      formDataToSend.append('signature', signature);

      receiptFiles.forEach((file, i) => {
        formDataToSend.append(`receipt_${i}`, file);
      });

      const response = await fetch('/api/reimbursement', {
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
              {t.successTitle}
            </h2>
            <p className="text-[var(--muted)] leading-relaxed">
              {t.successMessage}
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
    { id: 1, label: t.tabTenantInfo },
    { id: 2, label: t.tabExpenses },
    { id: 3, label: t.tabAttachments },
    { id: 4, label: t.tabReview },
  ];

  const formTemplate = getFormById(20); // Reimbursement Request

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

      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm overflow-hidden">

            <TabNavigation
              tabs={tabs}
              activeTab={currentSection}
              onTabClick={setCurrentSection}
            />

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">

              {/* Intro */}
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
                    <div className="space-y-6">
                      <SectionHeader
                        title={t.tenantInfoTitle}
                        sectionNumber={1}
                        totalSections={totalSections}
                      />

                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.tenantName} <span className="text-[var(--error)]">*</span></span>
                          <input
                            type="text"
                            required
                            value={formData.tenantName}
                            onChange={(e) => handleInputChange('tenantName', e.target.value)}
                            placeholder={t.tenantNamePlaceholder}
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          <p className="text-xs text-[var(--muted)] mt-1">{t.tenantNameHelper}</p>
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
                            placeholder={t.phonePlaceholder}
                            maxLength={10}
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          {phoneValidationError && (
                            <p className="text-xs text-[var(--error)] mt-1">{phoneValidationError}</p>
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.email} <span className="text-[var(--error)]">*</span></span>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => {
                              handleInputChange('email', e.target.value);
                              if (e.target.value.trim() && !isValidEmail(e.target.value.trim())) {
                                setEmailValidationError(t.emailValidationError);
                              } else {
                                setEmailValidationError('');
                              }
                            }}
                            placeholder={t.emailPlaceholder}
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
                          {emailValidationError && (
                            <p className="text-xs text-[var(--error)] mt-1">{emailValidationError}</p>
                          )}
                          <p className="text-xs text-[var(--muted)] mt-1">{t.emailHelper}</p>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.building} <span className="text-[var(--error)]">*</span></span>
                          <BuildingAutocomplete
                            value={formData.buildingAddress}
                            onChange={(val) => { handleInputChange('buildingAddress', val); handleInputChange('unitNumber', ''); }}
                            buildings={buildings}
                            placeholder={t.selectBuilding}
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
                                <option value="">{t.selectUnit}</option>
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
                              placeholder={t.enterUnit}
                              className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                            />
                          )}
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.dateSubmitted}</span>
                          <input
                            type="date"
                            value={formData.dateSubmitted}
                            onChange={(e) => handleInputChange('dateSubmitted', e.target.value)}
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                          />
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
                          {t.continue}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 2: Expense Details */}
                  {currentSection === 2 && (
                    <div className="space-y-6">
                      <SectionHeader
                        title={t.expenseTitle}
                        sectionNumber={2}
                        totalSections={totalSections}
                      />

                      <div className="space-y-4">
                        {formData.expenses.map((expense, idx) => (
                          <div key={idx} className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)] relative">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-[var(--ink)]">{t.expenseNumber}{idx + 1}</h4>
                              {formData.expenses.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeExpense(idx)}
                                  className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                >
                                  {t.removeExpense}
                                </button>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.expenseDate} <span className="text-[var(--error)]">*</span></span>
                                  <input
                                    type="date"
                                    required
                                    value={expense.date}
                                    onChange={(e) => handleExpenseChange(idx, 'date', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.expenseCategory} <span className="text-[var(--error)]">*</span></span>
                                  <select
                                    required
                                    value={expense.category}
                                    onChange={(e) => handleExpenseChange(idx, 'category', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  >
                                    <option value="">{t.selectCategory}</option>
                                    {expenseCategories.map(cat => (
                                      <option key={cat.value} value={cat.value}>{t[cat.labelKey]}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <label className="block">
                                <span className="text-sm font-medium text-[var(--ink)]">{t.expenseDescription} <span className="text-[var(--error)]">*</span></span>
                                <input
                                  type="text"
                                  required
                                  value={expense.description}
                                  onChange={(e) => handleExpenseChange(idx, 'description', e.target.value)}
                                  className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                />
                              </label>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.expenseAmount} <span className="text-[var(--error)]">*</span></span>
                                  <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    value={expense.amount}
                                    onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-sm font-medium text-[var(--ink)]">{t.expenseNotes} <span className="text-[var(--muted)] font-normal">{t.optional}</span></span>
                                  <input
                                    type="text"
                                    value={expense.notes}
                                    onChange={(e) => handleExpenseChange(idx, 'notes', e.target.value)}
                                    className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}

                        {formData.expenses.length < MAX_EXPENSES ? (
                          <button
                            type="button"
                            onClick={addExpense}
                            className="w-full py-2.5 px-4 border-2 border-dashed border-[var(--primary)]/30 rounded-sm text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)]/50 transition-colors text-sm font-medium"
                          >
                            + {t.addExpense}
                          </button>
                        ) : (
                          <p className="text-xs text-center text-[var(--muted)]">{t.maxExpensesReached}</p>
                        )}

                        {/* Total */}
                        <div className="bg-[var(--primary)] text-white p-4 rounded-sm flex justify-between items-center">
                          <span className="font-semibold">{t.totalAmount}:</span>
                          <span className="text-xl font-bold">${totalAmount.toFixed(2)}</span>
                        </div>

                        {/* Payment Preference */}
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.paymentPreference}</span>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { value: 'check', label: t.paymentCheck },
                              { value: 'credit', label: t.paymentCredit },
                              { value: 'deposit', label: t.paymentDeposit },
                            ].map(option => (
                              <label key={option.value} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name="paymentPreference"
                                  value={option.value}
                                  checked={formData.paymentPreference === option.value}
                                  onChange={(e) => handleInputChange('paymentPreference', e.target.value)}
                                  className="text-[var(--primary)] focus:ring-[var(--primary)]"
                                />
                                <span className="text-sm text-[var(--ink)]">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Urgency */}
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.urgency}</span>
                          <div className="flex gap-3">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="urgency"
                                value="normal"
                                checked={formData.urgency === 'normal'}
                                onChange={(e) => handleInputChange('urgency', e.target.value)}
                                className="text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-sm text-[var(--ink)]">{t.urgencyNormal}</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="urgency"
                                value="urgent"
                                checked={formData.urgency === 'urgent'}
                                onChange={(e) => handleInputChange('urgency', e.target.value)}
                                className="text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-sm text-[var(--ink)] flex items-center gap-1">
                                <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                                {t.urgencyUrgent}
                              </span>
                            </label>
                          </div>
                        </div>

                        {sectionError && currentSection === 2 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700">{sectionError}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => { if (validateSection(2)) setCurrentSection(3); }}
                          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition"
                        >
                          {t.continue}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 3: Attachments */}
                  {currentSection === 3 && (
                    <div className="space-y-6">
                      <SectionHeader
                        title={t.attachmentsTitle}
                        sectionNumber={3}
                        totalSections={totalSections}
                      />

                      <div className="space-y-4">
                        <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm">
                          <p className="text-sm text-[var(--ink)]">{t.attachmentsIntro}</p>
                        </div>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.uploadReceipts}</span>
                          <p className="text-xs text-[var(--muted)] mb-2">{t.uploadHelper}</p>
                          {receiptFiles.length < MAX_FILES && (
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              multiple
                              onChange={handleFileAdd}
                              className="block w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/5 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/10"
                            />
                          )}
                        </label>

                        {receiptFiles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-[var(--ink)]">{receiptFiles.length} {t.filesSelected}</p>
                            {receiptFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-[var(--bg-section)] p-2 rounded-sm border border-[var(--border)]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-sm text-[var(--ink)] truncate">{file.name}</span>
                                  <span className="text-xs text-[var(--muted)] flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(idx)}
                                  className="text-[var(--error)] hover:text-red-700 text-xs font-medium ml-2 flex-shrink-0"
                                >
                                  {t.removeExpense}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {receiptFiles.length >= MAX_FILES && (
                          <p className="text-xs text-center text-[var(--muted)]">{t.maxFilesReached}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => { if (validateSection(3)) setCurrentSection(4); }}
                          className="w-full bg-[var(--primary)] text-white py-2 px-4 rounded-sm hover:bg-[var(--primary-light)] transition"
                        >
                          {t.continue}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Review & Sign */}
                  {currentSection === 4 && (
                    <div className="space-y-6">
                      <SectionHeader
                        title={t.reviewTitle}
                        sectionNumber={4}
                        totalSections={totalSections}
                      />

                      <div className="space-y-4">
                        <p className="text-sm text-[var(--muted)]">{t.reviewSummary}</p>

                        {/* Tenant Info Summary */}
                        <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                          <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewTenantInfo}</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-[var(--muted)]">{t.tenantName}:</span></div>
                            <div className="font-medium">{formData.tenantName}</div>
                            <div><span className="text-[var(--muted)]">{t.building}:</span></div>
                            <div className="font-medium">{formData.buildingAddress}</div>
                            <div><span className="text-[var(--muted)]">{t.unit}:</span></div>
                            <div className="font-medium">{formData.unitNumber}</div>
                            <div><span className="text-[var(--muted)]">{t.phone}:</span></div>
                            <div className="font-medium">{formData.phone}</div>
                            <div><span className="text-[var(--muted)]">{t.email}:</span></div>
                            <div className="font-medium">{formData.email}</div>
                          </div>
                        </div>

                        {/* Expenses Summary */}
                        <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                          <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewExpenses}</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--border)]">
                                  <th className="text-left py-1 pr-2 text-[var(--muted)]">{t.expenseDate}</th>
                                  <th className="text-left py-1 pr-2 text-[var(--muted)]">{t.expenseCategory}</th>
                                  <th className="text-left py-1 pr-2 text-[var(--muted)]">{t.expenseDescription}</th>
                                  <th className="text-right py-1 text-[var(--muted)]">{t.expenseAmount}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {formData.expenses.map((exp, idx) => (
                                  <tr key={idx} className="border-b border-[var(--divider)]">
                                    <td className="py-1 pr-2">{exp.date}</td>
                                    <td className="py-1 pr-2">{exp.category ? getCategoryLabel(exp.category, t) : ''}</td>
                                    <td className="py-1 pr-2">{exp.description}</td>
                                    <td className="py-1 text-right font-medium">${parseFloat(exp.amount || '0').toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="font-bold">
                                  <td colSpan={3} className="py-2 text-right">{t.totalAmount}:</td>
                                  <td className="py-2 text-right">${totalAmount.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        {/* Payment & Urgency */}
                        <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-[var(--muted)]">{t.reviewPayment}:</span></div>
                            <div className="font-medium">
                              {formData.paymentPreference === 'check' ? t.paymentCheck :
                               formData.paymentPreference === 'credit' ? t.paymentCredit :
                               formData.paymentPreference === 'deposit' ? t.paymentDeposit : '—'}
                            </div>
                            <div><span className="text-[var(--muted)]">{t.reviewUrgency}:</span></div>
                            <div className="font-medium">
                              {formData.urgency === 'urgent' ? (
                                <span className="text-red-600 flex items-center gap-1">
                                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                                  {t.urgencyUrgent}
                                </span>
                              ) : t.urgencyNormal}
                            </div>
                          </div>
                        </div>

                        {/* Attachments Summary */}
                        <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                          <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">{t.reviewAttachments}</h4>
                          {receiptFiles.length > 0 ? (
                            <ul className="text-sm text-[var(--ink)] space-y-1">
                              {receiptFiles.map((file, idx) => (
                                <li key={idx} className="flex items-center gap-1">
                                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  {file.name}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-[var(--muted)]">{t.noAttachments}</p>
                          )}
                        </div>

                        {/* Signature */}
                        <div className="space-y-2">
                          <SignatureCanvasComponent
                            label={t.signature}
                            value={signature}
                            onSave={(dataUrl) => {
                              setSignature(dataUrl);
                              setSignatureError('');
                            }}
                          />
                          {signatureError && (
                            <p className="text-sm text-red-600">{signatureError}</p>
                          )}
                        </div>

                        <label className="block">
                          <span className="text-sm font-medium text-[var(--ink)]">{t.signatureDate} <span className="text-[var(--error)]">*</span></span>
                          <input
                            type="date"
                            required
                            value={formData.dateSubmitted}
                            readOnly
                            className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-section)] text-[var(--ink)]"
                          />
                        </label>

                        {/* Final Confirm */}
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
                          {isSubmitting ? t.submitting : t.submit}
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

      <Footer />
    </>
  );
}

export default function ReimbursementForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <ReimbursementFormContent />
    </Suspense>
  );
}
