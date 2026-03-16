'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
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
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';
import { openPrintWindow } from '@/lib/formPrintRenderer';

interface AfterHoursLockoutFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  dateOfLockout: string;
  timeOfLockout: string;
  acknowledgments: {
    tenantResponsibility: boolean;
    hireLocksmith: boolean;
    notResponsible: boolean;
    reportToOffice: boolean;
    securityConcern: boolean;
  };
  locksmithUsed: string;
  estimatedCost: string;
  tenantSignature: string;
}

const initialFormData: AfterHoursLockoutFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  dateOfLockout: new Date().toISOString().split('T')[0],
  timeOfLockout: '',
  acknowledgments: {
    tenantResponsibility: false,
    hireLocksmith: false,
    notResponsible: false,
    reportToOffice: false,
    securityConcern: false,
  },
  locksmithUsed: '',
  estimatedCost: '',
  tenantSignature: '',
};

function AfterHoursLockoutFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, previousSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<AfterHoursLockoutFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/after-hours-lockout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        signature,
        language,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
    
    return response.json();
  });

  const handlePrint = () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>After-Hours Lockout Acknowledgment</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #fdfcfa; padding: 48px 64px; font-size: 11px; line-height: 1.65; }
            .company-header { text-align: center; padding-bottom: 20px; margin-bottom: 28px; border-bottom: 2px solid #1a2744; }
            .company-header h1 { font-family: 'Libre Baskerville', serif; font-size: 20px; color: #1a2744; letter-spacing: 2px; margin-bottom: 6px; }
            .company-header p { font-size: 10px; color: #6b7280; letter-spacing: 0.5px; }
            .form-title { font-family: 'Libre Baskerville', serif; font-size: 16px; color: #1a2744; text-align: center; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 1px; }
            h2 { font-family: 'Libre Baskerville', serif; font-size: 13px; color: #1a2744; margin-top: 24px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #d1d5db; }
            p { margin-bottom: 8px; font-size: 11px; }
            strong { font-weight: 600; }
            .field { margin-bottom: 14px; }
            .field-label { font-weight: 600; font-size: 10px; color: #1a2744; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .field-value { font-size: 11px; padding: 2px 0; border-bottom: 1px solid #d1d5db; min-height: 22px; }
            .checkbox-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
            .checkbox { width: 14px; height: 14px; border: 1.5px solid #1a2744; flex-shrink: 0; margin-top: 2px; }
            .checkbox.checked { background: #1a2744; }
            .signature-block { margin-top: 32px; }
            .signature-item { margin-bottom: 16px; }
            .signature-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .signature-line { border-bottom: 1px solid #1a1a1a; height: 28px; width: 100%; }
            .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; text-align: center; }
            .notice-box { background: #f8f7f5; border-left: 3px solid #8b7355; padding: 12px 16px; margin: 14px 0; font-size: 11px; }
            @media print { body { padding: 24px 40px; background: white; } }
          </style>
        </head>
        <body>
          <div class="company-header">
            <h1>STANTON MANAGEMENT</h1>
            <p>421 Park Street, Hartford CT 06106 | (860) 993-3401</p>
          </div>
          <div class="form-title">After-Hours Lockout Acknowledgment</div>
          
          <div class="field">
            <div class="field-label">Tenant Name</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Date / Time of Lockout</div>
            <div class="field-value">${formData.dateOfLockout} at ${formData.timeOfLockout}</div>
          </div>
          
          <h2>Acknowledgment</h2>
          
          <p>I understand the following:</p>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.tenantResponsibility ? 'checked' : ''}"></div>
            <div>After-hours lockouts are my responsibility to resolve</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.hireLocksmith ? 'checked' : ''}"></div>
            <div>I must hire a licensed locksmith at my own expense</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.notResponsible ? 'checked' : ''}"></div>
            <div>Stanton Management is not responsible for after-hours lockout costs</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.reportToOffice ? 'checked' : ''}"></div>
            <div>If I lose my key, I must report it to the office on the next business day</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.securityConcern ? 'checked' : ''}"></div>
            <div>If a security concern exists, a lock change may be required at my expense</div>
          </div>
          
          <div class="field">
            <div class="field-label">Locksmith used (if known)</div>
            <div class="field-value">${formData.locksmithUsed}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Estimated cost</div>
            <div class="field-value">$${formData.estimatedCost}</div>
          </div>
          
          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>
          
          <p><strong>Acknowledged by (office, if during hours):</strong> _________________________ Date: __________</p>
          
          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return (
      <LanguageLanding
        title="After-Hours Lockout Acknowledgment"
        description="Acknowledge tenant responsibility for after-hours lockouts"
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
        title="Lockout Acknowledgment Submitted"
        message="Your after-hours lockout acknowledgment has been recorded. Please contact the office on the next business day if you lost your key."
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const updateAcknowledgment = (key: keyof typeof initialFormData.acknowledgments, value: boolean) => {
    updateField('acknowledgments', {
      ...formData.acknowledgments,
      [key]: value,
    });
  };

  const allAcknowledgmentsChecked = Object.values(formData.acknowledgments).every(v => v);

  const tabs = [
    { id: 1, label: 'Lockout Information' },
    { id: 2, label: 'Acknowledgments' },
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

        <div className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {currentSection === 1 && (
              <motion.div
                key="section1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <FormSection>
                  <SectionHeader
                    title="Lockout Information"
                    sectionNumber={1}
                    totalSections={2}
                  />

                  <div className="mb-4 p-3 border-l-4 border-red-400 bg-red-50 text-sm text-red-800">
                    <strong>Emergency Contact:</strong> If you are locked out during business hours, call (860) 993-3401 and press 2. For after-hours lockouts, you must contact a licensed locksmith at your own expense.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Tenant Name" error={errors.tenantName}>
                      <FormInput
                        type="text"
                        value={formData.tenantName}
                        onChange={(e) => updateField('tenantName', e.target.value)}
                        placeholder="Enter tenant name"
                        error={!!errors.tenantName}
                      />
                    </FormField>

                    <FormField label="Date of Lockout" error={errors.dateOfLockout}>
                      <FormInput
                        type="date"
                        value={formData.dateOfLockout}
                        onChange={(e) => updateField('dateOfLockout', e.target.value)}
                        error={!!errors.dateOfLockout}
                      />
                    </FormField>
                  </div>

                  <FormField label="Building Address" error={errors.buildingAddress}>
                    <BuildingAutocomplete
                      value={formData.buildingAddress}
                      onChange={(value) => {
                        updateField('buildingAddress', value);
                        updateField('unitNumber', '');
                      }}
                      buildings={buildings}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Unit Number" error={errors.unitNumber}>
                      {formData.buildingAddress && buildingUnits[formData.buildingAddress] ? (
                        <FormSelect
                          value={formData.unitNumber}
                          onChange={(e) => updateField('unitNumber', e.target.value)}
                          disabled={!formData.buildingAddress}
                          error={!!errors.unitNumber}
                        >
                          <option value="">Select unit</option>
                          {buildingUnits[formData.buildingAddress].map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </FormSelect>
                      ) : (
                        <FormInput
                          type="text"
                          value={formData.unitNumber}
                          onChange={(e) => updateField('unitNumber', e.target.value)}
                          placeholder="Enter unit number"
                          error={!!errors.unitNumber}
                        />
                      )}
                    </FormField>

                    <FormField label="Time of Lockout" error={errors.timeOfLockout}>
                      <FormInput
                        type="time"
                        value={formData.timeOfLockout}
                        onChange={(e) => updateField('timeOfLockout', e.target.value)}
                        error={!!errors.timeOfLockout}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Locksmith used (if known)">
                      <FormInput
                        type="text"
                        value={formData.locksmithUsed}
                        onChange={(e) => updateField('locksmithUsed', e.target.value)}
                        placeholder="Locksmith company name"
                      />
                    </FormField>

                    <FormField label="Estimated cost">
                      <FormInput
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.estimatedCost}
                        onChange={(e) => updateField('estimatedCost', e.target.value)}
                        placeholder="0.00"
                      />
                    </FormField>
                  </div>

                  <FormButton
                    type="button"
                    onClick={nextSection}
                    fullWidth
                  >
                    Continue
                  </FormButton>
                </FormSection>
              </motion.div>
            )}

            {currentSection === 2 && (
              <motion.div
                key="section2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <FormSection>
                  <SectionHeader
                    title="Acknowledgment"
                    sectionNumber={2}
                    totalSections={2}
                  />

                  <p className="mb-4 text-sm text-[var(--muted)]">I understand the following:</p>

                  <div className="space-y-3">
                    <FormCheckbox
                      checked={formData.acknowledgments.tenantResponsibility}
                      onChange={(e) => updateAcknowledgment('tenantResponsibility', e.target.checked)}
                      label="After-hours lockouts are my responsibility to resolve"
                    />

                    <FormCheckbox
                      checked={formData.acknowledgments.hireLocksmith}
                      onChange={(e) => updateAcknowledgment('hireLocksmith', e.target.checked)}
                      label="I must hire a licensed locksmith at my own expense"
                    />

                    <FormCheckbox
                      checked={formData.acknowledgments.notResponsible}
                      onChange={(e) => updateAcknowledgment('notResponsible', e.target.checked)}
                      label="Stanton Management is not responsible for after-hours lockout costs"
                    />

                    <FormCheckbox
                      checked={formData.acknowledgments.reportToOffice}
                      onChange={(e) => updateAcknowledgment('reportToOffice', e.target.checked)}
                      label="If I lose my key, I must report it to the office on the next business day"
                    />

                    <FormCheckbox
                      checked={formData.acknowledgments.securityConcern}
                      onChange={(e) => updateAcknowledgment('securityConcern', e.target.checked)}
                      label="If a security concern exists, a lock change may be required at my expense"
                    />
                  </div>
                </FormSection>

                <FormSection className="mt-6">
                  <FormField label="Tenant Signature" error={errors.tenantSignature}>
                    <SignatureCanvasComponent
                      value={signature}
                      onSave={setSignature}
                      label="Draw your signature to acknowledge"
                    />
                  </FormField>
                </FormSection>

                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <FormButton
                    variant="secondary"
                    onClick={previousSection}
                  >
                    Previous
                  </FormButton>

                  <div className="flex gap-3">
                    <FormButton
                      variant="ghost"
                      onClick={handlePrint}
                      disabled={!formData.tenantName}
                    >
                      Print Form
                    </FormButton>

                    <FormButton
                      variant="success"
                      onClick={() => submit(formData)}
                      disabled={isSubmitting || !signature || !allAcknowledgmentsChecked}
                      loading={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Acknowledgment'}
                    </FormButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function AfterHoursLockoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <AfterHoursLockoutFormContent />
    </Suspense>
  );
}
