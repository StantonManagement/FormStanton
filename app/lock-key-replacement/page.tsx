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

interface KeyItem {
  item: string;
  quantity: number;
  estimatedCost: string;
  approved: boolean;
}

interface LockKeyReplacementFormData {
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  date: string;
  reason: 'lost_key' | 'lost_fob' | 'damaged_key' | 'lock_change' | 'other';
  details: string;
  items: KeyItem[];
  totalEstimatedCost: string;
  tenantSignature: string;
}

const initialFormData: LockKeyReplacementFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  date: new Date().toISOString().split('T')[0],
  reason: 'lost_key',
  details: '',
  items: [
    { item: 'Unit key', quantity: 0, estimatedCost: '', approved: false },
    { item: 'Mailbox key', quantity: 0, estimatedCost: '', approved: false },
    { item: 'Key fob / access card', quantity: 0, estimatedCost: '', approved: false },
    { item: 'Lock re-key / change', quantity: 0, estimatedCost: '', approved: false },
  ],
  totalEstimatedCost: '',
  tenantSignature: '',
};

function LockKeyReplacementFormContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';
  
  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  
  const { formData, updateField } = useFormData(initialFormData);
  const [signature, setSignature] = useState('');
  
  const { currentSection, nextSection, prevSection, goToSection } = useFormSection(2);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<LockKeyReplacementFormData>();
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const response = await fetch('/api/forms/lock-key-replacement', {
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
          <title>Lock / Key Replacement Authorization</title>
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
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 7px 12px; text-align: left; }
            th { background: #f8f7f5; font-weight: 600; color: #1a2744; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
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
          <div class="form-title">Lock / Key Replacement Authorization</div>
          
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
          
          <h2>Reason for Request</h2>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.reason === 'lost_key' ? 'checked' : ''}"></div>
            <div>Lost key(s)</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.reason === 'lost_fob' ? 'checked' : ''}"></div>
            <div>Lost key fob(s)</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.reason === 'damaged_key' ? 'checked' : ''}"></div>
            <div>Damaged key(s)</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.reason === 'lock_change' ? 'checked' : ''}"></div>
            <div>Lock change requested (security concern -- describe below)</div>
          </div>
          
          <div class="checkbox-row">
            <div class="checkbox ${formData.reason === 'other' ? 'checked' : ''}"></div>
            <div>Other: ${formData.details}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Details</div>
            <div class="field-value">${formData.details}</div>
          </div>
          
          <h2>Items Needing Replacement</h2>
          
          <table>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Estimated Cost</th>
              <th>Approved</th>
            </tr>
            ${formData.items.map(item => `
              <tr>
                <td>${item.item}</td>
                <td>${item.quantity}</td>
                <td>$${item.estimatedCost}</td>
                <td>${item.approved ? 'Yes' : ''}</td>
              </tr>
            `).join('')}
          </table>
          
          <div class="field">
            <div class="field-label">Total estimated cost to tenant</div>
            <div class="field-value">$${formData.totalEstimatedCost}</div>
          </div>
          
          <h2>Authorization</h2>
          
          <p>I authorize Stanton Management to charge the cost of replacement to my account.</p>
          
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
        title="Lock / Key Replacement Authorization"
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
        title="Lock / Key Replacement Authorized"
        message="Your authorization has been submitted. Stanton Management will contact you with the total cost and replacement timeline."
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  const updateItem = (index: number, field: keyof KeyItem, value: string | number | boolean) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    updateField('items', updatedItems);
    
    // Calculate total
    const total = updatedItems.reduce((sum, item) => {
      const cost = parseFloat(item.estimatedCost) || 0;
      const qty = item.quantity || 0;
      return sum + (cost * qty);
    }, 0);
    updateField('totalEstimatedCost', total.toFixed(2));
  };

  return (
    <>
      <Header />
      <SectionHeader
        title="Lock / Key Replacement Authorization"
        subtitle="Request and authorize charges for lost keys or lock changes"
      />
      
      <FormLayout>
        <TabNavigation
          tabs={['Request Information', 'Items & Authorization']}
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
              <FormSection title="Request Information">
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

                <FormField label="Reason for Request">
                  <div className="space-y-2">
                    {[
                      { value: 'lost_key', label: 'Lost key(s)' },
                      { value: 'lost_fob', label: 'Lost key fob(s)' },
                      { value: 'damaged_key', label: 'Damaged key(s)' },
                      { value: 'lock_change', label: 'Lock change requested (security concern -- describe below)' },
                      { value: 'other', label: 'Other' },
                    ].map((reason) => (
                      <label key={reason.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="reason"
                          value={reason.value}
                          checked={formData.reason === reason.value}
                          onChange={(e) => updateField('reason', e.target.value as any)}
                          className="text-[#1a2744]"
                        />
                        <span className="text-sm">{reason.label}</span>
                      </label>
                    ))}
                  </div>
                </FormField>

                <FormField label="Details">
                  <textarea
                    value={formData.details}
                    onChange={(e) => updateField('details', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]"
                    rows={3}
                    placeholder="Please provide details about your request..."
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
              <FormSection title="Items Needing Replacement">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Item</th>
                        <th className="text-center py-2 w-24">Quantity</th>
                        <th className="text-center py-2 w-32">Est. Cost Each</th>
                        <th className="text-center py-2 w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={item.item} className="border-b">
                          <td className="py-3">{item.item}</td>
                          <td className="py-3">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded-none text-center"
                            />
                          </td>
                          <td className="py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.estimatedCost}
                              onChange={(e) => updateItem(index, 'estimatedCost', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded-none text-center"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="py-3 text-center">
                            ${((parseFloat(item.estimatedCost) || 0) * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="py-3 text-right font-semibold">
                          Total estimated cost to tenant:
                        </td>
                        <td className="py-3 text-center font-semibold">
                          ${formData.totalEstimatedCost}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </FormSection>

              <FormSection title="Authorization">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-4">
                    I authorize Stanton Management to charge the cost of replacement to my account.
                  </p>
                  
                  <FormField label="Tenant Signature" error={errors.tenantSignature}>
                    <SignatureCanvasComponent
                      value={signature}
                      onChange={setSignature}
                      label="Draw your signature to authorize"
                    />
                  </FormField>
                </div>
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
                {isSubmitting ? 'Submitting...' : 'Authorize Replacement'}
              </FormButton>
            )}
          </div>
        </div>
      </FormLayout>
      
      <Footer />
    </>
  );
}

export default function LockKeyReplacementPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LockKeyReplacementFormContent />
    </Suspense>
  );
}
