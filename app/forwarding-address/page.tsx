'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/lib/translations';
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
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';
import { openPrintWindow } from '@/lib/formPrintRenderer';

interface ForwardingAddressFormData {
  tenantName: string;
  formerUnitAddress: string;
  moveOutDate: string;
  newMailingAddress: string;
  cityStateZip: string;
  newPhoneNumber: string;
  emailAddress: string;
  tenantSignature: string;
}

const initialFormData: ForwardingAddressFormData = {
  tenantName: '',
  formerUnitAddress: '',
  moveOutDate: '',
  newMailingAddress: '',
  cityStateZip: '',
  newPhoneNumber: '',
  emailAddress: '',
  tenantSignature: '',
};

function ForwardingAddressFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<ForwardingAddressFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/forwarding-address', {
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
          <title>Forwarding Address Submission</title>
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
            .signature-block { margin-top: 32px; display: flex; gap: 40px; }
            .signature-item { flex: 1; }
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
          <div class="form-title">Forwarding Address Submission</div>
          
          <div class="notice-box">
            <p>Your security deposit cannot be returned without a forwarding address on file.</p>
          </div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Former Unit Address</div>
            <div class="field-value">${formData.formerUnitAddress}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Move-Out Date</div>
            <div class="field-value">${formData.moveOutDate}</div>
          </div>
          
          <h2>Forwarding Information</h2>
          
          <div class="field">
            <div class="field-label">New Mailing Address</div>
            <div class="field-value">${formData.newMailingAddress}</div>
          </div>
          
          <div class="field">
            <div class="field-label">City / State / ZIP</div>
            <div class="field-value">${formData.cityStateZip}</div>
          </div>
          
          <div class="field">
            <div class="field-label">New Phone Number</div>
            <div class="field-value">${formData.newPhoneNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Email Address</div>
            <div class="field-value">${formData.emailAddress}</div>
          </div>
          
          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
            <div class="signature-item">
              <div class="signature-label">Received by (Stanton Management)</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>
          
          <p style="margin-top: 16px;"><strong>Deposit return deadline:</strong> __________ (30 days from move-out)</p>
          
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
        title="Forwarding Address Submitted"
        message="Your forwarding address has been submitted. This is required for security deposit return."
        onPrint={handlePrint}
      />
    );
  }

  return (
    <>
      <Header />
      <SectionHeader
        title="Forwarding Address Submission"
        subtitle="Required for security deposit return"
      />
      
      <FormLayout>
        <TabNavigation
          tabs={['Move-Out Information', 'Forwarding Address']}
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
              <FormSection title="Move-Out Information">
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-800">
                  <strong>Note:</strong> Your security deposit cannot be returned without a forwarding address on file.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Tenant Name(s)" error={errors.tenantName}>
                    <FormInput
                      value={formData.tenantName}
                      onChange={(value) => updateField('tenantName', value)}
                      placeholder="Enter all tenant names"
                    />
                  </FormField>

                  <FormField label="Move-Out Date" error={errors.moveOutDate}>
                    <FormInput
                      type="date"
                      value={formData.moveOutDate}
                      onChange={(value) => updateField('moveOutDate', value)}
                    />
                  </FormField>
                </div>

                <FormField label="Former Unit Address" error={errors.formerUnitAddress}>
                  <FormInput
                    value={formData.formerUnitAddress}
                    onChange={(value) => updateField('formerUnitAddress', value)}
                    placeholder="Building Address - Unit X"
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
              <FormSection title="Forwarding Information">
                <FormField label="New Mailing Address" error={errors.newMailingAddress}>
                  <FormInput
                    value={formData.newMailingAddress}
                    onChange={(value) => updateField('newMailingAddress', value)}
                    placeholder="123 Main Street, Apt 4B"
                  />
                </FormField>

                <FormField label="City / State / ZIP" error={errors.cityStateZip}>
                  <FormInput
                    value={formData.cityStateZip}
                    onChange={(value) => updateField('cityStateZip', value)}
                    placeholder="Hartford, CT 06106"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="New Phone Number" error={errors.newPhoneNumber}>
                    <FormInput
                      type="tel"
                      value={formData.newPhoneNumber}
                      onChange={(value) => updateField('newPhoneNumber', value)}
                      placeholder="(555) 123-4567"
                    />
                  </FormField>

                  <FormField label="Email Address" error={errors.emailAddress}>
                    <FormInput
                      type="email"
                      value={formData.emailAddress}
                      onChange={(value) => updateField('emailAddress', value)}
                      placeholder="tenant@email.com"
                    />
                  </FormField>
                </div>

                <div className="mt-4 p-3 bg-gray-50 text-sm text-gray-600">
                  <p><strong>Important:</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Your security deposit will be returned within 30 days of move-out</li>
                    <li>Itemized deductions will be provided if applicable</li>
                    <li>Keep this address updated until you receive your deposit</li>
                  </ul>
                </div>
              </FormSection>

              <FormSection title="Confirmation">
                <FormField label="Tenant Signature" error={errors.tenantSignature}>
                  <SignatureCanvasComponent
                    value={signature}
                    onChange={setSignature}
                    label="Draw your signature to confirm"
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
                {isSubmitting ? 'Submitting...' : 'Submit Address'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function ForwardingAddressPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForwardingAddressFormContent />
    </Suspense>
  );
}
