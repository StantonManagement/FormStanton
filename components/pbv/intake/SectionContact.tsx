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
    alt_title: 'Alternate Contact (optional)',
    alt_name: 'Name',
    alt_phone: 'Phone',
    at_least_one: 'At least one phone number is required.',
    phone_required_note: 'At least one phone number is required (required)',
  },
  es: {
    phone_home: 'Teléfono de casa',
    phone_work: 'Teléfono del trabajo',
    phone_cell: 'Teléfono celular',
    email: 'Correo electrónico',
    alt_title: 'Contacto alternativo (opcional)',
    alt_name: 'Nombre',
    alt_phone: 'Teléfono',
    at_least_one: 'Se requiere al menos un número de teléfono.',
    phone_required_note: 'Se requiere al menos un número de teléfono (obligatorio)',
  },
  pt: {
    // PT: tentative — review
    phone_home: 'Telefone residencial',
    phone_work: 'Telefone comercial',
    phone_cell: 'Telefone celular',
    email: 'Endereço de e-mail',
    alt_title: 'Contato alternativo (opcional)',
    alt_name: 'Nome',
    alt_phone: 'Telefone',
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

  const emit = (overrides: Partial<IntakeContact> = {}) => {
    const payload: IntakeContact = {
      phone_home: overrides.phone_home ?? phoneHome,
      phone_work: overrides.phone_work ?? phoneWork,
      phone_cell: overrides.phone_cell ?? phoneCell,
      email: overrides.email ?? email,
      alt_contact_name: overrides.alt_contact_name ?? altName,
      alt_contact_phone: overrides.alt_contact_phone ?? altPhone,
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
      </FormSection>
    </div>
  );
}
