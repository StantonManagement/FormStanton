'use client';

/**
 * components/pbv/intake/SectionHousehold.tsx
 *
 * Section 1 — About Your Household
 *
 * Collects:
 *   - HOH details (name, DOB, SSN last-4, race, ethnicity, marital status)
 *   - Household roster: add adults one at a time, then minors
 *   - Per-member: name, DOB, SSN, relationship, disability, student, citizenship
 */

import { useState, useEffect, useRef } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import { tenantFetch } from '@/lib/tenantFetch';
import { formatSsn, normalizeSsn, isValidSsn } from '@/lib/pbv/ssnValidation';
import type { PreferredLanguage } from '@/types/compliance';
import type {
  IntakeData,
  IntakeHousehold,
  IntakeMember,
  SectionSlug,
} from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
  /** Tenant magic-link token — required to persist the full SSN to the encrypted
   *  vault (POST /api/t/[token]/pbv-full-app/intake/ssn). */
  token: string;
}

const RACE_OPTIONS = [
  { value: 'white', en: 'White', es: 'Blanco/a', pt: 'Branco/a' },
  { value: 'black', en: 'Black / African American', es: 'Negro/a / Afroamericano/a', pt: 'Negro/a / Afro-americano/a' },
  { value: 'asian', en: 'Asian', es: 'Asiático/a', pt: 'Asiático/a' },
  { value: 'pacific_islander', en: 'Native Hawaiian / Pacific Islander', es: 'Nativo de Hawaii / Isleño del Pacífico', pt: 'Nativo havaiano / Ilhéu do Pacífico' },
  { value: 'native', en: 'American Indian / Alaska Native', es: 'Indio americano / Nativo de Alaska', pt: 'Índio americano / Nativo do Alasca' },
  { value: 'multi', en: 'Multi-racial', es: 'Multirracial', pt: 'Multirracial' },
  { value: 'other', en: 'Other', es: 'Otro', pt: 'Outro' },
  { value: 'not_reported', en: 'Prefer not to say', es: 'Prefiero no decir', pt: 'Prefiro não dizer' },
];

const ETHNICITY_OPTIONS = [
  { value: 'hispanic', en: 'Hispanic / Latino', es: 'Hispano / Latino', pt: 'Hispânico / Latino' },
  { value: 'not_hispanic', en: 'Not Hispanic / Latino', es: 'No hispano / Latino', pt: 'Não hispânico / Latino' },
  { value: 'not_reported', en: 'Prefer not to say', es: 'Prefiero no decir', pt: 'Prefiro não dizer' },
];

const MARITAL_OPTIONS = [
  { value: 'single', en: 'Single', es: 'Soltero/a', pt: 'Solteiro/a' },
  { value: 'married', en: 'Married', es: 'Casado/a', pt: 'Casado/a' },
  { value: 'separated', en: 'Separated', es: 'Separado/a', pt: 'Separado/a' },
  { value: 'divorced', en: 'Divorced', es: 'Divorciado/a', pt: 'Divorciado/a' },
  { value: 'widowed', en: 'Widowed', es: 'Viudo/a', pt: 'Viúvo/a' },
];

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', en: 'Spouse', es: 'Cónyuge', pt: 'Cônjuge' },
  { value: 'partner', en: 'Domestic Partner', es: 'Pareja doméstica', pt: 'Parceiro doméstico' },
  { value: 'child', en: 'Child', es: 'Hijo/a', pt: 'Filho/a' },
  { value: 'parent', en: 'Parent', es: 'Padre/Madre', pt: 'Pai/Mãe' },
  { value: 'sibling', en: 'Sibling', es: 'Hermano/a', pt: 'Irmão/Irmã' },
  { value: 'grandchild', en: 'Grandchild', es: 'Nieto/a', pt: 'Neto/a' },
  { value: 'other', en: 'Other', es: 'Otro/a', pt: 'Outro/a' },
];

