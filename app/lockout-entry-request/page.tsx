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
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';
import { openPrintWindow } from '@/lib/formPrintRenderer';

interface LockoutEntryFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  phone: string;
  lockoutDate: string;
  lockoutTime: string;
  entryProvided: boolean;
  staffMember: string;
  lockoutFee: string;
  feeCollected: boolean;
  paymentMethod: 'cash' | 'check' | 'credit' | 'charge_account' | '';
  notes: string;
  tenantSignature: string;
}

const initialFormData: LockoutEntryFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  phone: '',
  lockoutDate: new Date().toISOString().split('T')[0],
  lockoutTime: new Date().toTimeString().slice(0, 5),
  entryProvided: false,
  staffMember: '',
  lockoutFee: '25.00',
  feeCollected: false,
  paymentMethod: '',
  notes: '',
  tenantSignature: '',
};

function LockoutEntryFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';

  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);

  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');

  const { currentSection, nextSection, previousSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<LockoutEntryFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/lockout-entry-request', {
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
          <title>Lockout Entry Request</title>
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
          <div class="form-title">Lockout Entry Request</div>

          <div class="field">
            <div class="field-label">Tenant Name</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>

          <div class="field">
            <div class="field-label">Phone Number</div>
            <div class="field-value">${formData.phone}</div>
          </div>

          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>

          <div class="field">
            <div class="field-label">Date / Time of Lockout</div>
            <div class="field-value">${formData.lockoutDate} at ${formData.lockoutTime}</div>
          </div>

          <h2>Office Response</h2>

          <div class="checkbox-row">
            <div class="checkbox ${formData.entryProvided ? 'checked' : ''}"></div>
            <div>Entry was provided by office staff</div>
          </div>

          <div class="field">
            <div class="field-label">Staff Member</div>
            <div class="field-value">${formData.staffMember}</div>
          </div>

          <h2>Lockout Fee</h2>

          <div class="field">
            <div class="field-label">Fee Amount</div>
            <div class="field-value">$${formData.lockoutFee}</div>
          </div>

          <div class="checkbox-row">
            <div class="checkbox ${formData.feeCollected ? 'checked' : ''}"></div>
            <div>Fee collected</div>
          </div>

          <div class="field">
            <div class="field-label">Payment Method</div>
            <div class="field-value">${formData.paymentMethod ? formData.paymentMethod.replace('_', ' ') : ''}</div>
          </div>

          <div class="field">
            <div class="field-label">Notes</div>
            <div class="field-value" style="min-height: 40px;">${formData.notes}</div>
          </div>

          <div class="notice-box">
            <strong>Important:</strong> This lockout fee is separate from any key replacement costs. If you need replacement keys, please complete a separate Lock/Key Replacement Authorization form.
          </div>

          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>

          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Staff Member Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>

          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return (
      <LanguageLanding
        title="Lockout Entry Request"
        description="Request entry after locking keys in your unit during office hours"
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
        title="Lockout Entry Request Submitted"
        message="Your request has been recorded. A staff member will assist you shortly."
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const tabs = [
    { id: 1, label: 'Lockout Information' },
    { id: 2, label: 'Office Response' },
  ];

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />

      <FormLayout>
        <div className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="font-serif text-xl text-[var(--primary)] mb-2">Lockout Entry Request</h1>
                  <p className="text-sm text-[var(--ink)] leading-relaxed">
                    Complete this form when you have locked your keys inside your unit and need office assistance during business hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!formData.tenantName}
                  className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Form
                </button>
              </div>
            </div>
          </div>

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

                    <FormField label="Phone Number" error={errors.phone}>
                      <FormInput
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updateField('phone', value);
                        }}
                        placeholder="(555) 123-4567"
                        error={!!errors.phone}
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

                    <FormField label="Lockout Date" error={errors.lockoutDate}>
                      <FormInput
                        type="date"
                        value={formData.lockoutDate}
                        onChange={(e) => updateField('lockoutDate', e.target.value)}
                        error={!!errors.lockoutDate}
                      />
                    </FormField>
                  </div>

                  <FormField label="Time of Lockout" error={errors.lockoutTime}>
                    <FormInput
                      type="time"
                      value={formData.lockoutTime}
                      onChange={(e) => updateField('lockoutTime', e.target.value)}
                      error={!!errors.lockoutTime}
                    />
                  </FormField>

                  <FormField label="Notes">
                    <textarea
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
                      rows={3}
                      placeholder="Any additional details about the lockout..."
                    />
                  </FormField>

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
                    title="Office Response"
                    sectionNumber={2}
                    totalSections={2}
                  />

                  <div className="mb-4 p-3 border-l-4 border-[var(--accent)] bg-[var(--bg-section)] text-sm">
                    <strong>For office staff use:</strong> Complete this section when assisting the tenant.
                  </div>

                  <FormCheckbox
                    checked={formData.entryProvided}
                    onChange={(e) => updateField('entryProvided', e.target.checked)}
                    label="Entry was provided by office staff"
                  />

                  {formData.entryProvided && (
                    <div className="mt-4 space-y-4">
                      <FormField label="Staff Member Name">
                        <FormInput
                          type="text"
                          value={formData.staffMember}
                          onChange={(e) => updateField('staffMember', e.target.value)}
                          placeholder="Staff member who provided entry"
                        />
                      </FormField>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-[var(--divider)]">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-4">Lockout Fee</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Lockout Fee Amount">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
                          <FormInput
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.lockoutFee}
                            onChange={(e) => updateField('lockoutFee', e.target.value)}
                            className="pl-7"
                          />
                        </div>
                      </FormField>

                      <FormField label="Payment Method">
                        <FormSelect
                          value={formData.paymentMethod}
                          onChange={(e) => updateField('paymentMethod', e.target.value as any)}
                        >
                          <option value="">Select payment method</option>
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="credit">Credit Card</option>
                          <option value="charge_account">Charge to Account</option>
                        </FormSelect>
                      </FormField>
                    </div>

                    <div className="mt-4">
                      <FormCheckbox
                        checked={formData.feeCollected}
                        onChange={(e) => updateField('feeCollected', e.target.checked)}
                        label="Fee has been collected"
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection className="mt-6">
                  <FormField label="Tenant Signature" error={errors.tenantSignature}>
                    <SignatureCanvasComponent
                      value={signature}
                      onSave={setSignature}
                      label="Tenant signature acknowledging lockout fee"
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
                      disabled={isSubmitting || !signature}
                      loading={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
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

export default function LockoutEntryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <LockoutEntryFormContent />
    </Suspense>
  );
}
