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

interface LeaseRenewalFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  currentLeaseEndDate: string;
  dateOfNotice: string;
  intent: 'renew' | 'not_renew';
  vacateDate: string;
  forwardingAddress: string;
  newLeaseTerm: string;
  newMonthlyRent: string;
  rentChange: 'no_change' | 'increase' | 'decrease';
  newTerms: string;
  offerExpirationDate: string;
  tenantSignature: string;
}

const initialFormData: LeaseRenewalFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  currentLeaseEndDate: '',
  dateOfNotice: new Date().toISOString().split('T')[0],
  intent: 'renew',
  vacateDate: '',
  forwardingAddress: '',
  newLeaseTerm: '',
  newMonthlyRent: '',
  rentChange: 'no_change',
  newTerms: '',
  offerExpirationDate: '',
  tenantSignature: '',
};

function LeaseRenewalFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<LeaseRenewalFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/lease-renewal', {
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
          <title>Lease Renewal / Non-Renewal Notice</title>
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
            .management-section { background: #f8f7f5; padding: 16px; margin-top: 20px; border: 1px solid #d1d5db; }
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
          <div class="form-title">Lease Renewal / Non-Renewal Notice</div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Current Lease End Date</div>
            <div class="field-value">${formData.currentLeaseEndDate}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Date of Notice</div>
            <div class="field-value">${formData.dateOfNotice}</div>
          </div>
          
          <h2>Section A -- For Tenant Use</h2>
          
          <p><strong>I intend to:</strong></p>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.intent === 'renew' ? 'checked' : ''}"></div>
            <div><strong>Renew my lease</strong> for another term. I understand new lease terms will be provided by the office.</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.intent === 'not_renew' ? 'checked' : ''}"></div>
            <div><strong>Not renew my lease.</strong> I will vacate on or before: ${formData.vacateDate}</div>
          </div>
          
          ${formData.intent === 'not_renew' ? `
            <p><strong>Forwarding Address (if not renewing):</strong> ${formData.forwardingAddress}</p>
          ` : ''}
          
          ${formData.intent === 'renew' ? `
            <div class="management-section">
              <h2>Section B -- For Management Use (Renewal Offer)</h2>
              
              <div class="field">
                <div class="field-label">New Lease Term</div>
                <div class="field-value">${formData.newLeaseTerm}</div>
              </div>
              
              <div class="field">
                <div class="field-label">New Monthly Rent</div>
                <div class="field-value">$${formData.newMonthlyRent}</div>
              </div>
              
              <div class="field">
                <div class="field-label">Rent Change</div>
                <div class="field-value">${formData.rentChange === 'no_change' ? 'No change' : formData.rentChange === 'increase' ? 'Increase' : 'Decrease'}</div>
              </div>
              
              <div class="field">
                <div class="field-label">New Terms / Notes</div>
                <div class="field-value" style="min-height: 60px;">${formData.newTerms}</div>
              </div>
              
              <div class="field">
                <div class="field-label">Offer Expiration Date</div>
                <div class="field-value">${formData.offerExpirationDate}</div>
              </div>
            </div>
          ` : ''}
          
          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
            <div class="signature-item">
              <div class="signature-label">Stanton Management Representative</div>
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
        title="Lease Renewal / Non-Renewal Notice"
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
        title="Lease Notice Submitted"
        message={formData.intent === 'renew' 
          ? "Your lease renewal request has been submitted. We will contact you with renewal terms."
          : "Your non-renewal notice has been submitted. Thank you for letting us know."
        }
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  return (
    <>
      <Header />
      <SectionHeader
        title="Lease Renewal / Non-Renewal Notice"
        subtitle="Tenant intent to renew or vacate at lease end"
      />
      
      <FormLayout title="Lease Renewal / Non-Renewal Notice">
        <TabNavigation
          tabs={['Tenant Information', 'Lease Intent']}
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
              <FormSection title="Lease Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Tenant Name(s)" error={errors.tenantName}>
                    <FormInput
                      value={formData.tenantName}
                      onChange={(value) => updateField('tenantName', value)}
                      placeholder="Enter all tenant names"
                    />
                  </FormField>

                  <FormField label="Date of Notice" error={errors.dateOfNotice}>
                    <FormInput
                      type="date"
                      value={formData.dateOfNotice}
                      onChange={(value) => updateField('dateOfNotice', value)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <FormField label="Current Lease End Date" error={errors.currentLeaseEndDate}>
                    <FormInput
                      type="date"
                      value={formData.currentLeaseEndDate}
                      onChange={(value) => updateField('currentLeaseEndDate', value)}
                    />
                  </FormField>
                </div>
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
              <FormSection title="Section A -- For Tenant Use">
                <FormField label="I intend to">
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 border cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="intent"
                        value="renew"
                        checked={formData.intent === 'renew'}
                        onChange={(e) => updateField('intent', e.target.value as any)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-semibold">Renew my lease</div>
                        <div className="text-sm text-gray-600">for another term. I understand new lease terms will be provided by the office.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="intent"
                        value="not_renew"
                        checked={formData.intent === 'not_renew'}
                        onChange={(e) => updateField('intent', e.target.value as any)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-semibold">Not renew my lease</div>
                        <div className="text-sm text-gray-600">I will vacate on or before:</div>
                        <FormInput
                          type="date"
                          value={formData.vacateDate}
                          onChange={(value) => updateField('vacateDate', value)}
                          disabled={formData.intent !== 'not_renew'}
                          className="mt-2"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          (This also serves as my 30-day written notice if submitted at least 30 days prior to lease end)
                        </div>
                      </div>
                    </label>
                  </div>
                </FormField>

                {formData.intent === 'not_renew' && (
                  <FormField label="Forwarding Address (if not renewing)">
                    <FormInput
                      value={formData.forwardingAddress}
                      onChange={(value) => updateField('forwardingAddress', value)}
                      placeholder="New address for security deposit return"
                    />
                  </FormField>
                )}
              </FormSection>

              {formData.intent === 'renew' && (
                <FormSection title="Section B -- For Management Use (Renewal Offer)">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-4">
                      This section will be completed by Stanton Management with renewal terms.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="New Lease Term">
                        <FormInput
                          value={formData.newLeaseTerm}
                          onChange={(value) => updateField('newLeaseTerm', value)}
                          placeholder="e.g., 12 months"
                        />
                      </FormField>

                      <FormField label="New Monthly Rent">
                        <FormInput
                          value={formData.newMonthlyRent}
                          onChange={(value) => updateField('newMonthlyRent', value)}
                          placeholder="$0.00"
                        />
                      </FormField>
                    </div>

                    <FormField label="Rent Change">
                      <div className="flex gap-4">
                        {[
                          { value: 'no_change', label: 'No change' },
                          { value: 'increase', label: 'Increase' },
                          { value: 'decrease', label: 'Decrease' },
                        ].map((option) => (
                          <label key={option.value} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="rentChange"
                              value={option.value}
                              checked={formData.rentChange === option.value}
                              onChange={(e) => updateField('rentChange', e.target.value as any)}
                              className="text-[#1a2744]"
                            />
                            <span className="text-sm">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </FormField>

                    <FormField label="New Terms / Notes">
                      <textarea
                        value={formData.newTerms}
                        onChange={(e) => updateField('newTerms', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                        rows={4}
                        placeholder="Any new terms or conditions..."
                      />
                    </FormField>

                    <FormField label="Offer Expiration Date">
                      <FormInput
                        type="date"
                        value={formData.offerExpirationDate}
                        onChange={(value) => updateField('offerExpirationDate', value)}
                      />
                    </FormField>
                  </div>
                </FormSection>
              )}

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
                disabled={isSubmitting || !signature || (formData.intent === 'not_renew' && !formData.vacateDate)}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Notice'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function LeaseRenewalPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LeaseRenewalFormContent />
    </Suspense>
  );
}