const CITIZENSHIP_OPTIONS = [
  { value: 'citizen', en: 'U.S. Citizen', es: 'Ciudadano/a de EE.UU.', pt: 'Cidadão americano' },
  { value: 'eligible_non_citizen', en: 'Eligible Non-Citizen', es: 'No ciudadano elegible', pt: 'Não-cidadão elegível' },
  { value: 'ineligible', en: 'Ineligible Non-Citizen', es: 'No ciudadano no elegible', pt: 'Não-cidadão inelegível' },
  { value: 'not_reported', en: 'Prefer not to say', es: 'Prefiero no decir', pt: 'Prefiro não dizer' },
];

function emptyMember(slot: number, rel = ''): IntakeMember {
  return { slot, name: '', dob: '', relationship: rel, disability: false, student: false, citizenship_status: 'not_reported', is_minor: false };
}

function computeAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    hoh_title: 'Head of Household',
    hoh_name: 'Full legal name',
    hoh_dob: 'Date of birth',
    ssn: 'Social Security Number',
    ssn_hint: 'Enter all 9 digits. Stored securely and encrypted.',
    ssn_on_file: 'On file ending in',
    ssn_invalid: 'Enter a valid 9-digit Social Security Number.',
    ssn_saved: 'Saved securely',
    race: 'Race',
    ethnicity: 'Ethnicity',
    marital: 'Marital status',
    members_title: 'Other Household Members',
    add_adult: '+ Add adult',
    add_minor: '+ Add child/minor',
    member_name: 'Full name',
    member_dob: 'Date of birth',
    member_ssn: 'Social Security Number',
    member_rel: 'Relationship to HOH',
    member_citizenship: 'Citizenship status',
    member_disability: 'Has a disability',
    member_student: 'Full-time student',
    remove: 'Remove',
    no_others: 'Only the head of household.',
  },
  es: {
    hoh_title: 'Jefe de familia',
    hoh_name: 'Nombre legal completo',
    hoh_dob: 'Fecha de nacimiento',
    ssn: 'Número de Seguro Social',
    ssn_hint: 'Ingrese los 9 dígitos. Se guarda de forma segura y cifrada.',
    ssn_on_file: 'Registrado terminando en',
    ssn_invalid: 'Ingrese un número de Seguro Social válido de 9 dígitos.',
    ssn_saved: 'Guardado de forma segura',
    race: 'Raza',
    ethnicity: 'Etnicidad',
    marital: 'Estado civil',
    members_title: 'Otros miembros del hogar',
    add_adult: '+ Agregar adulto',
    add_minor: '+ Agregar hijo/menor',
    member_name: 'Nombre completo',
    member_dob: 'Fecha de nacimiento',
    member_ssn: 'NSS (últimos 4 dígitos)',
    member_rel: 'Relación con el jefe de familia',
    member_citizenship: 'Estado de ciudadanía',
    member_disability: 'Tiene una discapacidad',
    member_student: 'Estudiante de tiempo completo',
    remove: 'Eliminar',
    no_others: 'Solo el jefe de familia.',
  },
  pt: {
    // PT: tentative — review
    hoh_title: 'Chefe de família',
    hoh_name: 'Nome legal completo',
    hoh_dob: 'Data de nascimento',
    ssn: 'Número de Seguro Social',
    ssn_hint: 'Insira todos os 9 dígitos. Armazenado com segurança e criptografado.',
    ssn_on_file: 'Registrado terminando em',
    ssn_invalid: 'Insira um número de Seguro Social válido de 9 dígitos.',
    ssn_saved: 'Salvo com segurança',
    race: 'Raça',
    ethnicity: 'Etnia',
    marital: 'Estado civil',
    members_title: 'Outros membros da família',
    add_adult: '+ Adicionar adulto',
    add_minor: '+ Adicionar criança/menor',
    member_name: 'Nome completo',
    member_dob: 'Data de nascimento',
    member_ssn: 'Número de Seguro Social',
    member_rel: 'Relação com o chefe de família',
    member_citizenship: 'Status de cidadania',
    member_disability: 'Tem uma deficiência',
    member_student: 'Estudante em tempo integral',
    remove: 'Remover',
    no_others: 'Apenas o chefe de família.',
  },
};

