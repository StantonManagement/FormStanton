'use client';

import { useEffect, useRef, useState } from 'react';
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
  SuccessScreen,
  FormTextarea,
  FormPhoneInput,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { validateEmail, validatePhone, formatPhone } from '@/lib/formUtils';
import { useFormSubmit, useFieldValidation, useFormData } from '@/lib/formHooks';

type Recommendation = 'approve' | 'maybe' | 'hell_no' | '';

interface TenantAssessmentFormData {
  date: string;
  time: string;
  property: string;
  unit: string;
  stage: string;
  bedrooms: string;
  bathrooms: string;
  agentName: string;
  yourName: string;
  prospectName: string;
  phoneNumber: string;
  emailAddress: string;
  quickObservationsArrivedResponsibly: boolean;
  quickObservationsAppropriatePeople: boolean;
  quickObservationsGoodQuestions: boolean;
  concerningSignsSketchyArrival: boolean;
  concerningSignsImpairedOrFidgety: boolean;
  housingSituationStableHousing: boolean;
  housingSituationReasonableMove: boolean;
  housingSituationSpeaksNormallyLandlord: boolean;
  housingSituationNotes: string;
  kidsPetsWellBehaved: boolean;
  kidsPetsAppropriateOccupants: boolean;
  kidsPetsNotes: string;
  paymentEmploymentVoucher: boolean;
  paymentEmploymentPrivatePay: boolean;
  paymentEmploymentEmployed: boolean;
  paymentEmploymentNotes: string;
  localConnectionsFamilySupport: boolean;
  localConnectionsEstablishedArea: boolean;
  localConnectionsNotes: string;
  deeperRedFlagsBadmouthsLandlord: boolean;
  deeperRedFlagsVagueHistory: boolean;
  deeperRedFlagsDesperateTimeline: boolean;
  overallAssessmentGoodNeighbor: boolean;
  overallAssessmentTakeCareProperty: boolean;
  generalAdditionalNotes: string;
  maintenanceIssuesNotes: string;
  recommendation: Recommendation;
}

const now = new Date();

const initialFormData: TenantAssessmentFormData = {
  date: now.toISOString().split('T')[0],
  time: now.toTimeString().slice(0, 5),
  property: '',
  unit: '',
  stage: '',
  bedrooms: '',
  bathrooms: '',
  agentName: '',
  yourName: '',
  prospectName: '',
  phoneNumber: '',
  emailAddress: '',
  quickObservationsArrivedResponsibly: false,
  quickObservationsAppropriatePeople: false,
  quickObservationsGoodQuestions: false,
  concerningSignsSketchyArrival: false,
  concerningSignsImpairedOrFidgety: false,
  housingSituationStableHousing: false,
  housingSituationReasonableMove: false,
  housingSituationSpeaksNormallyLandlord: false,
  housingSituationNotes: '',
  kidsPetsWellBehaved: false,
  kidsPetsAppropriateOccupants: false,
  kidsPetsNotes: '',
  paymentEmploymentVoucher: false,
  paymentEmploymentPrivatePay: false,
  paymentEmploymentEmployed: false,
  paymentEmploymentNotes: '',
  localConnectionsFamilySupport: false,
  localConnectionsEstablishedArea: false,
  localConnectionsNotes: '',
  deeperRedFlagsBadmouthsLandlord: false,
  deeperRedFlagsVagueHistory: false,
  deeperRedFlagsDesperateTimeline: false,
  overallAssessmentGoodNeighbor: false,
  overallAssessmentTakeCareProperty: false,
  generalAdditionalNotes: '',
  maintenanceIssuesNotes: '',
  recommendation: '',
};

