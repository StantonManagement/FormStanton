'use client';

/**
 * components/pbv/intake/SectionAssets.tsx
 * Section 5 — Assets
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeAssets, IntakeAssetDetail, SectionSlug, IntakePets, IntakeVehicle } from '@/lib/pbv/intake-schema';

function YesNo({ name, value, onChange, yesLabel, noLabel }: {
  name: string; value: boolean | null; onChange: (v: boolean) => void;
  yesLabel: string; noLabel: string;
}) {
  return (
    <div className="flex gap-4 mt-2" role="radiogroup" aria-required="true">
      <label className="flex items-center gap-2 text-sm min-h-[44px]">
        <input type="radio" name={name} checked={value === true}
          onChange={() => onChange(true)} className="w-4 h-4" />
        {yesLabel}
      </label>
      <label className="flex items-center gap-2 text-sm min-h-[44px]">
        <input type="radio" name={name} checked={value === false}
          onChange={() => onChange(false)} className="w-4 h-4" />
        {noLabel}
      </label>
    </div>
  );
}

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
    total_value: 'Estimated total value of all checked assets ($)',
    total_value_context: 'Applies to:',
    none: 'None of the above',
    asset_institution: 'Bank / institution (optional)',
    asset_value: 'Current value ($)',
    asset_owner: 'Owner (household member)',
    pets_label: 'Does the household have any pets?',
    vehicle_label: 'Does the household have a vehicle?',
    yes: 'Yes',
    no: 'No',
  },
  es: {
    disposed_value: 'Valor estimado del activo dispuesto ($)',
    total_value: 'Valor total estimado de todos los activos marcados ($)',
    total_value_context: 'Aplica a:',
    none: 'Ninguno de los anteriores',
    asset_institution: 'Banco / institución (opcional)',
    asset_value: 'Valor actual ($)',
    asset_owner: 'Propietario (miembro del hogar)',
    pets_label: '¿El hogar tiene mascotas?',
    vehicle_label: '¿El hogar tiene un vehículo?',
    yes: 'Sí',
    no: 'No',
  },
  pt: {
    // PT: tentative — review
    disposed_value: 'Valor estimado do bem alienado ($)',
    total_value: 'Valor total estimado de todos os bens marcados ($)',
    total_value_context: 'Aplica-se a:', // PT: tentative — review
    none: 'Nenhum dos acima',
    asset_institution: 'Banco / instituição (opcional)', // PT: tentative — review
    asset_value: 'Valor atual ($)', // PT: tentative — review
    asset_owner: 'Proprietário (membro da família)', // PT: tentative — review
    pets_label: 'A família tem animais de estimação?', // PT: tentative — review
    vehicle_label: 'A família tem um veículo?', // PT: tentative — review
    yes: 'Sim',
    no: 'Não',
  },
};

function emptyAssets(): IntakeAssets {
  return {
    has_real_estate: false, has_savings: false, has_checking: false,
    has_stocks: false, has_cd: false, has_trust: false, has_bonds: false,
    has_life_insurance: false, has_insurance_settlement: false, disposed_asset_last_2yr: false,
  };
}

type IntakePetsWithNeutral = IntakePets | { has_pets: boolean | null };
type IntakeVehicleWithNeutral = IntakeVehicle | { has_vehicle: boolean | null };

export default function SectionAssets({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const [assets, setAssets] = useState<IntakeAssets>(intakeData.assets ?? emptyAssets());
  // Phase 6: Pets/vehicle with neutral defaults (null, not pre-selected)
  const [pets, setPets] = useState<IntakePetsWithNeutral>(intakeData.pets ?? { has_pets: null });
  const [vehicle, setVehicle] = useState<IntakeVehicleWithNeutral>(intakeData.vehicle ?? { has_vehicle: null });

  const emitAssets = (updated: IntakeAssets) => {
    onChange('assets', updated as unknown as Record<string, unknown>);
  };
  // Phase 6: Emit pets/vehicle via type assertion (not standard sections)
  const emitPets = (updated: IntakePets) => {
    onChange('assets' as SectionSlug, { pets: updated } as unknown as Record<string, unknown>);
  };
  const emitVehicle = (updated: IntakeVehicle) => {
    onChange('assets' as SectionSlug, { vehicle: updated } as unknown as Record<string, unknown>);
  };

  useEffect(() => { emitAssets(assets); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pets.has_pets !== null) emitPets(pets as IntakePets);
  }, [pets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (vehicle.has_vehicle !== null) emitVehicle(vehicle as IntakeVehicle);
  }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: BooleanAssetKey, val: boolean) => {
    const updated = { ...assets, [key]: val };
    setAssets(updated);
    emitAssets(updated);
  };

  // WS-D #3: per-asset detail (institution / value / owner) → asset table rows.
  const detailFor = (type: string): IntakeAssetDetail | undefined =>
    (assets.asset_details ?? []).find((d) => d.type === type);
  const setDetail = (type: string, patch: Partial<IntakeAssetDetail>) => {
    const list = assets.asset_details ?? [];
    const next = list.some((d) => d.type === type)
      ? list.map((d) => (d.type === type ? { ...d, ...patch } : d))
      : [...list, { type, ...patch }];
    const updated = { ...assets, asset_details: next };
    setAssets(updated);
    emitAssets(updated);
  };

  const hasAnyAsset = ASSET_FIELDS.some((f) => assets[f.key]);

  return (
    <div className="space-y-4">
      <FormSection background>
        {ASSET_FIELDS.map((field) => {
          const showDetail = assets[field.key] && field.key !== 'disposed_asset_last_2yr';
          const d = detailFor(field.key);
          return (
            <div key={field.key} className="space-y-2">
              <label className="flex items-center gap-3 min-h-[44px] py-1">
                <input
                  type="checkbox"
                  checked={assets[field.key]}
                  onChange={(e) => toggle(field.key, e.target.checked)}
                  className="w-4 h-4 flex-shrink-0"
                />
                <span className="text-sm">{field[language] ?? field.en}</span>
              </label>
              {showDetail && (
                <div className="pl-7 space-y-2">
                  <FormField label={c.asset_owner} htmlFor={`owner_${field.key}`}>
                    <input id={`owner_${field.key}`} type="text" value={d?.owner ?? ''}
                      onChange={(e) => setDetail(field.key, { owner: e.target.value })}
                      className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
                  </FormField>
                  <FormField label={c.asset_institution} htmlFor={`inst_${field.key}`}>
                    <input id={`inst_${field.key}`} type="text" value={d?.institution ?? ''}
                      onChange={(e) => setDetail(field.key, { institution: e.target.value })}
                      className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
                  </FormField>
                  <FormField label={c.asset_value} htmlFor={`val_${field.key}`}>
                    <input id={`val_${field.key}`} type="number" inputMode="decimal" min={0} value={d?.value ?? ''}
                      onChange={(e) => setDetail(field.key, { value: parseFloat(e.target.value) || 0 })}
                      className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
                  </FormField>
                </div>
              )}
            </div>
          );
        })}

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
                emitAssets(updated);
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
                emitAssets(updated);
              }}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none"
            />
          </FormField>
          {/* Phase 5: Show checked asset types for clarity */}
          <p className="text-xs text-[var(--muted)] mt-2">
            <span className="font-medium">{c.total_value_context}</span>{' '}
            {ASSET_FIELDS.filter((f) => assets[f.key] && f.key !== 'disposed_asset_last_2yr')
              .map((f) => f[language] ?? f.en)
              .join(', ')}
          </p>
        </FormSection>
      )}

      {/* Phase 6: Pets/vehicle capture (PRD-55 cross-dependency) */}
      <FormSection background>
        <p className="text-sm">{c.pets_label}</p>
        <YesNo
          name="has_pets"
          value={pets.has_pets as boolean | null}
          onChange={(v) => setPets({ has_pets: v })}
          yesLabel={c.yes}
          noLabel={c.no}
        />
      </FormSection>

      <FormSection background>
        <p className="text-sm">{c.vehicle_label}</p>
        <YesNo
          name="has_vehicle"
          value={vehicle.has_vehicle as boolean | null}
          onChange={(v) => setVehicle({ has_vehicle: v })}
          yesLabel={c.yes}
          noLabel={c.no}
        />
      </FormSection>
    </div>
  );
}
