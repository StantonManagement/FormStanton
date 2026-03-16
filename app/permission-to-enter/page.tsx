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

interface PermissionToEnterFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  date: string;
  option: 'standing' | 'restriction';
  hasPet: boolean;
  petPrecautions: string;
  contactMethod: 'phone' | 'text';
  contactNumber: string;
  preferredHours: string;
  tenantSignature: string;
}

const initialFormData: PermissionToEnterFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  date: new Date().toISOString().split('T')[0],
  option: 'standing',
  hasPet: false,
  petPrecautions: '',
  contactMethod: 'phone',
  contactNumber: '',
  preferredHours: '',
  tenantSignature: '',
};

function PermissionToEnterFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<PermissionToEnterFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/permission-to-enter', {
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
          <title>Permission to Enter / Entry Restriction</title>
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
            @media print { body { padding: 24px 40px; background: white; } }
          </style>
        </head>
        <body>
          <div class="company-header">
            <h1>STANTON MANAGEMENT</h1>
            <p>421 Park Street, Hartford CT 06106 | (860) 993-3401</p>
          </div>
          <div class="form-title">Permission to Enter / Entry Restriction</div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Date</div>
            <div class="field-value">${formData.date}</div>
          </div>
          
          <h2>Select One</h2>
          
          <h3>Option A -- Standing Permission to Enter</h3>
          <div class="checkbox-row">
            <div class="checkbox ${formData.option === 'standing' ? 'checked' : ''}"></div>
            <div>
              <p>I authorize Stanton Management and its contractors to enter my unit for scheduled maintenance and inspections during standard hours (Mon-Fri, 8 AM-6 PM) with 24 hours' advance notice, without requiring me to be present.</p>
              ${formData.hasPet ? `<p>I also have a pet in the unit. Please take precautions: ${formData.petPrecautions}</p>` : ''}
            </div>
          </div>
          
          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>
          
          <h3>Option B -- Entry Restriction / Must Be Present</h3>
          <div class="checkbox-row">
            <div class="checkbox ${formData.option === 'restriction' ? 'checked' : ''}"></div>
            <div>
              <p>I require that a Stanton Management representative contact me before any non-emergency entry. I understand this may delay repairs.</p>
              <p><strong>Preferred contact method:</strong> ${formData.contactMethod === 'phone' ? 'Phone' : 'Text'}</p>
              <p><strong>Contact number:</strong> ${formData.contactNumber}</p>
              <p><strong>Preferred hours for entry:</strong> ${formData.preferredHours}</p>
              <p>I understand that in the event of an emergency, Stanton Management may enter without prior notice.</p>
            </div>
          </div>
          
          <div class="signature-block">
            <div class="signature-item">
              <div class="signature-label">Tenant Signature</div>
              <div class="signature-line"></div>
              <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">Date: __________</div>
            </div>
          </div>
          
          <p style="margin-top: 16px;"><strong>For office use -- noted in file:</strong> __________ Date: __________</p>
          
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
        title="Permission to Enter Submitted"
        message="Your entry preference has been recorded and submitted to Stanton Management."
        onPrint={handlePrint}
      />
    );
  }

  return (
    <>
      <Header />
      <SectionHeader
        title="Permission to Enter / Entry Restriction"
        subtitle="Set entry preferences for maintenance and inspections"
      />
      
      <FormLayout>
        <TabNavigation
          tabs={['Tenant Information', 'Entry Preferences']}
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

                  <FormField label="Date" error={errors.date}>
                    <FormInput
                      type="date"
                      value={formData.date}
                      onChange={(value) => updateField('date', value)}
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
              <FormSection title="Entry Preference">
                <div className="space-y-4">
                  <label className={`flex items-start gap-3 p-4 border cursor-pointer transition-colors ${
                    formData.option === 'standing' ? 'border-[#1a2744] bg-blue-50/30' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="option"
                      checked={formData.option === 'standing'}
                      onChange={() => updateField('option', 'standing')}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-semibold mb-2">Option A -- Standing Permission to Enter</div>
                      <div className="text-sm text-gray-600">
                        I authorize Stanton Management and its contractors to enter my unit for scheduled maintenance and inspections during standard hours (Mon-Fri, 8 AM-6 PM) with 24 hours' advance notice, without requiring me to be present.
                      </div>
                    </div>
                  </label>

                  {formData.option === 'standing' && (
                    <div className="ml-8 p-3 bg-gray-50 rounded-lg">
                      <FormField label="Do you have a pet in the unit?">
                        <div className="flex items-center gap-2">
                          <FormCheckbox
                            checked={formData.hasPet}
                            onChange={(checked) => updateField('hasPet', checked)}
                            label="Yes, I have a pet"
                          />
                        </div>
                      </FormField>

                      {formData.hasPet && (
                        <FormField label="Please take precautions">
                          <FormInput
                            value={formData.petPrecautions}
                            onChange={(value) => updateField('petPrecautions', value)}
                            placeholder="e.g., Dog may be crated, cat is shy, etc."
                          />
                        </FormField>
                      )}
                    </div>
                  )}

                  <label className={`flex items-start gap-3 p-4 border cursor-pointer transition-colors ${
                    formData.option === 'restriction' ? 'border-[#1a2744] bg-blue-50/30' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="option"
                      checked={formData.option === 'restriction'}
                      onChange={() => updateField('option', 'restriction')}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-semibold mb-2">Option B -- Entry Restriction / Must Be Present</div>
                      <div className="text-sm text-gray-600">
                        I require that a Stanton Management representative contact me before any non-emergency entry. I understand this may delay repairs.
                      </div>
                    </div>
                  </label>

                  {formData.option === 'restriction' && (
                    <div className="ml-8 space-y-3">
                      <FormField label="Preferred contact method">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={formData.contactMethod === 'phone'}
                              onChange={() => updateField('contactMethod', 'phone')}
                              className="text-[#1a2744]"
                            />
                            <span className="text-sm">Phone</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={formData.contactMethod === 'text'}
                              onChange={() => updateField('contactMethod', 'text')}
                              className="text-[#1a2744]"
                            />
                            <span className="text-sm">Text</span>
                          </label>
                        </div>
                      </FormField>

                      <FormField label="Contact number">
                        <FormInput
                          value={formData.contactNumber}
                          onChange={(value) => updateField('contactNumber', value)}
                          placeholder="(555) 123-4567"
                        />
                      </FormField>

                      <FormField label="Preferred hours for entry">
                        <FormInput
                          value={formData.preferredHours}
                          onChange={(value) => updateField('preferredHours', value)}
                          placeholder="e.g., Weekdays after 5 PM, Saturdays 10 AM - 2 PM"
                        />
                      </FormField>

                      <div className="p-3 bg-amber-50 text-sm text-amber-800">
                        <strong>Note:</strong> In the event of an emergency, Stanton Management may enter without prior notice.
                      </div>
                    </div>
                  )}
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
                {isSubmitting ? 'Submitting...' : 'Submit Preference'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function PermissionToEnterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PermissionToEnterFormContent />
    </Suspense>
  );
}