export default function TenantAssessmentPage() {
  const [language, setLanguage] = useState<Language>('en');
  const [voiceNoteFile, setVoiceNoteFile] = useState<File | null>(null);
  const [voiceNotePreviewUrl, setVoiceNotePreviewUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { formData, updateField } = useFormData(initialFormData);
  const { errors, setFieldError, clearAllErrors } = useFieldValidation<TenantAssessmentFormData>();

  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async (data) => {
    const payload = new FormData();
    payload.append('language', language);
    payload.append('formData', JSON.stringify(data));

    if (voiceNoteFile) {
      payload.append('voiceNote', voiceNoteFile);
    }

    const response = await fetch('/api/forms/tenant-assessment', {
      method: 'POST',
      body: payload,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Submission failed');
    }
  });

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (voiceNotePreviewUrl) {
        URL.revokeObjectURL(voiceNotePreviewUrl);
      }
    };
  }, [voiceNotePreviewUrl]);

  const validateForm = () => {
    clearAllErrors();
    let isValid = true;

    if (!formData.property) {
      setFieldError('property', 'Property is required');
      isValid = false;
    }
    if (!formData.unit.trim()) {
      setFieldError('unit', 'Unit is required');
      isValid = false;
    }
    if (!formData.agentName.trim()) {
      setFieldError('agentName', 'Agent name is required');
      isValid = false;
    }
    if (!formData.yourName.trim()) {
      setFieldError('yourName', 'Your name is required');
      isValid = false;
    }
    if (!formData.prospectName.trim()) {
      setFieldError('prospectName', 'Prospect name is required');
      isValid = false;
    }
    if (!validatePhone(formData.phoneNumber)) {
      setFieldError('phoneNumber', 'Enter a valid 10-digit phone number');
      isValid = false;
    }
    if (formData.emailAddress.trim() && !validateEmail(formData.emailAddress)) {
      setFieldError('emailAddress', 'Enter a valid email address');
      isValid = false;
    }
    if (!formData.recommendation) {
      setFieldError('recommendation', 'Select a final recommendation');
      isValid = false;
    }

    return isValid;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `tenant-assessment-voice-${Date.now()}.webm`, {
          type: 'audio/webm',
        });

        setVoiceNoteFile(file);

        if (voiceNotePreviewUrl) {
          URL.revokeObjectURL(voiceNotePreviewUrl);
        }

        setVoiceNotePreviewUrl(URL.createObjectURL(audioBlob));
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleVoiceFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setVoiceNoteFile(file);

    if (voiceNotePreviewUrl) {
      URL.revokeObjectURL(voiceNotePreviewUrl);
      setVoiceNotePreviewUrl('');
    }

    if (file) {
      setVoiceNotePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await submit(formData);
  };

  if (submitSuccess) {
    return (
      <SuccessScreen
        title="Assessment Submitted"
        message="The tenant assessment has been submitted successfully."
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />

      <FormLayout>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
            <h1 className="font-serif text-xl text-[var(--primary)] mb-2">Tenant Assessment</h1>
            <p className="text-sm text-[var(--ink)]">Hartford Market — Quick Assessment Guide</p>
            <p className="text-sm text-[var(--muted)] mt-3">Complete all sections, keep notes factual, and submit your final recommendation.</p>
          </div>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Basic Information</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Date" required>
                <FormInput type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} required />
              </FormField>
              <FormField label="Time" required>
                <FormInput type="time" value={formData.time} onChange={(e) => updateField('time', e.target.value)} required />
              </FormField>
            </div>

            <FormField label="Property" required error={errors.property}>
              <BuildingAutocomplete
                value={formData.property}
                onChange={(value) => {
                  updateField('property', value);
                  updateField('unit', '');
                }}
                buildings={buildings}
                placeholder="Select Property"
                required
              />
            </FormField>

            <FormField label="Unit" required error={errors.unit}>
              {formData.property && buildingUnits[formData.property] ? (
                <FormSelect value={formData.unit} onChange={(e) => updateField('unit', e.target.value)} error={!!errors.unit} required>
                  <option value="">Select Unit</option>
                  {buildingUnits[formData.property].map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </FormSelect>
              ) : (
                <FormInput
                  type="text"
                  value={formData.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  placeholder="Select Unit"
                  error={!!errors.unit}
                  required
                />
              )}
            </FormField>

            <div className="grid sm:grid-cols-3 gap-4">
              <FormField label="Stage"><FormInput type="text" value={formData.stage} onChange={(e) => updateField('stage', e.target.value)} /></FormField>
              <FormField label="Bedrooms"><FormInput type="text" value={formData.bedrooms} onChange={(e) => updateField('bedrooms', e.target.value)} /></FormField>
              <FormField label="Bathrooms"><FormInput type="text" value={formData.bathrooms} onChange={(e) => updateField('bathrooms', e.target.value)} /></FormField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Agent Name" required error={errors.agentName}>
                <FormInput type="text" value={formData.agentName} onChange={(e) => updateField('agentName', e.target.value)} error={!!errors.agentName} required />
              </FormField>
              <FormField label="Your Name" required error={errors.yourName}>
                <FormInput type="text" value={formData.yourName} onChange={(e) => updateField('yourName', e.target.value)} error={!!errors.yourName} required />
              </FormField>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label="Prospect Name" required error={errors.prospectName}>
                <FormInput type="text" value={formData.prospectName} onChange={(e) => updateField('prospectName', e.target.value)} error={!!errors.prospectName} required />
              </FormField>
              <FormField label="Phone Number" required error={errors.phoneNumber}>
                <FormPhoneInput
                  value={formData.phoneNumber}
                  onChange={(digits) => updateField('phoneNumber', digits)}
                  placeholder="(555) 123-4567"
                  error={!!errors.phoneNumber}
                  errorMessage={errors.phoneNumber}
                  required
                />
              </FormField>
            </div>

            <FormField label="Email Address" error={errors.emailAddress}>
              <FormInput
                type="email"
                value={formData.emailAddress}
                onChange={(e) => updateField('emailAddress', e.target.value)}
                placeholder="email@example.com"
                error={!!errors.emailAddress}
              />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Quick Observations</h2>
            <div className="space-y-3">
              <FormCheckbox label="Arrived responsibly (own car, family dropped off)" checked={formData.quickObservationsArrivedResponsibly} onChange={(e) => updateField('quickObservationsArrivedResponsibly', e.target.checked)} />
              <FormCheckbox label="Came with appropriate people" checked={formData.quickObservationsAppropriatePeople} onChange={(e) => updateField('quickObservationsAppropriatePeople', e.target.checked)} />
              <FormCheckbox label="Asked good questions about the place" checked={formData.quickObservationsGoodQuestions} onChange={(e) => updateField('quickObservationsGoodQuestions', e.target.checked)} />
            </div>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Concerning Signs</h2>
            <div className="space-y-3">
              <FormCheckbox label="Sketchy arrival" checked={formData.concerningSignsSketchyArrival} onChange={(e) => updateField('concerningSignsSketchyArrival', e.target.checked)} />
              <FormCheckbox label="Seemed impaired or fidgety" checked={formData.concerningSignsImpairedOrFidgety} onChange={(e) => updateField('concerningSignsImpairedOrFidgety', e.target.checked)} />
            </div>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Housing Situation</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Leading Questions: "Where living now?" "Lease end?" "Landlord relationship?"</p>
            <div className="space-y-3">
              <FormCheckbox label="Stable current housing, planning ahead" checked={formData.housingSituationStableHousing} onChange={(e) => updateField('housingSituationStableHousing', e.target.checked)} />
              <FormCheckbox label="Reasonable explanation for moving" checked={formData.housingSituationReasonableMove} onChange={(e) => updateField('housingSituationReasonableMove', e.target.checked)} />
              <FormCheckbox label="Speaks normally about current landlord" checked={formData.housingSituationSpeaksNormallyLandlord} onChange={(e) => updateField('housingSituationSpeaksNormallyLandlord', e.target.checked)} />
            </div>
            <FormField label="Notes">
              <FormTextarea value={formData.housingSituationNotes} onChange={(e) => updateField('housingSituationNotes', e.target.value)} rows={4} placeholder="Their responses and impressions..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Kids & Pets</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Leading Questions: "Any children?" "Any pets?"</p>
            <div className="space-y-3">
              <FormCheckbox label="Kids well-behaved (if present)" checked={formData.kidsPetsWellBehaved} onChange={(e) => updateField('kidsPetsWellBehaved', e.target.checked)} />
              <FormCheckbox label="Appropriate # occupants for unit" checked={formData.kidsPetsAppropriateOccupants} onChange={(e) => updateField('kidsPetsAppropriateOccupants', e.target.checked)} />
            </div>
            <FormField label="Notes">
              <FormTextarea value={formData.kidsPetsNotes} onChange={(e) => updateField('kidsPetsNotes', e.target.value)} rows={4} placeholder="Number, ages, behavior, pets type/size..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Payment & Employment</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Leading Questions: "How cover rent?" "Working? Where?" "Voucher?"</p>
            <div className="space-y-3">
              <FormCheckbox label="Section 8 / Housing Voucher" checked={formData.paymentEmploymentVoucher} onChange={(e) => updateField('paymentEmploymentVoucher', e.target.checked)} />
              <FormCheckbox label="Private pay" checked={formData.paymentEmploymentPrivatePay} onChange={(e) => updateField('paymentEmploymentPrivatePay', e.target.checked)} />
              <FormCheckbox label="Currently employed" checked={formData.paymentEmploymentEmployed} onChange={(e) => updateField('paymentEmploymentEmployed', e.target.checked)} />
            </div>
            <FormField label="Notes">
              <FormTextarea value={formData.paymentEmploymentNotes} onChange={(e) => updateField('paymentEmploymentNotes', e.target.value)} rows={4} placeholder="Work type, employer, stability, income..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Local Connections</h2>
            <p className="text-xs text-[var(--muted)] mb-3">Leading Questions: "Family in area?" "How long around?" "Why this area?"</p>
            <div className="space-y-3">
              <FormCheckbox label="Has local family/support" checked={formData.localConnectionsFamilySupport} onChange={(e) => updateField('localConnectionsFamilySupport', e.target.checked)} />
              <FormCheckbox label="Established in area" checked={formData.localConnectionsEstablishedArea} onChange={(e) => updateField('localConnectionsEstablishedArea', e.target.checked)} />
            </div>
            <FormField label="Notes">
              <FormTextarea value={formData.localConnectionsNotes} onChange={(e) => updateField('localConnectionsNotes', e.target.value)} rows={4} placeholder="Family, time in area, reasons for location..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Deeper Red Flags</h2>
            <div className="space-y-3">
              <FormCheckbox label="Badmouths landlord (victim language)" checked={formData.deeperRedFlagsBadmouthsLandlord} onChange={(e) => updateField('deeperRedFlagsBadmouthsLandlord', e.target.checked)} />
              <FormCheckbox label="Vague about housing/employment history" checked={formData.deeperRedFlagsVagueHistory} onChange={(e) => updateField('deeperRedFlagsVagueHistory', e.target.checked)} />
              <FormCheckbox label="Desperate timeline (getting kicked out)" checked={formData.deeperRedFlagsDesperateTimeline} onChange={(e) => updateField('deeperRedFlagsDesperateTimeline', e.target.checked)} />
            </div>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Overall Agent Assessment</h2>
            <div className="space-y-3">
              <FormCheckbox label="Would be good neighbor" checked={formData.overallAssessmentGoodNeighbor} onChange={(e) => updateField('overallAssessmentGoodNeighbor', e.target.checked)} />
              <FormCheckbox label="Would take care of property" checked={formData.overallAssessmentTakeCareProperty} onChange={(e) => updateField('overallAssessmentTakeCareProperty', e.target.checked)} />
            </div>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">General Additional Notes</h2>
            <FormField label="Notes">
              <FormTextarea value={formData.generalAdditionalNotes} onChange={(e) => updateField('generalAdditionalNotes', e.target.value)} rows={5} placeholder="Other crucial observations..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Maintenance Issues for Unit</h2>
            <FormField label="Notes">
              <FormTextarea value={formData.maintenanceIssuesNotes} onChange={(e) => updateField('maintenanceIssuesNotes', e.target.value)} rows={5} placeholder="Leaky faucet, broken tile..." />
            </FormField>
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Voice Note (Optional)</h2>
            <p className="text-sm text-[var(--muted)] mb-3">Record a quick voice note related to this assessment:</p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {!isRecording ? (
                <FormButton type="button" onClick={startRecording}>Start Recording</FormButton>
              ) : (
                <FormButton type="button" variant="danger" onClick={stopRecording}>Stop Recording</FormButton>
              )}
            </div>

            <FormField label="Or upload an audio file">
              <input
                type="file"
                accept="audio/*"
                onChange={handleVoiceFileUpload}
                className="mt-1 block w-full px-4 py-3 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)]"
              />
            </FormField>

            {voiceNotePreviewUrl && (
              <audio controls src={voiceNotePreviewUrl} className="w-full mt-2" />
            )}
          </FormSection>

          <FormSection>
            <h2 className="font-serif text-lg text-[var(--primary)] mb-4">Bottom Line Recommendation</h2>
            <FormField label="What's your final call?" required error={errors.recommendation}>
              <FormSelect
                value={formData.recommendation}
                onChange={(e) => updateField('recommendation', e.target.value as Recommendation)}
                error={!!errors.recommendation}
                required
              >
                <option value="">Select recommendation</option>
                <option value="approve">APPROVE — Looks good!</option>
                <option value="maybe">MAYBE — Proceed with caution.</option>
                <option value="hell_no">HELL NO — Significant concerns.</option>
              </FormSelect>
            </FormField>
          </FormSection>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-4">
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <FormButton type="submit" variant="success" fullWidth loading={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
          </FormButton>
        </form>
      </FormLayout>

      <Footer />
    </>
  );
}
