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

interface MoveOutNoticeFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  dateOfNotice: string;
  intendedMoveOutDate: string;
  newAddress: string;
  cityStateZip: string;
  bestContact: string;
  submissionMethod: 'appfolio' | 'certified' | 'in_person';
  acknowledgments: {
    noticeRequired: boolean;
    additionalCharges: boolean;
    walkthrough: boolean;
    keysReturned: boolean;
    depositReturn: boolean;
  };
  tenantSignature: string;
}

const initialFormData: MoveOutNoticeFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  dateOfNotice: new Date().toISOString().split('T')[0],
  intendedMoveOutDate: '',
  newAddress: '',
  cityStateZip: '',
  bestContact: '',
  submissionMethod: 'in_person',
  acknowledgments: {
    noticeRequired: false,
    additionalCharges: false,
    walkthrough: false,
    keysReturned: false,
    depositReturn: false,
  },
  tenantSignature: '',
};

function MoveOutNoticeFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(3);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<MoveOutNoticeFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/move-out-notice', {
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
          <title>Move-Out Notice</title>
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
          <div class="form-title">Move-Out Notice</div>
          
          <div class="notice-box">
            <p><strong>Written notice is required before moving out -- no exceptions.</strong></p>
            <p>Month-to-month and fixed-term tenants: 30 days written notice required.</p>
          </div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Date of Notice</div>
            <div class="field-value">${formData.dateOfNotice}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Intended Move-Out Date</div>
            <div class="field-value">${formData.intendedMoveOutDate}</div>
          </div>
          
          <h2>Forwarding Address</h2>
          
          <div class="field">
            <div class="field-label">New Address</div>
            <div class="field-value">${formData.newAddress}</div>
          </div>
          
          <div class="field">
            <div class="field-label">City / State / ZIP</div>
            <div class="field-value">${formData.cityStateZip}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Best Contact After Move-Out</div>
            <div class="field-value">${formData.bestContact}</div>
          </div>
          
          <h2>Submission Method</h2>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.submissionMethod === 'appfolio' ? 'checked' : ''}"></div>
            <div>Submitted via AppFolio</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.submissionMethod === 'certified' ? 'checked' : ''}"></div>
            <div>Certified mail</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.submissionMethod === 'in_person' ? 'checked' : ''}"></div>
            <div>Delivered to office in person</div>
          </div>
          
          <h2>Acknowledgment</h2>
          
          <p>I understand that:</p>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.noticeRequired ? 'checked' : ''}"></div>
            <div>30 days written notice is required</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.additionalCharges ? 'checked' : ''}"></div>
            <div>Failure to give proper notice may result in additional rent charges or security deposit deductions</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.walkthrough ? 'checked' : ''}"></div>
            <div>I must schedule a move-out walkthrough with the office before my final day</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.keysReturned ? 'checked' : ''}"></div>
            <div>All keys, fobs, and access cards must be returned on or before my move-out date</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.acknowledgments.depositReturn ? 'checked' : ''}"></div>
            <div>My security deposit will be returned (or itemized deductions provided) within 30 days of move-out, contingent on providing a forwarding address</div>
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
          
          <p style="margin-top: 16px;"><strong>30-day notice period ends:</strong> __________</p>
          
          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return (
      <LanguageLanding
        title="30-Day Move-Out Notice"
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
        title="Move-Out Notice Submitted"
        message="Your 30-day move-out notice has been submitted. Please schedule a move-out walkthrough with the office."
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

  return (
    <>
      <Header />
      <SectionHeader
        title="Move-Out Notice"
        subtitle="30-day written notice required before moving out"
      />
      
      <FormLayout title="Move-Out Notice">
        <TabNavigation
          tabs={['Notice Information', 'Forwarding Address', 'Acknowledgments']}
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
              <FormSection title="Notice Information">
                <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-sm text-amber-800">
                  <strong>Important:</strong> Written notice is required before moving out — no exceptions. Month-to-month and fixed-term tenants: 30 days written notice required.
                </div>

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

                  <FormField label="Intended Move-Out Date" error={errors.intendedMoveOutDate}>
                    <FormInput
                      type="date"
                      value={formData.intendedMoveOutDate}
                      onChange={(value) => updateField('intendedMoveOutDate', value)}
                      min={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    />
                  </FormField>
                </div>

                <FormField label="Submission Method">
                  <div className="space-y-2">
                    {[
                      { value: 'appfolio', label: 'Submitted via AppFolio' },
                      { value: 'certified', label: 'Certified mail' },
                      { value: 'in_person', label: 'Delivered to office in person' },
                    ].map((method) => (
                      <label key={method.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="submissionMethod"
                          value={method.value}
                          checked={formData.submissionMethod === method.value}
                          onChange={(e) => updateField('submissionMethod', e.target.value as any)}
                          className="text-[#1a2744]"
                        />
                        <span className="text-sm">{method.label}</span>
                      </label>
                    ))}
                  </div>
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
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-800">
                  <strong>Note:</strong> Your security deposit cannot be returned without a forwarding address on file.
                </div>

                <FormField label="New Mailing Address" error={errors.newAddress}>
                  <FormInput
                    value={formData.newAddress}
                    onChange={(value) => updateField('newAddress', value)}
                    placeholder="123 Main Street"
                  />
                </FormField>

                <FormField label="City / State / ZIP" error={errors.cityStateZip}>
                  <FormInput
                    value={formData.cityStateZip}
                    onChange={(value) => updateField('cityStateZip', value)}
                    placeholder="Hartford, CT 06106"
                  />
                </FormField>

                <FormField label="Best Contact After Move-Out" error={errors.bestContact}>
                  <FormInput
                    value={formData.bestContact}
                    onChange={(value) => updateField('bestContact', value)}
                    placeholder="Phone number or email"
                  />
                </FormField>
              </FormSection>
            </motion.div>
          )}

          {currentSection === 2 && (
            <motion.div
              key="section3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FormSection title="Acknowledgment">
                <p className="mb-4 text-sm text-gray-700">I understand that:</p>

                <div className="space-y-3">
                  <FormField>
                    <div className="flex items-start gap-3">
                      <FormCheckbox
                        checked={formData.acknowledgments.noticeRequired}
                        onChange={(checked) => updateAcknowledgment('noticeRequired', checked)}
                        label="30 days written notice is required"
                      />
                    </div>
                  </FormField>

                  <FormField>
                    <div className="flex items-start gap-3">
                      <FormCheckbox
                        checked={formData.acknowledgments.additionalCharges}
                        onChange={(checked) => updateAcknowledgment('additionalCharges', checked)}
                        label="Failure to give proper notice may result in additional rent charges or security deposit deductions"
                      />
                    </div>
                  </FormField>

                  <FormField>
                    <div className="flex items-start gap-3">
                      <FormCheckbox
                        checked={formData.acknowledgments.walkthrough}
                        onChange={(checked) => updateAcknowledgment('walkthrough', checked)}
                        label="I must schedule a move-out walkthrough with the office before my final day"
                      />
                    </div>
                  </FormField>

                  <FormField>
                    <div className="flex items-start gap-3">
                      <FormCheckbox
                        checked={formData.acknowledgments.keysReturned}
                        onChange={(checked) => updateAcknowledgment('keysReturned', checked)}
                        label="All keys, fobs, and access cards must be returned on or before my move-out date"
                      />
                    </div>
                  </FormField>

                  <FormField>
                    <div className="flex items-start gap-3">
                      <FormCheckbox
                        checked={formData.acknowledgments.depositReturn}
                        onChange={(checked) => updateAcknowledgment('depositReturn', checked)}
                        label="My security deposit will be returned (or itemized deductions provided) within 30 days of move-out, contingent on providing a forwarding address"
                      />
                    </div>
                  </FormField>
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

            {currentSection < 2 ? (
              <FormButton onClick={nextSection}>
                Next
              </FormButton>
            ) : (
              <FormButton
                onClick={() => submit(formData)}
                disabled={isSubmitting || !signature || !allAcknowledgmentsChecked}
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

export default function MoveOutNoticePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MoveOutNoticeFormContent />
    </Suspense>
  );
}
