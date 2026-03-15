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
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { useFormSection, useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';
import { openPrintWindow } from '@/lib/formPrintRenderer';

interface Section8RecertificationFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  housingAuthority: string;
  caseWorker: string;
  authorityPhone: string;
  recertificationDueDate: string;
  incomeVerification: {
    payStubs: boolean;
    employerLetter: boolean;
    socialSecurityAward: boolean;
    selfEmploymentDocs: boolean;
    otherIncome: boolean;
  };
  householdComposition: {
    memberList: boolean;
    birthCertificates: boolean;
    departureDocumentation: boolean;
  };
  assetDocumentation: {
    bankStatements: boolean;
    otherAssets: boolean;
  };
  other: {
    signedForms: boolean;
    additionalForms: boolean;
  };
  changesToReport: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
  inspectionNotes: string;
  tenantSignature: string;
}

const initialFormData: Section8RecertificationFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  housingAuthority: '',
  caseWorker: '',
  authorityPhone: '',
  recertificationDueDate: '',
  incomeVerification: {
    payStubs: false,
    employerLetter: false,
    socialSecurityAward: false,
    selfEmploymentDocs: false,
    otherIncome: false,
  },
  householdComposition: {
    memberList: false,
    birthCertificates: false,
    departureDocumentation: false,
  },
  assetDocumentation: {
    bankStatements: false,
    otherAssets: false,
  },
  other: {
    signedForms: false,
    additionalForms: false,
  },
  changesToReport: '',
  lastInspectionDate: '',
  nextInspectionDate: '',
  inspectionNotes: '',
  tenantSignature: '',
};

