'use client';

/**
 * components/pbv/intake/SectionHouseholdExpenses.tsx
 * Section 10 — Household Expenses
 * Conditional: only shown if ALL adults have zero income.
 * WS-D #4: itemized expense lines (amount + who pays) for the page-4
 * main_application expense table, plus the survival explanation.
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeHouseholdExpenses, IntakeExpenseLineItem, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

// Fixed form categories (page-4 expense table). key ↔ map exp_<key>_amount/_who.
const CATEGORIES: Array<{ key: string; en: string; es: string; pt: string }> = [
  { key: 'rent', en: 'Rent', es: 'Alquiler', pt: 'Aluguel' },
  { key: 'light', en: 'Light (electric)', es: 'Luz (electricidad)', pt: 'Luz (eletricidade)' },
  { key: 'gas_oil', en: 'Gas and/or Oil', es: 'Gas y/o Aceite', pt: 'Gás e/ou Óleo' },
  { key: 'water', en: 'Water', es: 'Agua', pt: 'Água' },
  { key: 'vehicle_payment', en: 'Vehicle Payment', es: 'Pago de Vehículo', pt: 'Pagamento do Veículo' },
  { key: 'vehicle_insurance', en: 'Vehicle Insurance / Taxes', es: 'Seguro / Impuestos de Vehículo', pt: 'Seguro / Impostos do Veículo' },
  { key: 'cable_internet', en: 'Cable and/or Internet', es: 'Cable y/o Internet', pt: 'Cabo e/ou Internet' },
  { key: 'phone_home', en: 'Phone (Home)', es: 'Teléfono (Casa)', pt: 'Telefone (Residencial)' },
  { key: 'phone_cell', en: 'Phone (Cell)', es: 'Teléfono (Celular)', pt: 'Telefone (Celular)' },
  { key: 'child_care', en: 'Child Care', es: 'Cuidado Infantil', pt: 'Cuidado Infantil' },
  { key: 'furniture_rental', en: 'Furniture Rental', es: 'Alquiler de Muebles', pt: 'Aluguel de Móveis' },
  { key: 'groceries_cash', en: 'Groceries (cash)', es: 'Comestibles (efectivo)', pt: 'Mercado (dinheiro)' },
  { key: 'takeout', en: 'Take-Out Food', es: 'Comida para Llevar', pt: 'Comida para Viagem' },
  { key: 'paper_products', en: 'Paper Products, Trash Bags', es: 'Productos de Papel, Bolsas de Basura', pt: 'Produtos de Papel, Sacos de Lixo' },
  { key: 'grooming', en: 'Grooming Products', es: 'Productos de Aseo Personal', pt: 'Produtos de Higiene' },
  { key: 'cleaning_laundry', en: 'Cleaning / Laundry Products', es: 'Productos de Limpieza / Lavandería', pt: 'Produtos de Limpeza / Lavanderia' },
  { key: 'gas_vehicle', en: 'Gas for Vehicle', es: 'Gasolina para Vehículo', pt: 'Gasolina para Veículo' },
  { key: 'clothing', en: 'Clothing, Shoes', es: 'Ropa, Zapatos', pt: 'Roupas, Sapatos' },
  { key: 'entertainment', en: 'Entertainment (movies, etc.)', es: 'Entretenimiento (cine, etc.)', pt: 'Entretenimento (cinema, etc.)' },
  { key: 'public_transit', en: 'Public Transportation', es: 'Transporte Público', pt: 'Transporte Público' },
  { key: 'jewelry', en: 'Jewelry', es: 'Joyería', pt: 'Joias' },
  { key: 'household_items', en: 'Household Items (furniture, curtains)', es: 'Artículos del Hogar (muebles, cortinas)', pt: 'Itens Domésticos (móveis, cortinas)' },
];

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    intro: 'List the expenses your household has each month and who pays for them.',
    amount: 'Amount/mo ($)',
    who: 'Who pays?',
    explanation: 'How are you meeting these expenses?',
    explanation_hint: 'Describe how you pay for these costs with no income.',
  },
  es: {
    intro: 'Indique los gastos mensuales de su hogar y quién los paga.',
    amount: 'Monto/mes ($)',
    who: '¿Quién paga?',
    explanation: '¿Cómo está cubriendo estos gastos?',
    explanation_hint: 'Explique cómo paga estos costos sin ingresos.',
  },
  pt: {
    // PT: tentative — review
    intro: 'Liste as despesas mensais da sua família e quem as paga.',
    amount: 'Valor/mês ($)',
    who: 'Quem paga?',
    explanation: 'Como você está pagando essas despesas?',
    explanation_hint: 'Explique como paga esses custos sem renda.',
  },
};

export default function SectionHouseholdExpenses({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const existing = intakeData.household_expenses;

  const [data, setData] = useState<IntakeHouseholdExpenses>(existing ?? {});

  const emit = (updated: IntakeHouseholdExpenses) => {
    onChange('household_expenses', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeHouseholdExpenses>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  const itemFor = (key: string): IntakeExpenseLineItem | undefined =>
    (data.line_items ?? []).find((l) => l.key === key);
  const setItem = (key: string, patch: Partial<IntakeExpenseLineItem>) => {
    const list = data.line_items ?? [];
    const next = list.some((l) => l.key === key)
      ? list.map((l) => (l.key === key ? { ...l, ...patch } : l))
      : [...list, { key, ...patch }];
    set({ line_items: next });
  };

  const inputCls =
    'mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none';

  return (
    <FormSection background>
      <p className="text-xs text-[var(--muted)] mb-2">{c.intro}</p>

      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const li = itemFor(cat.key);
          return (
            <div key={cat.key} className="border-b border-[var(--border)] pb-2">
              <p className="text-sm font-medium">{cat[language] ?? cat.en}</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={c.amount} htmlFor={`exp_${cat.key}_amt`}>
                  <input id={`exp_${cat.key}_amt`} type="number" inputMode="decimal" min={0}
                    value={li?.amount ?? ''}
                    onChange={(e) => setItem(cat.key, { amount: parseFloat(e.target.value) || 0 })}
                    className={inputCls} />
                </FormField>
                <FormField label={c.who} htmlFor={`exp_${cat.key}_who`}>
                  <input id={`exp_${cat.key}_who`} type="text"
                    value={li?.who_pays ?? ''}
                    onChange={(e) => setItem(cat.key, { who_pays: e.target.value })}
                    className={inputCls} />
                </FormField>
              </div>
            </div>
          );
        })}
      </div>

      <FormField label={c.explanation} required htmlFor="exp_explanation">
        <textarea id="exp_explanation"
          value={data.expense_explanation ?? ''}
          onChange={(e) => set({ expense_explanation: e.target.value })}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder={c.explanation_hint} />
      </FormField>
    </FormSection>
  );
}