export default function SectionHousehold({ language, intakeData, onChange, token }: Props) {
  const existing = intakeData.household;
  const c = copy[language] ?? copy.en;

  const [hohName, setHohName] = useState(existing?.hoh_name ?? '');
  const [hohDob, setHohDob] = useState(existing?.hoh_dob ?? '');
  const [hohSsn, setHohSsn] = useState(existing?.hoh_ssn_last_four ?? '');
  const [race, setRace] = useState(existing?.race ?? '');
  const [ethnicity, setEthnicity] = useState(existing?.ethnicity ?? '');
  const [marital, setMarital] = useState(existing?.marital_status ?? '');
  const [members, setMembers] = useState<IntakeMember[]>(
    existing?.members?.filter((m) => m.slot > 1) ?? []
  );

  // Full-SSN entry. The plaintext full SSN is held in component state only while
  // typing and is POSTed (encrypted server-side) to the vault — it is never put
  // into the section payload. On (re)load the field starts empty (the snapshot
  // only ever carries last-4); we surface the last-4 on file as a reassurance.
  // Keyed by member slot (HOH = 1, additional members = their assigned slot).
  const [ssnInput, setSsnInput] = useState<Record<number, string>>({});
  const [ssnInvalid, setSsnInvalid] = useState<Record<number, boolean>>({});
  const [ssnSaved, setSsnSaved] = useState<Record<number, boolean>>({});
  const ssnTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Debounced persist of one slot's full SSN to the encrypted vault. Empty input
  // clears the slot. Only a valid 9-digit SSN (or an empty clear) is sent; a
  // partial/invalid 9-digit entry flags inline and is not persisted.
  const persistSsn = (slot: number, digits: string, onLast4: (last4: string | null) => void) => {
    if (ssnTimers.current[slot]) clearTimeout(ssnTimers.current[slot]);
    setSsnSaved((p) => ({ ...p, [slot]: false }));
    const isClear = digits.length === 0;
    const isComplete = digits.length === 9;
    setSsnInvalid((p) => ({ ...p, [slot]: isComplete && !isValidSsn(digits) }));
    if (!isClear && !(isComplete && isValidSsn(digits))) return; // wait for a complete, valid SSN
    ssnTimers.current[slot] = setTimeout(async () => {
      try {
        const res = await tenantFetch(`/api/t/${token}/pbv-full-app/intake/ssn`, {
          method: 'POST',
          body: { slot, ssn: digits },
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const last4 = json?.data?.last4 ?? (digits.length === 9 ? digits.slice(-4) : null);
        onLast4(last4);
        setSsnSaved((p) => ({ ...p, [slot]: !isClear }));
      } catch {
        // Non-fatal — the applicant can re-enter; section autosave still has last-4.
      }
    }, 600);
  };

  const emit = (
    overrides: Partial<{
      hohName: string; hohDob: string; hohSsn: string; race: string;
      ethnicity: string; marital: string; members: IntakeMember[];
    }> = {}
  ) => {
    const hohSlot: IntakeMember = {
      slot: 1, name: overrides.hohName ?? hohName,
      dob: overrides.hohDob ?? hohDob,
      relationship: 'head', ssn_last_four: overrides.hohSsn ?? hohSsn,
      disability: false, student: false, citizenship_status: 'citizen', is_minor: false,
    };
    const allMembers = [hohSlot, ...(overrides.members ?? members)];
    const payload: IntakeHousehold = {
      hoh_name: overrides.hohName ?? hohName,
      hoh_dob: overrides.hohDob ?? hohDob,
      hoh_ssn_last_four: overrides.hohSsn ?? hohSsn,
      race: overrides.race ?? race,
      ethnicity: overrides.ethnicity ?? ethnicity,
      marital_status: overrides.marital ?? marital,
      members: allMembers,
    };
    onChange('household', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMember = (index: number, patch: Partial<IntakeMember>) => {
    const updated = members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    setMembers(updated);
    emit({ members: updated });
  };

  const removeMember = (index: number) => {
    const updated = members.filter((_, i) => i !== index).map((m, i) => ({ ...m, slot: i + 2 }));
    setMembers(updated);
    emit({ members: updated });
  };

  const addAdult = () => {
    const updated = [...members, emptyMember(members.length + 2)];
    setMembers(updated);
    emit({ members: updated });
  };

  const addMinor = () => {
    const updated = [...members, { ...emptyMember(members.length + 2), is_minor: true }];
    setMembers(updated);
    emit({ members: updated });
  };

  return (
    <div className="space-y-6">
      {/* HOH block */}
      <FormSection background>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{c.hoh_title}</p>
        <FormField label={c.hoh_name} required htmlFor="hoh_name">
          <input
            id="hoh_name"
            type="text"
            value={hohName}
            onChange={(e) => { setHohName(e.target.value); emit({ hohName: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            autoComplete="name"
          />
        </FormField>

        <FormField label={c.hoh_dob} required htmlFor="hoh_dob">
          <input
            id="hoh_dob"
            type="date"
            value={hohDob}
            onChange={(e) => { setHohDob(e.target.value); emit({ hohDob: e.target.value }); }}
            // PRP-017 / H4: Firefox sometimes does not fire `onChange` when
            // a date picker is cleared. The onBlur handler re-syncs the
            // bound state from the DOM value so computeAge sees an empty
            // string rather than the previously-typed date.
            onBlur={(e) => { if (e.target.value !== hohDob) { setHohDob(e.target.value); emit({ hohDob: e.target.value }); } }}
            aria-describedby="hoh_dob_hint"
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          />
          <span id="hoh_dob_hint" className="mt-1 block text-xs text-[var(--muted)]">YYYY-MM-DD</span>
        </FormField>

        <FormField label={c.ssn} htmlFor="hoh_ssn">
          <input
            id="hoh_ssn"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            value={formatSsn(ssnInput[1] ?? '')}
            onChange={(e) => {
              const digits = normalizeSsn(e.target.value).slice(0, 9);
              setSsnInput((p) => ({ ...p, 1: digits }));
              persistSsn(1, digits, (last4) => { setHohSsn(last4 ?? ''); emit({ hohSsn: last4 ?? '' }); });
            }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            placeholder="XXX-XX-XXXX"
            aria-describedby="hoh_ssn_hint"
          />
          <span id="hoh_ssn_hint" className="mt-1 block text-xs text-[var(--muted)]">
            {ssnInvalid[1]
              ? <span className="text-[var(--error)]">{c.ssn_invalid}</span>
              : ssnSaved[1]
                ? c.ssn_saved
                : hohSsn && !(ssnInput[1] ?? '')
                  ? `${c.ssn_on_file} ${hohSsn}`
                  : c.ssn_hint}
          </span>
        </FormField>

        <FormField label={c.race} htmlFor="hoh_race">
          <select
            id="hoh_race"
            value={race}
            onChange={(e) => { setRace(e.target.value); emit({ race: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          >
            <option value="">—</option>
            {RACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o[language] ?? o.en}</option>)}
          </select>
        </FormField>

        <FormField label={c.ethnicity} htmlFor="hoh_ethnicity">
          <select
            id="hoh_ethnicity"
            value={ethnicity}
            onChange={(e) => { setEthnicity(e.target.value); emit({ ethnicity: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          >
            <option value="">—</option>
            {ETHNICITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o[language] ?? o.en}</option>)}
          </select>
        </FormField>

        <FormField label={c.marital} htmlFor="hoh_marital">
          <select
            id="hoh_marital"
            value={marital}
            onChange={(e) => { setMarital(e.target.value); emit({ marital: e.target.value }); }}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
          >
            <option value="">—</option>
            {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o[language] ?? o.en}</option>)}
          </select>
        </FormField>
      </FormSection>

      {/* Additional members */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-[var(--body)]">{c.members_title}</p>

        {members.length === 0 && (
          <p className="text-xs text-[var(--muted)]">{c.no_others}</p>
        )}

        {members.map((m, i) => (
          <FormSection key={i} background>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {m.is_minor ? `Minor ${i + 1}` : `Adult ${i + 1}`}
              </p>
              <button
                type="button"
                onClick={() => removeMember(i)}
                className="text-xs text-[var(--error)] min-h-[44px] px-2"
              >
                {c.remove}
              </button>
            </div>

            <FormField label={c.member_name} required htmlFor={`m${i}_name`}>
              <input
                id={`m${i}_name`}
                type="text"
                value={m.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
              />
            </FormField>

            <FormField label={c.member_dob} required htmlFor={`m${i}_dob`}>
              <input
                id={`m${i}_dob`}
                type="date"
                value={m.dob}
                onChange={(e) => {
                  const age = computeAge(e.target.value);
                  updateMember(i, { dob: e.target.value, is_minor: age !== null && age < 18 });
                }}
                // PRP-017 / H4: Firefox-safe clear handling.
                onBlur={(e) => {
                  if (e.target.value !== m.dob) {
                    const age = computeAge(e.target.value);
                    updateMember(i, { dob: e.target.value, is_minor: age !== null && age < 18 });
                  }
                }}
                aria-describedby={`m${i}_dob_hint`}
                className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
              />
              <span id={`m${i}_dob_hint`} className="mt-1 block text-xs text-[var(--muted)]">YYYY-MM-DD</span>
            </FormField>

            <FormField label={c.member_ssn} htmlFor={`m${i}_ssn`}>
              <input
                id={`m${i}_ssn`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                value={formatSsn(ssnInput[m.slot] ?? '')}
                onChange={(e) => {
                  const digits = normalizeSsn(e.target.value).slice(0, 9);
                  setSsnInput((p) => ({ ...p, [m.slot]: digits }));
                  persistSsn(m.slot, digits, (last4) => updateMember(i, { ssn_last_four: last4 ?? '' }));
                }}
                className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
                placeholder="XXX-XX-XXXX"
                aria-describedby={`m${i}_ssn_hint`}
              />
              <span id={`m${i}_ssn_hint`} className="mt-1 block text-xs text-[var(--muted)]">
                {ssnInvalid[m.slot]
                  ? <span className="text-[var(--error)]">{c.ssn_invalid}</span>
                  : ssnSaved[m.slot]
                    ? c.ssn_saved
                    : m.ssn_last_four && !(ssnInput[m.slot] ?? '')
                      ? `${c.ssn_on_file} ${m.ssn_last_four}`
                      : c.ssn_hint}
              </span>
            </FormField>

            <FormField label={c.member_rel} required htmlFor={`m${i}_rel`}>
              <select
                id={`m${i}_rel`}
                value={m.relationship}
                onChange={(e) => updateMember(i, { relationship: e.target.value })}
                className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
              >
                <option value="">—</option>
                {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o[language] ?? o.en}</option>)}
              </select>
            </FormField>

            <FormField label={c.member_citizenship} htmlFor={`m${i}_cit`}>
              <select
                id={`m${i}_cit`}
                value={m.citizenship_status}
                onChange={(e) => updateMember(i, { citizenship_status: e.target.value })}
                className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
              >
                {CITIZENSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o[language] ?? o.en}</option>)}
              </select>
            </FormField>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm min-h-[44px]">
                <input
                  type="checkbox"
                  checked={m.disability}
                  onChange={(e) => updateMember(i, { disability: e.target.checked })}
                  className="w-4 h-4"
                />
                {c.member_disability}
              </label>
              <label className="flex items-center gap-2 text-sm min-h-[44px]">
                <input
                  type="checkbox"
                  checked={m.student}
                  onChange={(e) => updateMember(i, { student: e.target.checked })}
                  className="w-4 h-4"
                />
                {c.member_student}
              </label>
            </div>
          </FormSection>
        ))}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={addAdult}
            className="min-h-[44px] px-4 border border-[var(--primary)] text-[var(--primary)] text-sm hover:bg-[var(--paper)] transition-colors"
          >
            {c.add_adult}
          </button>
          <button
            type="button"
            onClick={addMinor}
            className="min-h-[44px] px-4 border border-[var(--border)] text-[var(--body)] text-sm hover:bg-[var(--paper)] transition-colors"
          >
            {c.add_minor}
          </button>
        </div>
      </div>
    </div>
  );
}