function Section8RecertificationFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, previousSection, goToSection } = useFormSection(3);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<Section8RecertificationFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/section8-recertification', {
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
          <title>Section 8 Recertification Checklist</title>
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
            @media print { body { padding: 24px 40px; background: white; } }
          </style>
        </head>
        <body>
          <div class="company-header">
            <h1>STANTON MANAGEMENT</h1>
            <p>421 Park Street, Hartford CT 06106 | (860) 993-3401</p>
          </div>
          <div class="form-title">Section 8 Recertification Checklist</div>
          
          <div class="field">
            <div class="field-label">Tenant Name(s)</div>
            <div class="field-value">${formData.tenantName}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Unit Address</div>
            <div class="field-value">${formData.buildingAddress} - Unit ${formData.unitNumber}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Housing Authority</div>
            <div class="field-value">${formData.housingAuthority}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Case Worker</div>
            <div class="field-value">${formData.caseWorker}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Authority Phone</div>
            <div class="field-value">${formData.authorityPhone}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Annual Recertification Due Date</div>
            <div class="field-value">${formData.recertificationDueDate}</div>
          </div>
          
          <h2>Tenant Checklist</h2>
          
          <p>Complete and submit these items to your housing authority by your recertification deadline. Keep copies of everything.</p>
          
          <h3>Income Verification</h3>
          <div class="checkbox-row"><div class="checkbox ${formData.incomeVerification.payStubs ? 'checked' : ''}"></div><div>Current pay stubs (last 4-8 weeks, per housing authority requirement)</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.incomeVerification.employerLetter ? 'checked' : ''}"></div><div>Employer verification letter (if requested)</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.incomeVerification.socialSecurityAward ? 'checked' : ''}"></div><div>Social Security / disability award letters (if applicable)</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.incomeVerification.selfEmploymentDocs ? 'checked' : ''}"></div><div>Self-employment income documentation (if applicable)</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.incomeVerification.otherIncome ? 'checked' : ''}"></div><div>Any other income sources disclosed</div></div>
          
          <h3>Household Composition</h3>
          <div class="checkbox-row"><div class="checkbox ${formData.householdComposition.memberList ? 'checked' : ''}"></div><div>Updated list of all household members</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.householdComposition.birthCertificates ? 'checked' : ''}"></div><div>Birth certificates or IDs for any new household members</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.householdComposition.departureDocumentation ? 'checked' : ''}"></div><div>Documentation for any household members who have left</div></div>
          
          <h3>Asset Documentation</h3>
          <div class="checkbox-row"><div class="checkbox ${formData.assetDocumentation.bankStatements ? 'checked' : ''}"></div><div>Bank statements (per housing authority requirement)</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.assetDocumentation.otherAssets ? 'checked' : ''}"></div><div>Other asset documentation as requested</div></div>
          
          <h3>Other</h3>
          <div class="checkbox-row"><div class="checkbox ${formData.other.signedForms ? 'checked' : ''}"></div><div>Signed recertification forms from housing authority</div></div>
          <div class="checkbox-row"><div class="checkbox ${formData.other.additionalForms ? 'checked' : ''}"></div><div>Any additional forms requested by your case worker</div></div>
          
          <h2>Changes to Report</h2>
          <div class="field-value" style="min-height: 60px;">${formData.changesToReport}</div>
          
          <h2>Annual Inspection</h2>
          <div class="field">
            <div class="field-label">Last inspection date</div>
            <div class="field-value">${formData.lastInspectionDate}</div>
          </div>
          <div class="field">
            <div class="field-label">Next scheduled inspection</div>
            <div class="field-value">${formData.nextInspectionDate}</div>
          </div>
          <div class="field">
            <div class="field-label">Notes / Items to address before inspection</div>
            <div class="field-value" style="min-height: 60px;">${formData.inspectionNotes}</div>
          </div>
          
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
          
          <p style="margin-top: 16px;"><strong>Copy provided to tenant:</strong> [ ] Yes Date: __________</p>
          
          <div class="footer">Generated by Stanton Management | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
    openPrintWindow(html);
  };

  if (!showForm) {
    return <LanguageLanding onLanguageSelect={() => setShowForm(true)} />;
  }

  if (submitSuccess) {
    return (
      <SuccessScreen
        message="Your Section 8 recertification checklist has been submitted to Stanton Management."
      />
    );
  }

  const updateIncomeVerification = (key: keyof typeof initialFormData.incomeVerification, value: boolean) => {
    updateField('incomeVerification', {
      ...formData.incomeVerification,
      [key]: value,
    });
  };

  const updateHouseholdComposition = (key: keyof typeof initialFormData.householdComposition, value: boolean) => {
    updateField('householdComposition', {
      ...formData.householdComposition,
      [key]: value,
    });
  };

  const updateAssetDocumentation = (key: keyof typeof initialFormData.assetDocumentation, value: boolean) => {
    updateField('assetDocumentation', {
      ...formData.assetDocumentation,
      [key]: value,
    });
  };

  const updateOther = (key: keyof typeof initialFormData.other, value: boolean) => {
    updateField('other', {
      ...formData.other,
      [key]: value,
    });
  };

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <SectionHeader
        title="Section 8 Recertification Checklist"
        description="Annual recertification requirements for Section 8 tenants"
      />
      
      <FormLayout>
        <AnimatePresence mode="wait">
          {currentSection === 0 && (
            <motion.div
              key="section1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FormSection>
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-800">
                  <strong>Important:</strong> Keep copies of all documents you submit to your housing authority. Contact your case worker if you have questions about your recertification requirements.
                </div>

                <FormField label="Tenant Name(s)" error={errors.tenantName}>
                  <FormInput
                    value={formData.tenantName}
                    onChange={(value) => updateField('tenantName', value)}
                    placeholder="Enter all tenant names"
                  />
                </FormField>

                <FormField label="Building Address" error={errors.buildingAddress}>
                  <BuildingAutocomplete
                    buildings={buildings}
                    value={formData.buildingAddress}
                    onChange={(value) => {
                      updateField('buildingAddress', value);
                      updateField('unitNumber', '');
                    }}
                  />
                </FormField>

                <FormField label="Unit Number" error={errors.unitNumber}>
                  <select
                    value={formData.unitNumber}
                    onChange={(e) => updateField('unitNumber', e.target.value)}
                    disabled={!formData.buildingAddress}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                  >
                    <option value="">Select unit</option>
                    {formData.buildingAddress && buildingUnits[formData.buildingAddress]?.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Housing Authority" error={errors.housingAuthority}>
                    <FormInput
                      value={formData.housingAuthority}
                      onChange={(value) => updateField('housingAuthority', value)}
                      placeholder="e.g., Hartford Housing Authority"
                    />
                  </FormField>

                  <FormField label="Case Worker Name" error={errors.caseWorker}>
                    <FormInput
                      value={formData.caseWorker}
                      onChange={(value) => updateField('caseWorker', value)}
                      placeholder="Your assigned case worker"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Housing Authority Phone" error={errors.authorityPhone}>
                    <FormInput
                      type="tel"
                      value={formData.authorityPhone}
                      onChange={(value) => updateField('authorityPhone', value)}
                      placeholder="(555) 123-4567"
                    />
                  </FormField>

                  <FormField label="Annual Recertification Due Date" error={errors.recertificationDueDate}>
                    <FormInput
                      type="date"
                      value={formData.recertificationDueDate}
                      onChange={(value) => updateField('recertificationDueDate', value)}
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
              <FormSection>
                <p className="mb-4 text-sm text-gray-700">
                  Complete and submit these items to your housing authority by your recertification deadline. Keep copies of everything.
                </p>

                <h3 className="font-semibold text-gray-900 mb-3">Income Verification</h3>
                <div className="space-y-2 mb-4">
                  <FormCheckbox
                    checked={formData.incomeVerification.payStubs}
                    onChange={(checked) => updateIncomeVerification('payStubs', checked)}
                    label="Current pay stubs (last 4-8 weeks, per housing authority requirement)"
                  />
                  <FormCheckbox
                    checked={formData.incomeVerification.employerLetter}
                    onChange={(checked) => updateIncomeVerification('employerLetter', checked)}
                    label="Employer verification letter (if requested)"
                  />
                  <FormCheckbox
                    checked={formData.incomeVerification.socialSecurityAward}
                    onChange={(checked) => updateIncomeVerification('socialSecurityAward', checked)}
                    label="Social Security / disability award letters (if applicable)"
                  />
                  <FormCheckbox
                    checked={formData.incomeVerification.selfEmploymentDocs}
                    onChange={(checked) => updateIncomeVerification('selfEmploymentDocs', checked)}
                    label="Self-employment income documentation (if applicable)"
                  />
                  <FormCheckbox
                    checked={formData.incomeVerification.otherIncome}
                    onChange={(checked) => updateIncomeVerification('otherIncome', checked)}
                    label="Any other income sources disclosed"
                  />
                </div>

                <h3 className="font-semibold text-gray-900 mb-3">Household Composition</h3>
                <div className="space-y-2 mb-4">
                  <FormCheckbox
                    checked={formData.householdComposition.memberList}
                    onChange={(checked) => updateHouseholdComposition('memberList', checked)}
                    label="Updated list of all household members"
                  />
                  <FormCheckbox
                    checked={formData.householdComposition.birthCertificates}
                    onChange={(checked) => updateHouseholdComposition('birthCertificates', checked)}
                    label="Birth certificates or IDs for any new household members"
                  />
                  <FormCheckbox
                    checked={formData.householdComposition.departureDocumentation}
                    onChange={(checked) => updateHouseholdComposition('departureDocumentation', checked)}
                    label="Documentation for any household members who have left"
                  />
                </div>

                <h3 className="font-semibold text-gray-900 mb-3">Asset Documentation</h3>
                <div className="space-y-2 mb-4">
                  <FormCheckbox
                    checked={formData.assetDocumentation.bankStatements}
                    onChange={(checked) => updateAssetDocumentation('bankStatements', checked)}
                    label="Bank statements (per housing authority requirement)"
                  />
                  <FormCheckbox
                    checked={formData.assetDocumentation.otherAssets}
                    onChange={(checked) => updateAssetDocumentation('otherAssets', checked)}
                    label="Other asset documentation as requested"
                  />
                </div>

                <h3 className="font-semibold text-gray-900 mb-3">Other</h3>
                <div className="space-y-2">
                  <FormCheckbox
                    checked={formData.other.signedForms}
                    onChange={(checked) => updateOther('signedForms', checked)}
                    label="Signed recertification forms from housing authority"
                  />
                  <FormCheckbox
                    checked={formData.other.additionalForms}
                    onChange={(checked) => updateOther('additionalForms', checked)}
                    label="Any additional forms requested by your case worker"
                  />
                </div>
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
              <FormSection>
                <FormField label="Changes to Report">
                  <textarea
                    value={formData.changesToReport}
                    onChange={(e) => updateField('changesToReport', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                    rows={4}
                    placeholder="Report changes in income, household members, assets, etc..."
                  />
                </FormField>

                <h3 className="font-semibold text-gray-900 mb-3 mt-6">Annual Inspection</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your unit will be inspected annually by the housing authority. Stanton Management will coordinate access.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Last Inspection Date">
                    <FormInput
                      type="date"
                      value={formData.lastInspectionDate}
                      onChange={(value) => updateField('lastInspectionDate', value)}
                    />
                  </FormField>

                  <FormField label="Next Scheduled Inspection">
                    <FormInput
                      type="date"
                      value={formData.nextInspectionDate}
                      onChange={(value) => updateField('nextInspectionDate', value)}
                    />
                  </FormField>
                </div>

                <FormField label="Notes / Items to address before inspection">
                  <textarea
                    value={formData.inspectionNotes}
                    onChange={(e) => updateField('inspectionNotes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                    rows={3}
                    placeholder="Any issues to address before the next inspection..."
                  />
                </FormField>
              </FormSection>

              <FormSection>
                <FormField label="Tenant Signature" error={errors.tenantSignature}>
                  <SignatureCanvasComponent
                    onSave={setSignature}
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
            onClick={previousSection}
            disabled={currentSection === 0}
          >
            Previous
          </FormButton>

          <div className="flex gap-3">
            <FormButton
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
                disabled={isSubmitting || !signature}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Checklist'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function Section8RecertificationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Section8RecertificationFormContent />
    </Suspense>
  );
}
