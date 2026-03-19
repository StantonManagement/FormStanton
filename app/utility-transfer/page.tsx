// @ts-nocheck
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

interface UtilityData {
  utility: string;
  required: boolean;
  provider: string;
  accountNumber: string;
  transferDate: string;
}

interface UtilityTransferFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  leaseStartDate: string;
  utilities: UtilityData[];
  tenantSignature: string;
}

const initialFormData: UtilityTransferFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  leaseStartDate: '',
  utilities: [
    { utility: 'Electricity', required: true, provider: 'Eversource', accountNumber: '', transferDate: '' },
    { utility: 'Gas', required: false, provider: '', accountNumber: '', transferDate: '' },
    { utility: 'Internet / Cable', required: false, provider: '', accountNumber: '', transferDate: '' },
  ],
  tenantSignature: '',
};

function UtilityTransferFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<UtilityTransferFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/utility-transfer', {
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
          <title>Utility Transfer Confirmation</title>
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
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 7px 12px; text-align: left; }
            th { background: #f8f7f5; font-weight: 600; color: #1a2744; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
            .field { margin-bottom: 14px; }
            .field-label { font-weight: 600; font-size: 10px; color: #1a2744; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .field-value { font-size: 11px; padding: 2px 0; border-bottom: 1px solid #d1d5db; min-height: 22px; }
            .signature-block { margin-top: 32px; display: flex; gap: 40px; }
            .signature-item { flex: 1; }
            .signature-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .signature-line { border-bottom: 1px solid #1a1a1a; height: 28px; width: 100%; }
            .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; text-align: center; }
            @media print { body { padding: 24px 40px; background: white; } }
          </style>
        </head>
        <body>
          <div class="company-header">
            <h1>STANTON MANAGEMENT</h1>
            <p>421 Park Street, Hartford CT 06106 | (860) 993-3401</p>
          </div>
          <div class="form-title">Utility Transfer Confirmation</div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Lease Start Date</div>
            <div class="field-value">${formData.leaseStartDate}</div>
          </div>
          
          <h2>Utility Status</h2>
          <table>
            <tr>
              <th>Utility</th>
              <th>Required?</th>
              <th>Provider</th>
              <th>Account # / Confirmation</th>
              <th>Transfer Date</th>
            </tr>
            ${formData.utilities.map(u => `
              <tr>
                <td>${u.utility}</td>
                <td>${u.required ? 'Yes' : 'Check lease'}</td>
                <td>${u.provider || ''}</td>
                <td>${u.accountNumber || ''}</td>
                <td>${u.transferDate || ''}</td>
              </tr>
            `).join('')}
          </table>
          
          <p><strong>Note:</strong> Heat, water/sewer, and trash removal are typically included in rent. Confirm with your lease.</p>
          
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
          
          <p style="margin-top: 16px;"><strong>Keys released:</strong> [ ] Yes -- Date: __________ Staff initials: __________</p>
          
          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return (
      <LanguageLanding
        title="Utility Transfer Confirmation"
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
        title="Utility Transfer Confirmation Submitted"
        message="Your utility transfer confirmation has been submitted successfully. Keys will be released once all required utilities are confirmed."
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const updateUtility = (index: number, field: keyof UtilityData, value: string | boolean) => {
    const updatedUtilities = [...formData.utilities];
    updatedUtilities[index] = { ...updatedUtilities[index], [field]: value };
    updateField('utilities', updatedUtilities);
  };

  return (
    <>
      <Header />
      <SectionHeader
        title="Utility Transfer Confirmation"
        subtitle="Confirm utilities transferred before key release"
      />
      
      <FormLayout title="Utility Transfer Confirmation">
        <TabNavigation
          tabs={['Tenant Information', 'Utility Details']}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Tenant Name(s)" error={errors.tenantName}>
                    <FormInput
                      value={formData.tenantName}
                      onChange={(value) => updateField('tenantName', value)}
                      placeholder="Enter all tenant names"
                    />
                  </FormField>

                  <FormField label="Lease Start Date" error={errors.leaseStartDate}>
                    <FormInput
                      type="date"
                      value={formData.leaseStartDate}
                      onChange={(value) => updateField('leaseStartDate', value)}
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
              <FormSection title="Utility Information">
                <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-sm text-amber-800">
                  <strong>Important:</strong> Keys will not be released until required utilities have been transferred into the tenant's name. Please provide confirmation numbers or account numbers as proof.
                </div>

                <div className="space-y-4">
                  {formData.utilities.map((utility, index) => (
                    <div key={utility.utility} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">{utility.utility}</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <FormField label="Required?">
                          <div className="flex items-center h-10">
                            <input
                              type="checkbox"
                              checked={utility.required}
                              onChange={(e) => updateUtility(index, 'required', e.target.checked)}
                              className="w-4 h-4 text-[#1a2744] border-gray-300 rounded focus:ring-[#1a2744]"
                              disabled={utility.utility === 'Electricity'}
                            />
                            <span className="ml-2 text-sm text-gray-600">
                              {utility.utility === 'Electricity' ? 'Yes (Required)' : 'Check lease'}
                            </span>
                          </div>
                        </FormField>

                        <FormField label="Provider">
                          <FormInput
                            value={utility.provider}
                            onChange={(value) => updateUtility(index, 'provider', value)}
                            placeholder="e.g., Eversource"
                            disabled={utility.utility === 'Electricity'}
                          />
                        </FormField>

                        <FormField label="Account # / Confirmation">
                          <FormInput
                            value={utility.accountNumber}
                            onChange={(value) => updateUtility(index, 'accountNumber', value)}
                            placeholder="Account or confirmation #"
                          />
                        </FormField>

                        <FormField label="Transfer Date">
                          <FormInput
                            type="date"
                            value={utility.transferDate}
                            onChange={(value) => updateUtility(index, 'transferDate', value)}
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-50 text-sm text-gray-600">
                  <strong>Note:</strong> Heat, water/sewer, and trash removal are typically included in rent. Confirm with your lease.
                </div>
              </FormSection>

              <FormSection title="Signature">
                <FormField label="Tenant Signature" error={errors.tenantSignature}>
                  <SignatureCanvasComponent
                    value={signature}
                    onChange={setSignature}
                    label="Draw your signature"
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
                {isSubmitting ? 'Submitting...' : 'Submit Confirmation'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function UtilityTransferPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UtilityTransferFormContent />
    </Suspense>
  );
}
