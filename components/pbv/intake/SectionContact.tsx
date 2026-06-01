'use client';

/**
 * components/pbv/intake/SectionContact.tsx
 *
 * Section 2 — Contact Information
 * Phones (home/work/cell), email, alternate contact
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import FormPhoneInput from '@/components/form/FormPhoneInput';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeContact, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    phone_home: 'Home phone',
    phone_work: 'Work phone',
    phone_cell: 'Cell phone',
    email: 'Email address',
    city: 'City', state: 'State', zip: 'ZIP code',
    prev_title: 'Previous Address (optional)',
    prev_street: 'Street address', prev_apt: 'Apt / Unit',
    alt_title: 'Alternate Contact (optional)',
    alt_name: 'Name',
    alt_phone: 'Phone',
    alt_address: 'Address', alt_email: 'Email', alt_relationship: 'Relationship',
    at_least_one: 'At least one phone number is required.',
    phone_required_note: 'At least one phone number is required (required)',
  },
  es: {
    phone_home: 'Teléfono de casa',
    phone_work: 'Teléfono del trabajo',
    phone_cell: 'Teléfono celular',
    email: 'Correo electrónico',
    city: 'Ciudad', state: 'Estado', zip: 'Código postal',
    prev_title: 'Dirección anterior (opcional)',
    prev_street: 'Dirección', prev_apt: 'Apto / Unidad',
    alt_title: 'Contacto alternativo (opcional)',
    alt_name: 'Nombre',
    alt_phone: 'Teléfono',
    alt_address: 'Dirección', alt_email: 'Correo electrónico', alt_relationship: 'Parentesco',
    at_least_one: 'Se requiere al menos un número de teléfono.',
    phone_required_note: 'Se requiere al menos un número de teléfono (obligatorio)',
  },
  pt: {
    // PT: tentative — review
    phone_home: 'Telefone residencial',
    phone_work: 'Telefone comercial',
    phone_cell: 'Telefone celular',
    email: 'Endereço de e-mail',
    city: 'Cidade', state: 'Estado', zip: 'CEP',
    prev_title: 'Endereço anterior (opcional)',
    prev_street: 'Endereço', prev_apt: 'Apto / Unidade',
    alt_title: 'Contato alternativo (opcional)',
    alt_name: 'Nome',
    alt_phone: 'Telefone',
    alt_address: 'Endereço', alt_email: 'E-mail', alt_relationship: 'Parentesco',
    at_least_one: 'Pelo menos um número de telefone é obrigatório.',
    phone_required_note: 'Pelo menos um número de telefone é obrigatório (obrigatório)', // PT: tentative — review
  },
};

export default function SectionContact({ language, intakeData, onChange }: Props) {
  const existing = intakeData.contact;
  const c = copy[language] ?? copy.en;

  const [phoneHome, setPhoneHome] = useState(existing?.phone_home ?? '');
  const [phoneWork, setPhoneWork] = useState(existing?.phone_work ?? '');
  const [phoneCell, setPhoneCell] = useState(existing?.phone_cell ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [altName, setAltName] = useState(existing?.alt_contact_name ?? '');
  const [altPhone, setAltPhone] = useState(existing?.alt_contact_phone ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [stateVal, setStateVal] = useState(existing?.state ?? '');
  const [zip, setZip] = useState(existing?.zip ?? '');
  const [prevStreet, setPrevStreet] = useState(existing?.prev_street ?? '');
  const [prevApt, setPrevApt] = useState(existing?.prev_apt ?? '');
  const [prevCity, setPrevCity] = useState(existing?.prev_city ?? '');
  const [prevState, setPrevState] = useState(existing?.prev_state ?? '');
  const [prevZip, setPrevZip] = useState(existing?.prev_zip ?? '');
  const [altAddress, setAltAddress] = useState(existing?.alt_contact_address ?? '');
  const [altEmail, setAltEmail] = useState(existing?.alt_contact_email ?? '');
  const [altRelationship, setAltRelationship] = useState(existing?.alt_contact_relationship ?? '');

  const emit = (overrides: Partial<IntakeContact> = {}) => {
    const payload: IntakeContact = {
      phone_home: overrides.phone_home ?? phoneHome,
      phone_work: overrides.phone_work ?? phoneWork,
      phone_cell: overrides.phone_cell ?? phoneCell,
      email: overrides.email ?? email,
      alt_contact_name: overrides.alt_contact_name ?? altName,
      alt_contact_phone: overrides.alt_contact_phone ?? altPhone,
      city: overrides.city ?? city,
      state: overrides.state ?? stateVal,
      zip: overrides.zip ?? zip,
      prev_street: overrides.prev_street ?? prevStreet,
      prev_apt: overrides.prev_apt ?? prevApt,
      prev_city: overrides.prev_city ?? prevCity,
      prev_state: overrides.prev_state ?? prevState,
      prev_zip: overrides.prev_zip ?? prevZip,
      alt_contact_address: overrides.alt_contact_address ?? altAddress,
      alt_contact_email: overrides.alt_contact_email ?? altEmail,
      alt_contact_relationship: overrides.alt_contact_relationship ?? altRelationship,
    };
    onChange('contact', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <FormSection background>
        <p className="text-xs text-[var(--muted)] mb-2" role="note" aria-label={c.phone_required_note}>
          <span aria-hidden="true">*</span> {c.at_least_one}
        </p>

        <FormField label={c.phone_cell} htmlFor="phone_cell" required>
          <FormPhoneInput
            value={phoneCell}
            onChange={(v) => { setPhoneCell(v); emit({ phone_cell: v }); }}
          />
        </FormField>

        <FormField label={c.phone_home} htmlFor="phone_home" required>
          <FormPhoneInput
            value={phoneHome}
            onChange={(v) => { setPhoneHome(v); emit({ phone_home: v }); }}
          />
        </FormField>

        <FormField label={c.phone_work} htmlFor="phone_work" required>
          <FormPhoneInput
            value={phoneWork}
            onChange={(v) => { setPhoneWork(v); emit({ phone_work: v }); }}
          />
        </FormField>

        <FormField label={c.email} htmlFor="contact_email">
          <input
            id="contact_email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); emit({ email: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label={c.city} htmlFor="contact_city">
            <input id="contact_city" type="text" value={city}
              onChange={(e) => { setCity(e.target.value); emit({ city: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
          <FormField label={c.state} htmlFor="contact_state">
            <input id="contact_state" type="text" value={stateVal}
              onChange={(e) => { setStateVal(e.target.value); emit({ state: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
          <FormField label={c.zip} htmlFor="contact_zip">
            <input id="contact_zip" type="text" inputMode="numeric" value={zip}
              onChange={(e) => { setZip(e.target.value); emit({ zip: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
        </div>
      </FormSection>

      <FormSection>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{c.prev_title}</p>
        <FormField label={c.prev_street} htmlFor="prev_street">
          <input id="prev_street" type="text" value={prevStreet}
            onChange={(e) => { setPrevStreet(e.target.value); emit({ prev_street: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={c.prev_apt} htmlFor="prev_apt">
            <input id="prev_apt" type="text" value={prevApt}
              onChange={(e) => { setPrevApt(e.target.value); emit({ prev_apt: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
          <FormField label={c.city} htmlFor="prev_city">
            <input id="prev_city" type="text" value={prevCity}
              onChange={(e) => { setPrevCity(e.target.value); emit({ prev_city: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={c.state} htmlFor="prev_state">
            <input id="prev_state" type="text" value={prevState}
              onChange={(e) => { setPrevState(e.target.value); emit({ prev_state: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
          <FormField label={c.zip} htmlFor="prev_zip">
            <input id="prev_zip" type="text" inputMode="numeric" value={prevZip}
              onChange={(e) => { setPrevZip(e.target.value); emit({ prev_zip: e.target.value }); }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
          </FormField>
        </div>
      </FormSection>

      <FormSection>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{c.alt_title}</p>

        <FormField label={c.alt_name} htmlFor="alt_name">
          <input
            id="alt_name"
            type="text"
            value={altName}
            onChange={(e) => { setAltName(e.target.value); emit({ alt_contact_name: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          />
        </FormField>

        <FormField label={c.alt_phone} htmlFor="alt_phone">
          <FormPhoneInput
            value={altPhone}
            onChange={(v) => { setAltPhone(v); emit({ alt_contact_phone: v }); }}
          />
        </FormField>

        <FormField label={c.alt_address} htmlFor="alt_address">
          <input id="alt_address" type="text" value={altAddress}
            onChange={(e) => { setAltAddress(e.target.value); emit({ alt_contact_address: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>

        <FormField label={c.alt_email} htmlFor="alt_email">
          <input id="alt_email" type="email" inputMode="email" value={altEmail}
            onChange={(e) => { setAltEmail(e.target.value); emit({ alt_contact_email: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>

        <FormField label={c.alt_relationship} htmlFor="alt_relationship">
          <input id="alt_relationship" type="text" value={altRelationship}
            onChange={(e) => { setAltRelationship(e.target.value); emit({ alt_contact_relationship: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>
      </FormSection>
    </div>
  );
}
