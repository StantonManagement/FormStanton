'use client';

/**
 * components/pbv/intake/SectionIncome.tsx
 *
 * Section 3 — Income
 * Per-adult wizard: 14 income source toggles + amounts where yes.
 * Computes has_zero_income_adult for conditional gating in useSectionVisibility.
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import AdultWizard from '@/components/pbv/intake/AdultWizard';
import type { PreferredLanguage } from '@/types/compliance';
import type {
  IntakeData,
  IntakeIncome,
  IntakeMemberIncome,
  IntakeIncomeSource,
  SectionSlug,
} from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const INCOME_TYPES = [
  { type: 'employment',      en: 'Wages / Salary',            es: 'Salario',                    pt: 'Salário' },
  { type: 'ssi',             en: 'SSI',                       es: 'SSI',                        pt: 'SSI' },
  { type: 'ss',              en: 'Social Security',           es: 'Seguro Social',              pt: 'Previdência Social' },
  { type: 'pension',         en: 'Pension / Retirement',      es: 'Pensión / Jubilación',       pt: 'Pensão / Aposentadoria' },
  { type: 'tanf',            en: 'TANF',                      es: 'TANF',                       pt: 'TANF' },
  { type: 'child_support',   en: 'Child Support',             es: 'Manutención',                pt: 'Pensão alimentícia' },
  { type: 'unemployment',    en: 'Unemployment',              es: 'Desempleo',                  pt: 'Desemprego' },
  { type: 'workers_comp',    en: 'Workers Compensation',      es: 'Compensación laboral',       pt: 'Compensação dos trabalhadores' },
  { type: 'self_employment', en: 'Self-Employment',           es: 'Autoempleo',                 pt: 'Trabalho autônomo' },
  { type: 'rental',          en: 'Rental Income',             es: 'Ingresos por alquiler',      pt: 'Renda de aluguel' },
  { type: 'gifts',           en: 'Gifts / Contributions',     es: 'Donaciones / Contribuciones',pt: 'Presentes / Contribuições' },
  { type: 'digital_wallet',  en: 'Digital Wallet / Crypto',   es: 'Billetera digital / Cripto', pt: 'Carteira digital / Cripto' },
  { type: 'snap',            en: 'SNAP / Food Stamps',        es: 'SNAP / Cupones de comida',   pt: 'SNAP / Vale-alimentação' },
  { type: 'other',           en: 'Other Income',              es: 'Otros ingresos',             pt: 'Outras rendas' },
] as const;

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    none_label: 'No income of any kind',
    amount_label: 'Monthly amount ($)',
    source_label: 'Source / employer (optional)',
    annual_label: 'Estimated annual income',
    annual_caption: 'Calculated from monthly amounts',
    zero_note: 'This person will need to complete a zero-income declaration.',
  },
  es: {
    none_label: 'Sin ingresos de ningún tipo',
    amount_label: 'Monto mensual ($)',
    source_label: 'Fuente / empleador (opcional)',
    annual_label: 'Ingreso anual estimado',
    annual_caption: 'Calculado desde los montos mensuales',
    zero_note: 'Esta persona deberá completar una declaración de cero ingresos.',
  },
  pt: {
    // PT: tentative — review
    none_label: 'Nenhuma renda de nenhum tipo',
    amount_label: 'Valor mensal ($)',
    source_label: 'Fonte / empregador (opcional)', // PT: tentative — review
    annual_label: 'Renda anual estimada',
    annual_caption: 'Calculado a partir dos valores mensais', // PT: tentative — review
    zero_note: 'Esta pessoa precisará preencher uma declaração de renda zero.',
  },
};

function emptyMemberIncome(slot: number, name: string): IntakeMemberIncome {
  return {
    member_slot: slot,
    member_name: name,
    income_sources: [],
    has_any_income: false,
    annual_income: 0,
  };
}

export default function SectionIncome({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const household = intakeData.household;
  const adults = (household?.members ?? [{ slot: 1, name: household?.hoh_name ?? '', is_minor: false, dob: '', relationship: 'head', disability: false, student: false, citizenship_status: 'citizen' }]).filter(
    (m) => !m.is_minor
  );

  const existingIncome = intakeData.income;

  const [byMember, setByMember] = useState<IntakeMemberIncome[]>(() =>
    adults.map((adult) => {
      const existing = existingIncome?.by_member?.find((b) => b.member_slot === adult.slot);
      return existing ?? emptyMemberIncome(adult.slot, adult.name);
    })
  );

  const [currentAdultIndex, setCurrentAdultIndex] = useState(0);

  const emit = (updated: IntakeMemberIncome[]) => {
    const has_zero_income_adult = updated.some((m) => !m.has_any_income);
    const payload: IntakeIncome = {
      by_member: updated,
      has_zero_income_adult,
    };
    onChange('income', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(byMember); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMemberIncome = (slot: number, patch: Partial<IntakeMemberIncome>) => {
    const updated = byMember.map((m) =>
      m.member_slot === slot ? { ...m, ...patch } : m
    );
    setByMember(updated);
    emit(updated);
  };

  const toggleSource = (slot: number, type: string, hasIncome: boolean) => {
    const member = byMember.find((m) => m.member_slot === slot);
    if (!member) return;

    let sources: IntakeIncomeSource[];
    if (type === 'none') {
      sources = hasIncome ? [] : [{ type: 'none', has_income: false }];
    } else {
      const withoutNone = member.income_sources.filter((s) => s.type !== 'none');
      const existing = withoutNone.find((s) => s.type === type);
      if (existing) {
        sources = withoutNone.filter((s) => s.type !== type);
      } else {
        sources = [...withoutNone, { type, has_income: true }];
      }
    }

    const has_any_income =
      sources.length > 0 && !sources.some((s) => s.type === 'none');

    updateMemberIncome(slot, {
      income_sources: sources,
      has_any_income,
      annual_income: has_any_income ? member.annual_income : 0,
    });
  };

  const setSourceAmount = (slot: number, type: string, amount: number) => {
    const member = byMember.find((m) => m.member_slot === slot);
    if (!member) return;
    const sources = member.income_sources.map((s) =>
      s.type === type ? { ...s, amount_monthly: amount } : s
    );
    updateMemberIncome(slot, { income_sources: sources });
  };

  // WS-D: employer / payer name → the main_application income table "Source" column.
  const setSourceName = (slot: number, type: string, source: string) => {
    const member = byMember.find((m) => m.member_slot === slot);
    if (!member) return;
    const sources = member.income_sources.map((s) =>
      s.type === type ? { ...s, source } : s
    );
    updateMemberIncome(slot, { income_sources: sources });
  };

  // Phase 4: Always derive annual from monthly amounts (no manual override)
  const recomputeAnnual = (slot: number) => {
    setByMember((prev) => {
      const member = prev.find((m) => m.member_slot === slot);
      if (!member) return prev;
      const totalMonthly = member.income_sources
        .filter((s) => s.type !== 'none' && s.has_income)
        .reduce((sum, s) => sum + (s.amount_monthly ?? 0), 0);
      const updated = prev.map((m) =>
        m.member_slot === slot ? { ...m, annual_income: totalMonthly * 12 } : m
      );
      emit(updated);
      return updated;
    });
  };

  const currentMember = byMember[currentAdultIndex];
  if (!currentMember) return null;

  const noneSelected = currentMember.income_sources.some((s) => s.type === 'none');

  return (
    <div className="space-y-4">
      <AdultWizard
        adults={adults.map((a) => ({ name: a.name, slot: a.slot }))}
        currentIndex={currentAdultIndex}
        onPrev={() => setCurrentAdultIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentAdultIndex((i) => Math.min(adults.length - 1, i + 1))}
        language={language}
      >
        <FormSection background>
          {/* None toggle */}
          <label className="flex items-center gap-3 min-h-[44px] py-1 border-b border-[var(--border)]">
            <input
              type="checkbox"
              checked={noneSelected}
              onChange={() => toggleSource(currentMember.member_slot, 'none', noneSelected)}
              className="w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm font-medium">{c.none_label}</span>
          </label>

          {/* Income source toggles */}
          {INCOME_TYPES.map((src) => {
            const activeSource = currentMember.income_sources.find(
              (s) => s.type === src.type
            );
            const isChecked = !!activeSource && activeSource.type !== 'none';

            return (
              <div key={src.type} className="space-y-2">
                <label className="flex items-center gap-3 min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={noneSelected}
                    onChange={() => toggleSource(currentMember.member_slot, src.type, isChecked)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm">{src[language] ?? src.en}</span>
                </label>

                {isChecked && (
                  <div className="pl-7 space-y-2">
                    <FormField label={c.amount_label} htmlFor={`amt_${src.type}`}>
                      <input
                        id={`amt_${src.type}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={activeSource?.amount_monthly ?? ''}
                        onChange={(e) =>
                          setSourceAmount(
                            currentMember.member_slot,
                            src.type,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        onBlur={() => recomputeAnnual(currentMember.member_slot)}
                        className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
                      />
                    </FormField>
                    <FormField label={c.source_label} htmlFor={`src_${src.type}`}>
                      <input
                        id={`src_${src.type}`}
                        type="text"
                        value={activeSource?.source ?? ''}
                        onChange={(e) =>
                          setSourceName(currentMember.member_slot, src.type, e.target.value)
                        }
                        className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            );
          })}

          {/* Phase 4: Annual total — read-only, derived from monthly */}
          {currentMember.has_any_income && (
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="text-sm font-medium">{c.annual_label}</p>
              <p className="text-lg font-semibold text-[var(--primary)]">
                ${currentMember.annual_income.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--muted)]">{c.annual_caption}</p>
            </div>
          )}

          {noneSelected && (
            <p className="text-xs text-[var(--muted)] mt-2">{c.zero_note}</p>
          )}
        </FormSection>
      </AdultWizard>
    </div>
  );
}
