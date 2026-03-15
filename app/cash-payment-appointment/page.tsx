'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
import { buildings, buildingUnits } from '@/lib/buildings';
import {
  FormField,
  FormInput,
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

interface CashPaymentAppointmentFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  dateOfRequest: string;
  paymentAmount: string;
  paymentFor: string;
  requestedDates: string;
  bestContact: string;
  tenantSignature: string;
}

const initialFormData: CashPaymentAppointmentFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  dateOfRequest: new Date().toISOString().split('T')[0],
  paymentAmount: '',
  paymentFor: '',
  requestedDates: '',
  bestContact: '',
  tenantSignature: '',
};

function CashPaymentAppointmentFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<CashPaymentAppointmentFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/cash-payment-appointment', {
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
          <title>Cash Payment Appointment Request</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; color: #1a1a1a; background: #fdfcfa; padding: 48px 64px; font-size: 11px; line-height: 1.65; }
            .company-header { text-align: center; padding-bottom: 20px; margin-bottom: 28px; border-bottom: 2px solid #1a2744; }
            .company-header h1 { font-family: 'Libre Baskerville', serif; font-size: 20px; color: #1a2744; letter-spacing: 2px; margin-bottom: 6px; }
            .company-header p { font-size: 10px; color: #6b7280; letter-spacing: 0.5px; }
            .form-title { font-family: 'Libre Baskerville', serif; font-size: 16px; color: #1a2744; text-align: center; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 1px; }
            p { margin-bottom: 8px; font-size: 11px; }
            strong { font-weight: 600; }
            .field { margin-bottom: 14px; }
            .field-label { font-weight: 600; font-size: 10px; color: #1a2744; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .field-value { font-size: 11px; padding: 2px 0; border-bottom: 1px solid #d1d5db; min-height: 22px; }
            .notice-box { background: #f8f7f5; border-left: 3px solid #8b7355; padding: 12px 16px; margin: 14px 0; font-size: 11px; }
            .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; text-align: center; }
            @media print { body { padding: 24px 40px; background: white; } }
          </style>
        </head>
        <body>
          <div class="company-header">
            <h1>STANTON MANAGEMENT</h1>
            <p>421 Park Street, Hartford CT 06106 | (860) 993-3401</p>
          </div>
          <div class="form-title">Cash Payment Appointment Request</div>
          
          <div class="notice-box">
            <p>We do not accept walk-in cash payments. Cash is accepted by appointment only.</p>
          </div>
          
          <div class="field">
            <div class="field-label">Tenant Name</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Date of Request</div>
            <div class="field-value">${formData.dateOfRequest}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Payment Amount</div>
            <div class="field-value">$${formData.paymentAmount}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Payment For (month/period)</div>
            <div class="field-value">${formData.paymentFor}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Requested Appointment Date(s)</div>
            <div class="field-value">${formData.requestedDates}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Best Contact Number</div>
            <div class="field-value">${formData.bestContact}</div>
          </div>
          
          <p style="margin-top: 24px;"><strong>For office use:</strong></p>
          <p>Appointment confirmed: __________ Time: __________ Staff: __________</p>
          <p>Receipt issued: [ ] Yes Receipt #: __________</p>
          
          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return <LanguageLanding language={language} setLanguage={setLanguage} onLanguageSelect={() => setShowForm(true)} />;
  }

  if (submitSuccess) {
    return (
      <SuccessScreen
        title="Appointment Request Submitted"
        message="Your cash payment appointment request has been submitted. The office will contact you to confirm the appointment time."
        onPrint={handlePrint}
      />
    );
  }

  return (
    <>
      <Header />
      <SectionHeader
        title="Cash Payment Appointment Request"
        subtitle="Schedule appointment for cash rent payment (no walk-ins)"
      />
      
      <FormLayout>
        <TabNavigation
          tabs={['Tenant Information', 'Payment Details']}
          currentTab={currentSection}
          onTabChange={goToSection}
        />

        <AnimatePresence mode="wait">
          {currentSection === 0 && (
            <motion.div
              key="section1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FormSection title="Tenant Information">
                <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-sm text-amber-800">
                  <strong>Important:</strong> We do not accept walk-in cash payments. Cash is accepted by appointment only.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Tenant Name" error={errors.tenantName}>
                    <FormInput
                      value={formData.tenantName}
                      onChange={(value) => updateField('tenantName', value)}
                      placeholder="Enter tenant name"
                    />
                  </FormField>

                  <FormField label="Date of Request" error={errors.dateOfRequest}>
                    <FormInput
                      type="date"
                      value={formData.dateOfRequest}
                      onChange={(value) => updateField('dateOfRequest', value)}
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
                  />
                </FormField>

                <FormField label="Unit Number" error={errors.unitNumber}>
                  <FormSelect
                    value={formData.unitNumber}
                    onChange={(value) => updateField('unitNumber', value)}
                    disabled={!formData.buildingAddress}
                    placeholder="Select unit"
                  >
                    {formData.buildingAddress && buildingUnits[formData.buildingAddress]?.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField label="Best Contact Number" error={errors.bestContact}>
                  <FormInput
                    type="tel"
                    value={formData.bestContact}
                    onChange={(value) => updateField('bestContact', value)}
                    placeholder="(555) 123-4567"
                  />
                </FormField>
              </FormSection>
            </motion.div>
          )}

          {currentSection === 1 && (
            <motion.div
              key="section2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FormSection title="Payment Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Payment Amount" error={errors.paymentAmount}>
                    <FormInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.paymentAmount}
                      onChange={(value) => updateField('paymentAmount', value)}
                      placeholder="0.00"
                    />
                  </FormField>

                  <FormField label="Payment For (month/period)" error={errors.paymentFor}>
                    <FormInput
                      value={formData.paymentFor}
                      onChange={(value) => updateField('paymentFor', value)}
                      placeholder="e.g., April 2026 rent"
                    />
                  </FormField>
                </div>

                <FormField label="Requested Appointment Date(s)" error={errors.requestedDates}>
                  <textarea
                    value={formData.requestedDates}
                    onChange={(e) => updateField('requestedDates', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                    rows={3}
                    placeholder="Please provide 2-3 preferred dates and times..."
                  />
                </FormField>

                <div className="mt-4 p-3 bg-blue-50 text-sm text-blue-800">
                  <p className="mb-2"><strong>What to bring to your appointment:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Exact cash amount (we cannot provide change)</li>
                    <li>Your lease or account number</li>
                    <li>Valid photo ID</li>
                  </ul>
                </div>
              </FormSection>

              <FormSection title="Confirmation">
                <FormField label="Tenant Signature" error={errors.tenantSignature}>
                  <SignatureCanvasComponent
                    value={signature}
                    onChange={setSignature}
                    label="Draw your signature to submit request"
                  />
                </FormField>
              </FormSection>
            </motion.div>
          )}
        </AnimatePresence>

        {submitError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-lg">
            {submitError}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <FormButton
            variant="outline"
            onClick={prevSection}
            disabled={currentSection === 0}
          >
            Previous
          </FormButton>

          <div className="flex gap-3">
            <FormButton
              variant="outline"
              onClick={handlePrint}
              disabled={!formData.tenantName}
            >
              Print Form
            </FormButton>

            {currentSection < 1 ? (
              <FormButton onClick={nextSection}>
                Next
              </FormButton>
            ) : (
              <FormButton
                onClick={() => submit(formData)}
                disabled={isSubmitting || !signature}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function CashPaymentAppointmentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CashPaymentAppointmentFormContent />
    </Suspense>
  );
}
