'use client';

/**
 * components/pbv/intake/SectionAssets.tsx
 * Section 5 — Assets
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeAssets, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

type BooleanAssetKey = keyof Pick<IntakeAssets,
  'has_real_estate' | 'has_savings' | 'has_checking' | 'has_stocks' | 'has_cd' |
  'has_trust' | 'has_bonds' | 'has_life_insurance' | 'has_insurance_settlement' | 'disposed_asset_last_2yr'
>;

const ASSET_FIELDS: Array<{ key: BooleanAssetKey; en: string; es: string; pt: string }> = [
  { key: 'has_real_estate',          en: 'Real estate',                   es: 'Bienes raíces',                       pt: 'Imóveis' },
  { key: 'has_savings',              en: 'Savings account',               es: 'Cuenta de ahorros',                   pt: 'Conta poupança' },
  { key: 'has_checking',             en: 'Checking account',              es: 'Cuenta corriente',                    pt: 'Conta corrente' },
  { key: 'has_stocks',               en: 'Stocks / Bonds / Mutual funds', es: 'Acciones / Bonos / Fondos mutuos',    pt: 'Ações / Títulos / Fundos mútuos' },
  { key: 'has_cd',                   en: 'Certificates of deposit (CDs)', es: 'Certificados de depósito',            pt: 'Certificados de depósito' },
  { key: 'has_trust',                en: 'Trusts',                        es: 'Fideicomisos',                        pt: 'Fundos fiduciários' },
  { key: 'has_bonds',                en: 'Treasury / Savings bonds',      es: 'Bonos del tesoro / ahorros',          pt: 'Títulos do tesouro / poupança' },
  { key: 'has_life_insurance',       en: 'Whole life insurance',          es: 'Seguro de vida entera',               pt: 'Seguro de vida integral' },
  { key: 'has_insurance_settlement', en: 'Insurance settlement',          es: 'Liquidación de seguro',               pt: 'Liquidação de seguro' },
  { key: 'disposed_asset_last_2yr',  en: 'Disposed of asset in last 2 years (below market value)', es: 'Dispuso de un activo en los últimos 2 años (por debajo del valor de mercado)', pt: 'Alienou bem nos últimos 2 anos (abaixo do valor de mercado)' },
];

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    disposed_value: 'Estimated value of disposed asset ($)',
    total_value: 'Estimated total asset value ($)',
    none: 'None of the above',
  },
  es: {
    disposed_value: 'Valor estimado del activo dispuesto ($)',
    total_value: 'Valor total estimado de activos ($)',
    none: 'Ninguno de los anteriores',
  },
  pt: {
    // PT: tentative — review
    disposed_value: 'Valor estimado do bem alienado ($)',
    total_value: 'Valor total estimado dos bens ($)',
    none: 'Nenhum dos acima',
  },
};

function emptyAssets(): IntakeAssets {
  return {
    has_real_estate: false, has_savings: false, has_checking: false,
    has_stocks: false, has_cd: false, has_trust: false, has_bonds: false,
    has_life_insurance: false, has_insurance_settlement: false, disposed_asset_last_2yr: false,
  };
}

export default function SectionAssets({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const [assets, setAssets] = useState<IntakeAssets>(intakeData.assets ?? emptyAssets());

  const emit = (updated: IntakeAssets) => {
    onChange('assets', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(assets); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: BooleanAssetKey, val: boolean) => {
    const updated = { ...assets, [key]: val };
    setAssets(updated);
    emit(updated);
  };

  const hasAnyAsset = ASSET_FIELDS.some((f) => assets[f.key]);

  return (
    <div className="space-y-4">
      <FormSection background>
        {ASSET_FIELDS.map((field) => (
          <label key={field.key} className="flex items-center gap-3 min-h-[44px] py-1">
            <input
              type="checkbox"
              checked={assets[field.key]}
              onChange={(e) => toggle(field.key, e.target.checked)}
              className="w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm">{field[language] ?? field.en}</span>
          </label>
        ))}

        {assets.disposed_asset_last_2yr && (
          <FormField label={c.disposed_value} htmlFor="disposed_value">
            <input
              id="disposed_value"
              type="number"
              inputMode="decimal"
              min={0}
              value={assets.disposed_asset_value ?? ''}
              onChange={(e) => {
                const updated = { ...assets, disposed_asset_value: parseFloat(e.target.value) || 0 };
                setAssets(updated);
                emit(updated);
              }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            />
          </FormField>
        )}
      </FormSection>

      {hasAnyAsset && (
        <FormSection>
          <FormField label={c.total_value} htmlFor="total_value">
            <input
              id="total_value"
              type="number"
              inputMode="decimal"
              min={0}
              value={assets.total_asset_value ?? ''}
              onChange={(e) => {
                const updated = { ...assets, total_asset_value: parseFloat(e.target.value) || 0 };
                setAssets(updated);
                emit(updated);
              }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            />
          </FormField>
        </FormSection>
      )}
    </div>
  );
}
