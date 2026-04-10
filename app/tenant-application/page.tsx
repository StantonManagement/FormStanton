'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import { Language } from '@/lib/translations';
import { tenantApplicationTranslations } from '@/lib/tenantApplicationTranslations';
import {
  FormField,
  FormInput,
  FormSelect,
  FormRadioGroup,
  FormCheckbox,
  FormButton,
  FormLayout,
  LanguageLanding,
  SuccessScreen,
  FormTextarea,
  FormPhoneInput,
  FormDocumentUpload,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { validatePhone, validateEmail } from '@/lib/formUtils';
import { useFieldValidation } from '@/lib/formHooks';

const ACCEPTED_DOCS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp'];
const DOC_ERRORS = { maxFiles: 'Maximum 5 files', fileSize: 'File must be under 10MB', fileType: 'PDF, JPG, PNG, HEIC, or WebP only' };

interface IncomeSource {
  employerName: string;
  employerPhone: string;
  position: string;
  duration: string;
  files: File[];
}

interface Occupant {
  name: string;
  dob: string;
  relationship: string;
}

interface Pet {
  type: string;
  weight: string;
}

const blankIncome = (): IncomeSource => ({ employerName: '', employerPhone: '', position: '', duration: '', files: [] });
const blankOccupant = (): Occupant => ({ name: '', dob: '', relationship: '' });
const blankPet = (): Pet => ({ type: 'Dog', weight: '' });

const AREA_KEYS = ['areaNorthEnd', 'areaSouthEnd', 'areaWestEnd', 'areaParkStreet', 'areaNoPreference'] as const;
const AREA_VALUES = ['North End', 'South End', 'West End', 'Park Street Corridor', 'No Preference'];
const INCOME_KEYS = ['incomeUnder1500', 'income1500to2500', 'income2500to3500', 'income3500to5000', 'income5000to7500', 'income7500plus'] as const;
const INCOME_VALUES = ['under_1500', '1500_2500', '2500_3500', '3500_5000', '5000_7500', '7500_plus'];

function TenantApplicationContent() {
  const searchParams = useSearchParams();
  const langParam = searchParams.get('lang');
  const hasLangParam = langParam === 'en' || langParam === 'es' || langParam === 'pt';

  const [language, setLanguage] = useState<Language>(hasLangParam ? langParam : 'en');
  const [showForm, setShowForm] = useState(hasLangParam);
  const t = tenantApplicationTranslations[language];

  // Section A
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [timeAtAddress, setTimeAtAddress] = useState('');

  // Section B
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([blankIncome(), blankIncome()]);
  const [totalIncome, setTotalIncome] = useState('');

  // Section C
  const [numberOfOccupants, setNumberOfOccupants] = useState('');
  const [occupants, setOccupants] = useState<Occupant[]>([]);

  // Section D
  const [hasPets, setHasPets] = useState('');
  const [pets, setPets] = useState<Pet[]>([blankPet()]);

  // Section E
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [reasonForMoving, setReasonForMoving] = useState('');

  // Section F
  const [bedrooms, setBedrooms] = useState('');
  const [areasOfInterest, setAreasOfInterest] = useState<string[]>([]);
  const [moveInDate, setMoveInDate] = useState('');

  // Section G
  const [paymentType, setPaymentType] = useState('');

  // Section H
  const [authMarket, setAuthMarket] = useState(false);

  // Section I
  const [housingAuthority, setHousingAuthority] = useState('');
  const [voucherBedroomSize, setVoucherBedroomSize] = useState('');
  const [voucherPaymentStandard, setVoucherPaymentStandard] = useState('');
  const [voucherExpiration, setVoucherExpiration] = useState('');
  const [caseworkerName, setCaseworkerName] = useState('');
  const [caseworkerPhone, setCaseworkerPhone] = useState('');
  const [caseworkerEmail, setCaseworkerEmail] = useState('');
  const [voucherFiles, setVoucherFiles] = useState<File[]>([]);
  const [movingPacketFiles, setMovingPacketFiles] = useState<File[]>([]);
  const [bankStatementFiles, setBankStatementFiles] = useState<File[]>([]);
  const [authSection8, setAuthSection8] = useState(false);

  // Section J
  const [ssn, setSsn] = useState('');
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [ssnFiles, setSsnFiles] = useState<File[]>([]);

  // Signature
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [signatureDate, setSignatureDate] = useState('');
  const [signatureEmpty, setSignatureEmpty] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const { errors, setFieldError, clearAllErrors } = useFieldValidation<Record<string, string>>();

  const handleAreaToggle = (area: string) => {
    setAreasOfInterest(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const updateIncome = (idx: number, field: keyof IncomeSource, value: string | File[]) => {
    setIncomeSources(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addIncomeSource = () => setIncomeSources(prev => [...prev, blankIncome()]);
  const removeIncomeSource = (idx: number) => setIncomeSources(prev => prev.filter((_, i) => i !== idx));

  const updateOccupant = (idx: number, field: keyof Occupant, value: string) => {
    setOccupants(prev => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  };
  const addOccupant = () => setOccupants(prev => [...prev, blankOccupant()]);
  const removeOccupant = (idx: number) => setOccupants(prev => prev.filter((_, i) => i !== idx));

  const updatePet = (idx: number, field: keyof Pet, value: string) => {
    setPets(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };
  const addPet = () => setPets(prev => [...prev, blankPet()]);
  const removePet = (idx: number) => setPets(prev => prev.filter((_, i) => i !== idx));

  const validateForm = () => {
    clearAllErrors();
    let valid = true;

    if (!fullName.trim()) { setFieldError('fullName', t.required); valid = false; }
    if (!validatePhone(phone)) { setFieldError('phone', t.phoneValidationError); valid = false; }
    if (email.trim() && !validateEmail(email)) { setFieldError('email', t.emailValidationError); valid = false; }
    if (!bedrooms) { setFieldError('bedrooms', t.required); valid = false; }
    if (!paymentType) { setFieldError('paymentType', t.required); valid = false; }
    if (paymentType === 'market' && !authMarket) { setFieldError('authMarket', t.required); valid = false; }
    if (paymentType === 'section8' && !authSection8) { setFieldError('authSection8', t.required); valid = false; }
    if (signatureEmpty) { setFieldError('signature', t.required); valid = false; }
    if (!signatureDate.trim()) { setFieldError('signatureDate', t.required); valid = false; }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const signatureDataUrl = sigCanvasRef.current?.toDataURL() || '';

      const formPayload = {
        fullName, dateOfBirth, phone, email, currentAddress, timeAtAddress,
        incomeSources: incomeSources.map(s => ({ employerName: s.employerName, employerPhone: s.employerPhone, position: s.position, duration: s.duration })),
        totalIncome,
        numberOfOccupants, occupants, hasPets, pets: hasPets === 'yes' ? pets : [],
        landlordName, landlordPhone, reasonForMoving,
        bedrooms, areasOfInterest, moveInDate,
        paymentType,
        authMarket, authSection8,
        housingAuthority, voucherBedroomSize, voucherPaymentStandard, voucherExpiration,
        caseworkerName, caseworkerPhone, caseworkerEmail,
        ssn,
        signatureDataUrl, signatureDate,
        language,
      };

      const fd = new FormData();
      fd.append('formData', JSON.stringify(formPayload));

      incomeSources.forEach((src, idx) => {
        src.files.forEach(f => fd.append(`income_${idx}`, f));
      });
      voucherFiles.forEach(f => fd.append('voucher', f));
      movingPacketFiles.forEach(f => fd.append('movingPacket', f));
      bankStatementFiles.forEach(f => fd.append('bankStatement', f));
      idFiles.forEach(f => fd.append('id', f));
      ssnFiles.forEach(f => fd.append('ssnCard', f));

      const res = await fetch('/api/forms/tenant-application', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Submission failed');
      }
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return <SuccessScreen title={t.successTitle} message={t.successMessage} language={language} onLanguageChange={setLanguage} />;
  }

  if (!showForm) {
    return (
      <LanguageLanding
        title={t.formTitle}
        description={t.formIntro}
        onSelect={(lang) => { setLanguage(lang); setShowForm(true); }}
      />
    );
  }

  const sectionDivider = (label: string) => (
    <div className="border-t border-[var(--divider)] pt-6">
      <h2 className="font-serif text-lg text-[var(--primary)] mb-4">{label}</h2>
    </div>
  );

  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <form onSubmit={handleSubmit}>
          <div className="border-b border-[var(--divider)] bg-[var(--bg-section)] px-6 py-5">
            <h1 className="font-serif text-xl text-[var(--primary)]">{t.formTitle}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">{t.formIntro}</p>
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* ---- SECTION A ---- */}
            {sectionDivider(t.sectionA)}

            <FormField label={t.fullName} required error={errors.fullName}>
              <FormInput value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t.fullNamePlaceholder} error={!!errors.fullName} />
            </FormField>

            <FormField label={t.dateOfBirth} helperText={t.optional}>
              <FormInput value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} placeholder={t.dateOfBirthPlaceholder} />
            </FormField>

            <FormField label={t.phone} required error={errors.phone}>
              <FormPhoneInput value={phone} onChange={v => setPhone(v)} placeholder={t.phonePlaceholder} error={!!errors.phone} />
            </FormField>

            <FormField label={t.email} error={errors.email} helperText={t.optional}>
              <FormInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailPlaceholder} error={!!errors.email} />
            </FormField>

            <FormField label={t.currentAddress} helperText={t.optional}>
              <FormInput value={currentAddress} onChange={e => setCurrentAddress(e.target.value)} placeholder={t.currentAddressPlaceholder} />
            </FormField>

            <FormField label={t.timeAtAddress} helperText={t.optional}>
              <FormInput value={timeAtAddress} onChange={e => setTimeAtAddress(e.target.value)} placeholder={t.timeAtAddressPlaceholder} />
            </FormField>

            {/* ---- SECTION B ---- */}
            {sectionDivider(t.sectionB)}

            {incomeSources.map((src, idx) => (
              <div key={idx} className="border border-[var(--border)] p-4 space-y-4 bg-[var(--bg-section)]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-[var(--ink)]">{t.incomeSourceTitle} {idx + 1}</span>
                  {incomeSources.length > 1 && (
                    <button type="button" onClick={() => removeIncomeSource(idx)} className="text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors">
                      {t.removeIncomeSource}
                    </button>
                  )}
                </div>
                <FormField label={t.employerName} helperText={t.optional}>
                  <FormInput value={src.employerName} onChange={e => updateIncome(idx, 'employerName', e.target.value)} placeholder={t.employerNamePlaceholder} />
                </FormField>
                <FormField label={t.employerPhone} helperText={t.optional}>
                  <FormPhoneInput value={src.employerPhone} onChange={v => updateIncome(idx, 'employerPhone', v)} placeholder={t.employerPhonePlaceholder} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t.position} helperText={t.optional}>
                    <FormInput value={src.position} onChange={e => updateIncome(idx, 'position', e.target.value)} placeholder={t.positionPlaceholder} />
                  </FormField>
                  <FormField label={t.duration} helperText={t.optional}>
                    <FormInput value={src.duration} onChange={e => updateIncome(idx, 'duration', e.target.value)} placeholder={t.durationPlaceholder} />
                  </FormField>
                </div>
                <FormDocumentUpload
                  label={t.incomeUploadLabel}
                  helperText={t.incomeUploadHelper}
                  maxFiles={5} maxSize={10 * 1024 * 1024}
                  acceptedTypes={ACCEPTED_DOCS}
                  documents={src.files}
                  onDocumentsChange={files => updateIncome(idx, 'files', files)}
                  errorMessages={DOC_ERRORS}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addIncomeSource}
              className="text-sm text-[var(--primary)] border border-[var(--primary)] px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors duration-200"
            >
              {t.addIncomeSource}
            </button>

            <FormField label={t.totalIncomeLabel} helperText={t.optional}>
              <div className="space-y-2">
                {INCOME_KEYS.map((key, idx) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="totalIncome" value={INCOME_VALUES[idx]}
                      checked={totalIncome === INCOME_VALUES[idx]}
                      onChange={() => setTotalIncome(INCOME_VALUES[idx])}
                      className="accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--ink)]">{t[key]}</span>
                  </label>
                ))}
              </div>
            </FormField>

            {/* ---- SECTION C ---- */}
            {sectionDivider(t.sectionC)}

            <FormField label={t.numberOfOccupants} required error={errors.numberOfOccupants}>
              <FormInput type="number" min="1" max="20" value={numberOfOccupants}
                onChange={e => setNumberOfOccupants(e.target.value)}
                placeholder={t.numberOfOccupantsPlaceholder}
              />
            </FormField>

            {occupants.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--ink)]">{t.additionalOccupantsTitle}</p>
                {occupants.map((occ, idx) => (
                  <div key={idx} className="border border-[var(--border)] p-4 space-y-3 bg-[var(--bg-section)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">#{idx + 1}</span>
                      <button type="button" onClick={() => removeOccupant(idx)} className="text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors">{t.removeOccupant}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label={t.occupantName}>
                        <FormInput value={occ.name} onChange={e => updateOccupant(idx, 'name', e.target.value)} placeholder={t.occupantNamePlaceholder} />
                      </FormField>
                      <FormField label={t.occupantDob}>
                        <FormInput value={occ.dob} onChange={e => updateOccupant(idx, 'dob', e.target.value)} placeholder={t.occupantDobPlaceholder} />
                      </FormField>
                    </div>
                    <FormField label={t.occupantRelationship}>
                      <FormInput value={occ.relationship} onChange={e => updateOccupant(idx, 'relationship', e.target.value)} placeholder={t.occupantRelationshipPlaceholder} />
                    </FormField>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={addOccupant}
              className="text-sm text-[var(--primary)] border border-[var(--primary)] px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors duration-200">
              {t.addOccupant}
            </button>

            {/* ---- SECTION D ---- */}
            {sectionDivider(t.sectionD)}

            <FormField label={t.hasPets} helperText={t.optional}>
              <FormRadioGroup name="hasPets" value={hasPets} onChange={setHasPets}
                options={[{ value: 'yes', label: t.hasPetsYes }, { value: 'no', label: t.hasPetsNo }]}
                direction="horizontal"
              />
            </FormField>

            {hasPets === 'yes' && (
              <div className="space-y-3">
                {pets.map((pet, idx) => (
                  <div key={idx} className="border border-[var(--border)] p-4 space-y-3 bg-[var(--bg-section)]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Pet #{idx + 1}</span>
                      {pets.length > 1 && (
                        <button type="button" onClick={() => removePet(idx)} className="text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors">{t.removePet}</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label={t.petType}>
                        <FormSelect value={pet.type} onChange={e => updatePet(idx, 'type', e.target.value)}>
                          <option value="Dog">{t.petTypeDog}</option>
                          <option value="Cat">{t.petTypeCat}</option>
                          <option value="Other">{t.petTypeOther}</option>
                        </FormSelect>
                      </FormField>
                      <FormField label={t.petWeight}>
                        <FormInput value={pet.weight} onChange={e => updatePet(idx, 'weight', e.target.value)} placeholder={t.petWeightPlaceholder} />
                      </FormField>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addPet}
                  className="text-sm text-[var(--primary)] border border-[var(--primary)] px-4 py-2 hover:bg-[var(--primary)] hover:text-white transition-colors duration-200">
                  {t.addPet}
                </button>
              </div>
            )}

            {/* ---- SECTION E ---- */}
            {sectionDivider(t.sectionE)}

            <FormField label={t.landlordName} helperText={t.optional}>
              <FormInput value={landlordName} onChange={e => setLandlordName(e.target.value)} placeholder={t.landlordNamePlaceholder} />
            </FormField>
            <FormField label={t.landlordPhone} helperText={t.optional}>
              <FormPhoneInput value={landlordPhone} onChange={setLandlordPhone} placeholder={t.landlordPhonePlaceholder} />
            </FormField>
            <FormField label={t.reasonForMoving} helperText={t.optional}>
              <FormTextarea value={reasonForMoving} onChange={e => setReasonForMoving(e.target.value)} placeholder={t.reasonForMovingPlaceholder} rows={2} />
            </FormField>

            {/* ---- SECTION F ---- */}
            {sectionDivider(t.sectionF)}

            <FormField label={t.bedrooms} required error={errors.bedrooms}>
              <FormSelect value={bedrooms} onChange={e => setBedrooms(e.target.value)} error={!!errors.bedrooms}>
                <option value="">{t.bedroomsPlaceholder}</option>
                <option value="studio">{t.bedroomsStudio}</option>
                <option value="1br">{t.bedrooms1}</option>
                <option value="2br">{t.bedrooms2}</option>
                <option value="3br">{t.bedrooms3}</option>
                <option value="4br">{t.bedrooms4}</option>
              </FormSelect>
            </FormField>

            <div>
              <p className="text-sm font-medium text-[var(--ink)] mb-1">{t.areasTitle}</p>
              <p className="text-xs text-[var(--muted)] mb-3">{t.areasDescription}</p>
              <div className="grid grid-cols-2 gap-3">
                {AREA_KEYS.map((key, idx) => (
                  <FormCheckbox key={key} label={t[key]}
                    checked={areasOfInterest.includes(AREA_VALUES[idx])}
                    onChange={() => handleAreaToggle(AREA_VALUES[idx])}
                  />
                ))}
              </div>
            </div>

            <FormField label={t.moveInDate} helperText={t.optional}>
              <FormInput value={moveInDate} onChange={e => setMoveInDate(e.target.value)} placeholder={t.moveInDatePlaceholder} />
            </FormField>

            {/* ---- SECTION G ---- */}
            {sectionDivider(t.sectionG)}

            <FormField label={t.paymentTypeLabel} required error={errors.paymentType}>
              <FormRadioGroup name="paymentType" value={paymentType} onChange={setPaymentType}
                options={[
                  { value: 'market', label: t.paymentTypeMarket },
                  { value: 'section8', label: t.paymentTypeSection8 },
                ]}
                direction="vertical"
              />
            </FormField>

            {/* ---- SECTION H ---- */}
            {paymentType === 'market' && (
              <div className="border border-[var(--border)] bg-[var(--bg-section)] p-4">
                <p className="text-sm font-medium text-[var(--ink)] mb-3">{t.sectionH}</p>
                <FormCheckbox
                  label={t.authMarket}
                  checked={authMarket}
                  onChange={() => setAuthMarket(v => !v)}
                />
                {errors.authMarket && <p className="text-xs text-[var(--error)] mt-2">{errors.authMarket}</p>}
              </div>
            )}

            {/* ---- SECTION I ---- */}
            {paymentType === 'section8' && (
              <div className="space-y-6 border border-[var(--border)] bg-[var(--bg-section)] p-4">
                <p className="text-sm font-medium text-[var(--ink)]">{t.sectionI}</p>

                <FormField label={t.housingAuthority} helperText={t.optional}>
                  <FormInput value={housingAuthority} onChange={e => setHousingAuthority(e.target.value)} placeholder={t.housingAuthorityPlaceholder} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t.voucherBedroomSize} helperText={t.optional}>
                    <FormInput value={voucherBedroomSize} onChange={e => setVoucherBedroomSize(e.target.value)} placeholder={t.voucherBedroomSizePlaceholder} />
                  </FormField>
                  <FormField label={t.voucherPaymentStandard} helperText={t.optional}>
                    <FormInput value={voucherPaymentStandard} onChange={e => setVoucherPaymentStandard(e.target.value)} placeholder={t.voucherPaymentStandardPlaceholder} />
                  </FormField>
                </div>
                <FormField label={t.voucherExpiration} helperText={t.optional}>
                  <FormInput value={voucherExpiration} onChange={e => setVoucherExpiration(e.target.value)} placeholder={t.voucherExpirationPlaceholder} />
                </FormField>

                <div className="border-t border-[var(--divider)] pt-4 space-y-4">
                  <FormField label={t.caseworkerName} helperText={t.optional}>
                    <FormInput value={caseworkerName} onChange={e => setCaseworkerName(e.target.value)} placeholder={t.caseworkerNamePlaceholder} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={t.caseworkerPhone} helperText={t.optional}>
                      <FormPhoneInput value={caseworkerPhone} onChange={setCaseworkerPhone} placeholder={t.caseworkerPhonePlaceholder} />
                    </FormField>
                    <FormField label={t.caseworkerEmail} helperText={t.optional}>
                      <FormInput type="email" value={caseworkerEmail} onChange={e => setCaseworkerEmail(e.target.value)} placeholder={t.caseworkerEmailPlaceholder} />
                    </FormField>
                  </div>
                </div>

                <div className="border-t border-[var(--divider)] pt-4 space-y-4">
                  <FormDocumentUpload label={t.uploadVoucher} helperText={t.uploadVoucherHelper}
                    maxFiles={3} maxSize={10 * 1024 * 1024} acceptedTypes={ACCEPTED_DOCS}
                    documents={voucherFiles} onDocumentsChange={setVoucherFiles} errorMessages={DOC_ERRORS} />
                  <FormDocumentUpload label={t.uploadMovingPacket} helperText={t.uploadMovingPacketHelper}
                    maxFiles={5} maxSize={10 * 1024 * 1024} acceptedTypes={ACCEPTED_DOCS}
                    documents={movingPacketFiles} onDocumentsChange={setMovingPacketFiles} errorMessages={DOC_ERRORS} />
                  <FormDocumentUpload label={t.uploadBankStatement} helperText={t.uploadBankStatementHelper}
                    maxFiles={5} maxSize={10 * 1024 * 1024} acceptedTypes={ACCEPTED_DOCS}
                    documents={bankStatementFiles} onDocumentsChange={setBankStatementFiles} errorMessages={DOC_ERRORS} />
                </div>

                <FormCheckbox label={t.authSection8} checked={authSection8} onChange={() => setAuthSection8(v => !v)} />
                {errors.authSection8 && <p className="text-xs text-[var(--error)]">{errors.authSection8}</p>}
              </div>
            )}

            {/* ---- SECTION J ---- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-1">{t.sectionJ}</h2>
              <p className="text-xs text-[var(--muted)] mb-4">{t.sectionJIntro}</p>
            </div>

            <FormField label={t.ssn} helperText={t.optional}>
              <FormInput value={ssn} onChange={e => setSsn(e.target.value)} placeholder={t.ssnPlaceholder} />
            </FormField>
            <FormDocumentUpload label={t.uploadId} helperText={t.uploadIdHelper}
              maxFiles={2} maxSize={10 * 1024 * 1024} acceptedTypes={ACCEPTED_DOCS}
              documents={idFiles} onDocumentsChange={setIdFiles} errorMessages={DOC_ERRORS} />
            <FormDocumentUpload label={t.uploadSsnCard} helperText={t.uploadSsnCardHelper}
              maxFiles={2} maxSize={10 * 1024 * 1024} acceptedTypes={ACCEPTED_DOCS}
              documents={ssnFiles} onDocumentsChange={setSsnFiles} errorMessages={DOC_ERRORS} />

            {/* ---- SIGNATURE ---- */}
            <div className="border-t border-[var(--divider)] pt-6">
              <h2 className="font-serif text-lg text-[var(--primary)] mb-3">{t.sectionSignature}</h2>
              <p className="text-sm text-[var(--muted)] mb-4">{t.signatureTitle}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--ink)]">{t.signatureLabel} <span className="text-[var(--error)]">*</span></label>
                <button
                  type="button"
                  onClick={() => { sigCanvasRef.current?.clear(); setSignatureEmpty(true); }}
                  className="text-xs text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--border)] px-2 py-1 transition-colors"
                >
                  {t.signatureClear}
                </button>
              </div>
              <div className={`border ${errors.signature ? 'border-[var(--error)]' : 'border-[var(--border)]'} bg-white`}>
                <SignatureCanvas
                  ref={sigCanvasRef}
                  canvasProps={{ className: 'w-full', height: 140 }}
                  onBegin={() => setSignatureEmpty(false)}
                />
              </div>
              {errors.signature && <p className="text-xs text-[var(--error)] mt-1">{errors.signature}</p>}
              <p className="text-xs text-[var(--muted)] mt-1">{t.signaturePlaceholder}</p>
            </div>

            <FormField label={t.signatureDate} required error={errors.signatureDate}>
              <FormInput value={signatureDate} onChange={e => setSignatureDate(e.target.value)} placeholder="MM/DD/YYYY" error={!!errors.signatureDate} />
            </FormField>

            {submitError && (
              <div className="border border-[var(--error)] bg-red-50 p-3 text-sm text-[var(--error)]">
                {submitError}
              </div>
            )}

            <FormButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? t.submitting : t.submit}
            </FormButton>
          </div>
        </form>
      </FormLayout>
      <Footer />
    </>
  );
}

export default function TenantApplicationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    }>
      <TenantApplicationContent />
    </Suspense>
  );
}
