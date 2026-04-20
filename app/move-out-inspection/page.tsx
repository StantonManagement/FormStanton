'use client';

import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildings } from '@/lib/buildings';
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormCheckbox,
  FormButton,
  FormSection,
  FormLayout,
  SuccessScreen,
  FormPhotoUpload,
} from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import BuildingAutocomplete from '@/components/BuildingAutocomplete';
import { useFormSection, useFormSubmit, useFormData } from '@/lib/formHooks';

// ---------------------------------------------------------------------------
// Damage Catalog v1 (placeholder rates from PRD — REPLACE BEFORE REAL USE)
// Structure: category -> array of severity options with charge amount.
// `estimate: true` means the inspector notes it but no fixed charge applies.
// `wear: true` means no charge (normal wear & tear).
// ---------------------------------------------------------------------------
type CatalogItem = {
  id: string;
  severity: string;
  charge: number;
  estimate?: boolean;
  wear?: boolean;
};

type CatalogCategory = {
  category: string;
  label: string;
  items: CatalogItem[];
};

const DAMAGE_CATALOG: CatalogCategory[] = [
  {
    category: 'drywall',
    label: 'Drywall',
    items: [
      { id: 'drywall-nail', severity: 'Nail/screw hole (≤ dime)', charge: 0, wear: true },
      { id: 'drywall-small', severity: 'Hole: dime to golf ball', charge: 35 },
      { id: 'drywall-med', severity: 'Hole: golf ball to fist', charge: 75 },
      { id: 'drywall-large', severity: 'Hole: larger than fist', charge: 150, estimate: true },
    ],
  },
  {
    category: 'paint',
    label: 'Paint',
    items: [
      { id: 'paint-scuff', severity: 'Scuffs/marks (normal use)', charge: 0, wear: true },
      { id: 'paint-touch', severity: 'One wall touch-up', charge: 50 },
      { id: 'paint-wall', severity: 'One wall full repaint', charge: 100 },
      { id: 'paint-room', severity: 'Full room repaint', charge: 250 },
      { id: 'paint-unauth', severity: 'Unauthorized color (full unit)', charge: 0, estimate: true },
    ],
  },
  {
    category: 'flooring',
    label: 'Flooring',
    items: [
      { id: 'floor-stain-small', severity: 'Carpet stain — small, cleanable', charge: 0 },
      { id: 'floor-stain-spot', severity: 'Carpet stain — spot replacement', charge: 75 },
      { id: 'floor-burn', severity: 'Carpet burn/tear', charge: 150 },
      { id: 'floor-carpet-full', severity: 'Full carpet replacement', charge: 0, estimate: true },
      { id: 'floor-wood-gouge', severity: 'Hardwood scratch/gouge', charge: 50 },
      { id: 'floor-lvp', severity: 'Vinyl/LVP tile replacement', charge: 40 },
    ],
  },
  {
    category: 'doors_trim',
    label: 'Doors & Trim',
    items: [
      { id: 'door-interior', severity: 'Interior door replacement', charge: 175 },
      { id: 'door-trim', severity: 'Damaged trim/baseboard (per section)', charge: 50 },
      { id: 'door-hardware', severity: 'Door hardware replacement', charge: 40 },
    ],
  },
  {
    category: 'appliances',
    label: 'Appliances',
    items: [
      { id: 'app-burner', severity: 'Stovetop burner replacement (per burner)', charge: 75 },
      { id: 'app-oven', severity: 'Oven interior clean (neglect)', charge: 100 },
      { id: 'app-fridge', severity: 'Refrigerator deep clean', charge: 75 },
      { id: 'app-micro', severity: 'Microwave replacement', charge: 150 },
      { id: 'app-dish', severity: 'Dishwasher repair/replacement', charge: 0, estimate: true },
    ],
  },
  {
    category: 'fixtures',
    label: 'Fixtures',
    items: [
      { id: 'fix-blind', severity: 'Blind replacement (per window)', charge: 35 },
      { id: 'fix-light', severity: 'Light fixture replacement', charge: 60 },
      { id: 'fix-cover', severity: 'Outlet/switch cover', charge: 10 },
      { id: 'fix-toilet', severity: 'Toilet seat replacement', charge: 40 },
      { id: 'fix-curtain', severity: 'Shower curtain rod', charge: 30 },
    ],
  },
  {
    category: 'cleaning',
    label: 'Cleaning',
    items: [
      { id: 'clean-light', severity: 'Light clean', charge: 100 },
      { id: 'clean-deep', severity: 'Deep clean', charge: 250 },
      { id: 'clean-extreme', severity: 'Extreme (hoarding/biohazard)', charge: 0, estimate: true },
    ],
  },
  {
    category: 'belongings',
    label: 'Belongings / Trash Haul',
    items: [
      { id: 'haul-small', severity: 'Small (under 1 truckload)', charge: 150 },
      { id: 'haul-med', severity: 'Medium (1–2 truckloads)', charge: 350 },
      { id: 'haul-large', severity: 'Large (dumpster required)', charge: 0, estimate: true },
    ],
  },
  {
    category: 'keys_access',
    label: 'Keys & Access',
    items: [
      { id: 'key-unit', severity: 'Unit key not returned (lock change)', charge: 50 },
      { id: 'key-mailbox', severity: 'Mailbox key not returned', charge: 25 },
      { id: 'key-fob', severity: 'Fob not returned', charge: 75 },
      { id: 'key-permit', severity: 'Parking permit not returned', charge: 25 },
    ],
  },
];

const ROOM_OPTIONS = [
  'Kitchen',
  'Living Room',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Bathroom 1',
  'Bathroom 2',
  'Hallway',
  'Common Area',
  'Exterior',
  'Other',
];

const ROOM_RATINGS = ['clean', 'needs cleaning', 'damaged'] as const;
type RoomRating = typeof ROOM_RATINGS[number] | '';

type RoomCondition = {
  name: string;
  rating: RoomRating;
  notes: string;
};

type DamageItem = {
  id: string;
  category: string;
  catalogItemId: string;
  room: string;
  notes: string;
  flagged: boolean;
  photos: File[];
};

type FixtureCheck = {
  walls: RoomRating;
  floors: RoomRating;
  appliances: RoomRating;
  windowsBlinds: RoomRating;
  fixtures: RoomRating;
};

interface MoveOutFormData {
  // Metadata
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  leaseEndDate: string;
  actualMoveOutDate: string;
  inspectionDate: string;
  inspectorName: string;
  forwardingAddress: string;

  // Keys & access
  unitKeysIssued: number;
  unitKeysReturned: number;
  mailboxKeyReturned: boolean;
  parkingPermitReturned: boolean;
  fobsReturned: number;

  // Rooms
  rooms: RoomCondition[];

  // Fixtures
  fixtures: FixtureCheck;
  smokeCoFunctional: boolean;
  fixtureNotes: string;

  // Belongings
  belongingsLeft: boolean;
  belongingsDescription: string;
  belongingsHaulSize: string;

  // Summary
  overallCondition: 'clean' | 'light' | 'moderate' | 'heavy' | '';
  inspectorDisclaimer: boolean;
}

const initialRooms: RoomCondition[] = [
  { name: 'Kitchen', rating: '', notes: '' },
  { name: 'Living Room', rating: '', notes: '' },
  { name: 'Bedroom 1', rating: '', notes: '' },
  { name: 'Bathroom 1', rating: '', notes: '' },
];

const initialFormData: MoveOutFormData = {
  tenantName: '',
  buildingAddress: '',
  unitNumber: '',
  leaseEndDate: '',
  actualMoveOutDate: '',
  inspectionDate: new Date().toISOString().split('T')[0],
  inspectorName: '',
  forwardingAddress: '',
  unitKeysIssued: 0,
  unitKeysReturned: 0,
  mailboxKeyReturned: false,
  parkingPermitReturned: false,
  fobsReturned: 0,
  rooms: initialRooms,
  fixtures: {
    walls: '',
    floors: '',
    appliances: '',
    windowsBlinds: '',
    fixtures: '',
  },
  smokeCoFunctional: false,
  fixtureNotes: '',
  belongingsLeft: false,
  belongingsDescription: '',
  belongingsHaulSize: '',
  overallCondition: '',
  inspectorDisclaimer: false,
};

function findCatalogItem(catalogItemId: string): CatalogItem | undefined {
  for (const cat of DAMAGE_CATALOG) {
    const item = cat.items.find((i) => i.id === catalogItemId);
    if (item) return item;
  }
  return undefined;
}

function MoveOutInspectionContent() {
  const { formData, updateField } = useFormData(initialFormData);
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [signature, setSignature] = useState('');

  const { currentSection, nextSection, previousSection, goToSection } = useFormSection(4);
  const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(async () => {
    // Demo-only: skip API; success screen renders immediately.
    await new Promise((res) => setTimeout(res, 400));
  });

  if (submitSuccess) {
    return (
      <SuccessScreen
        title="Inspection Submitted"
        message="The move-out inspection has been recorded. The office will review and apply deposit math separately."
        language="en"
        onLanguageChange={() => {}}
      />
    );
  }

  // -------- Room helpers --------
  const updateRoom = (idx: number, field: keyof RoomCondition, value: string) => {
    const next = [...formData.rooms];
    next[idx] = { ...next[idx], [field]: value } as RoomCondition;
    updateField('rooms', next);
  };

  const addRoom = () => {
    updateField('rooms', [...formData.rooms, { name: '', rating: '', notes: '' }]);
  };

  const removeRoom = (idx: number) => {
    updateField('rooms', formData.rooms.filter((_, i) => i !== idx));
  };

  // -------- Damage item helpers --------
  const addDamageItem = () => {
    setDamageItems((items) => [
      ...items,
      {
        id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: '',
        catalogItemId: '',
        room: '',
        notes: '',
        flagged: false,
        photos: [],
      },
    ]);
  };

  const updateDamageItem = (id: string, patch: Partial<DamageItem>) => {
    setDamageItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeDamageItem = (id: string) => {
    setDamageItems((items) => items.filter((it) => it.id !== id));
  };

  const totalCharges = damageItems.reduce((sum, item) => {
    const cat = findCatalogItem(item.catalogItemId);
    if (!cat || cat.estimate || cat.wear) return sum;
    return sum + cat.charge;
  }, 0);

  const estimateCount = damageItems.filter((it) => {
    const cat = findCatalogItem(it.catalogItemId);
    return cat?.estimate;
  }).length;

  // -------- Submit --------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature || !formData.inspectorDisclaimer) return;
    await submit(formData);
  };

  const tabs = [
    { id: 1, label: 'Info & Keys' },
    { id: 2, label: 'Condition' },
    { id: 3, label: 'Damage Items' },
    { id: 4, label: 'Review & Sign' },
  ];

  return (
    <>
      <Header language="en" onLanguageChange={() => {}} />

      <FormLayout>
        <TabNavigation tabs={tabs} activeTab={currentSection} onTabClick={goToSection} />

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="mb-8">
            <div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm">
              <h1 className="font-serif text-xl text-[var(--primary)] mb-2">Move-Out Inspection</h1>
              <p className="text-sm text-[var(--ink)] leading-relaxed">
                Walk the unit and record condition, damage, and key return. Charges shown are estimates from the current damage schedule — the office applies final deposit math separately.
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* ---------------- Section 1: Info & Keys ---------------- */}
              {currentSection === 1 && (
                <FormSection>
                  <SectionHeader title="Inspection Info" sectionNumber={1} totalSections={4} />

                  <FormField label="Tenant Name(s)" required>
                    <FormInput
                      type="text"
                      value={formData.tenantName}
                      onChange={(e) => updateField('tenantName', e.target.value)}
                      placeholder="Full name(s) on lease"
                      required
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Building" required>
                      <BuildingAutocomplete
                        value={formData.buildingAddress}
                        onChange={(val) => updateField('buildingAddress', val)}
                        buildings={buildings}
                        placeholder="Select building"
                        required
                      />
                    </FormField>

                    <FormField label="Unit #" required>
                      <FormInput
                        type="text"
                        value={formData.unitNumber}
                        onChange={(e) => updateField('unitNumber', e.target.value)}
                        placeholder="Unit number"
                        required
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Lease End Date">
                      <FormInput
                        type="date"
                        value={formData.leaseEndDate}
                        onChange={(e) => updateField('leaseEndDate', e.target.value)}
                      />
                    </FormField>

                    <FormField label="Actual Move-Out Date">
                      <FormInput
                        type="date"
                        value={formData.actualMoveOutDate}
                        onChange={(e) => updateField('actualMoveOutDate', e.target.value)}
                      />
                    </FormField>

                    <FormField label="Inspection Date" required>
                      <FormInput
                        type="date"
                        value={formData.inspectionDate}
                        onChange={(e) => updateField('inspectionDate', e.target.value)}
                        required
                      />
                    </FormField>
                  </div>

                  <FormField label="Inspector Name" required>
                    <FormInput
                      type="text"
                      value={formData.inspectorName}
                      onChange={(e) => updateField('inspectorName', e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </FormField>

                  <FormField label="Forwarding Address (if provided by tenant)">
                    <FormTextarea
                      rows={2}
                      value={formData.forwardingAddress}
                      onChange={(e) => updateField('forwardingAddress', e.target.value)}
                      placeholder="Street, City, State, ZIP"
                    />
                  </FormField>

                  <div className="bg-[var(--bg-section)] p-4 rounded-sm border border-[var(--border)]">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Keys & Access Return</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                      <FormField label="Unit Keys — Issued">
                        <FormInput
                          type="number"
                          min="0"
                          value={formData.unitKeysIssued}
                          onChange={(e) => updateField('unitKeysIssued', parseInt(e.target.value) || 0)}
                        />
                      </FormField>
                      <FormField label="Unit Keys — Returned">
                        <FormInput
                          type="number"
                          min="0"
                          value={formData.unitKeysReturned}
                          onChange={(e) => updateField('unitKeysReturned', parseInt(e.target.value) || 0)}
                        />
                      </FormField>
                    </div>

                    <FormField label="Fobs / Garage Remotes Returned (count)">
                      <FormInput
                        type="number"
                        min="0"
                        value={formData.fobsReturned}
                        onChange={(e) => updateField('fobsReturned', parseInt(e.target.value) || 0)}
                      />
                    </FormField>

                    <div className="mt-3 space-y-2">
                      <FormCheckbox
                        label="Mailbox key returned"
                        checked={formData.mailboxKeyReturned}
                        onChange={(e) => updateField('mailboxKeyReturned', e.target.checked)}
                      />
                      <FormCheckbox
                        label="Parking permit returned"
                        checked={formData.parkingPermitReturned}
                        onChange={(e) => updateField('parkingPermitReturned', e.target.checked)}
                      />
                    </div>
                  </div>

                  <FormButton type="button" onClick={() => nextSection()} fullWidth>
                    Continue
                  </FormButton>
                </FormSection>
              )}

              {/* ---------------- Section 2: Condition ---------------- */}
              {currentSection === 2 && (
                <FormSection>
                  <SectionHeader title="Unit Condition" sectionNumber={2} totalSections={4} />

                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)]">
                      Rate each room and note anything that stands out. Add rooms as needed. Fixtures and systems are rated separately below.
                    </p>
                  </div>

                  <h3 className="text-base font-semibold text-[var(--primary)] mb-3 font-serif">Room-by-Room</h3>

                  <div className="space-y-4 mb-6">
                    {formData.rooms.map((room, idx) => (
                      <div
                        key={idx}
                        className="border border-[var(--border)] bg-white p-4 rounded-sm"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
                          <FormField label={`Room ${idx + 1} Name`}>
                            <FormSelect
                              value={room.name}
                              onChange={(e) => updateRoom(idx, 'name', e.target.value)}
                            >
                              <option value="">Select room…</option>
                              {ROOM_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </FormSelect>
                          </FormField>
                          <FormField label="Rating">
                            <FormSelect
                              value={room.rating}
                              onChange={(e) => updateRoom(idx, 'rating', e.target.value)}
                            >
                              <option value="">—</option>
                              {ROOM_RATINGS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </FormSelect>
                          </FormField>
                          <button
                            type="button"
                            onClick={() => removeRoom(idx)}
                            className="px-3 py-3 text-xs text-[var(--error)] border border-[var(--border)] hover:bg-red-50 rounded-none"
                            aria-label="Remove room"
                          >
                            Remove
                          </button>
                        </div>
                        <FormField label="Notes">
                          <FormTextarea
                            rows={2}
                            value={room.notes}
                            onChange={(e) => updateRoom(idx, 'notes', e.target.value)}
                            placeholder="Condition notes for this room"
                          />
                        </FormField>
                      </div>
                    ))}
                  </div>

                  <FormButton type="button" variant="secondary" onClick={addRoom}>
                    + Add Room
                  </FormButton>

                  <h3 className="text-base font-semibold text-[var(--primary)] mb-3 mt-8 font-serif">
                    Fixtures & Systems
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(
                      [
                        ['walls', 'Walls'],
                        ['floors', 'Floors'],
                        ['appliances', 'Appliances'],
                        ['windowsBlinds', 'Windows / Blinds'],
                        ['fixtures', 'Light fixtures & hardware'],
                      ] as const
                    ).map(([key, label]) => (
                      <FormField key={key} label={label}>
                        <FormSelect
                          value={formData.fixtures[key]}
                          onChange={(e) =>
                            updateField('fixtures', {
                              ...formData.fixtures,
                              [key]: e.target.value as RoomRating,
                            })
                          }
                        >
                          <option value="">—</option>
                          {ROOM_RATINGS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </FormSelect>
                      </FormField>
                    ))}
                  </div>

                  <FormCheckbox
                    label="Smoke & CO detectors present and functional"
                    checked={formData.smokeCoFunctional}
                    onChange={(e) => updateField('smokeCoFunctional', e.target.checked)}
                  />

                  <FormField label="Additional fixture / system notes">
                    <FormTextarea
                      rows={3}
                      value={formData.fixtureNotes}
                      onChange={(e) => updateField('fixtureNotes', e.target.value)}
                      placeholder="Anything that doesn't fit a category"
                    />
                  </FormField>

                  <h3 className="text-base font-semibold text-[var(--primary)] mb-3 mt-8 font-serif">
                    Belongings Left Behind
                  </h3>

                  <FormCheckbox
                    label="Tenant left belongings in the unit"
                    checked={formData.belongingsLeft}
                    onChange={(e) => updateField('belongingsLeft', e.target.checked)}
                  />

                  {formData.belongingsLeft && (
                    <>
                      <FormField label="Description">
                        <FormTextarea
                          rows={2}
                          value={formData.belongingsDescription}
                          onChange={(e) => updateField('belongingsDescription', e.target.value)}
                          placeholder="Furniture, trash, personal items, etc."
                        />
                      </FormField>

                      <FormField label="Haul Size">
                        <FormSelect
                          value={formData.belongingsHaulSize}
                          onChange={(e) => updateField('belongingsHaulSize', e.target.value)}
                        >
                          <option value="">Select size…</option>
                          <option value="haul-small">Small (under 1 truckload) — $150</option>
                          <option value="haul-med">Medium (1–2 truckloads) — $350</option>
                          <option value="haul-large">Large (dumpster required) — estimate</option>
                        </FormSelect>
                      </FormField>
                    </>
                  )}

                  <div className="flex gap-3 mt-6">
                    <FormButton type="button" variant="secondary" onClick={() => previousSection()}>
                      Back
                    </FormButton>
                    <FormButton type="button" onClick={() => nextSection()} fullWidth>
                      Continue
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ---------------- Section 3: Damage Items ---------------- */}
              {currentSection === 3 && (
                <FormSection>
                  <SectionHeader title="Damage Items" sectionNumber={3} totalSections={4} />

                  <div className="bg-[var(--bg-section)] border-l-4 border-[var(--accent)] p-4 rounded-sm mb-6">
                    <p className="text-sm text-[var(--ink)] mb-2">
                      Add one entry per piece of damage. Charges auto-populate from the current damage schedule — you cannot edit them.
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Flag anything you're unsure about as wear-vs-damage. The office makes the final call.
                    </p>
                  </div>

                  <div className="space-y-6 mb-6">
                    {damageItems.length === 0 && (
                      <div className="text-center text-sm text-[var(--muted)] py-8 border border-dashed border-[var(--border)]">
                        No damage items added yet. Click below to add one.
                      </div>
                    )}

                    {damageItems.map((item, idx) => {
                      const category = DAMAGE_CATALOG.find((c) => c.category === item.category);
                      const catalogItem = findCatalogItem(item.catalogItemId);
                      return (
                        <div
                          key={item.id}
                          className="border border-[var(--border)] bg-white p-4 rounded-sm"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-[var(--ink)]">
                              Damage Item #{idx + 1}
                            </h4>
                            <button
                              type="button"
                              onClick={() => removeDamageItem(item.id)}
                              className="text-xs text-[var(--error)] hover:underline"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="Category" required>
                              <FormSelect
                                value={item.category}
                                onChange={(e) =>
                                  updateDamageItem(item.id, {
                                    category: e.target.value,
                                    catalogItemId: '',
                                  })
                                }
                              >
                                <option value="">Select category…</option>
                                {DAMAGE_CATALOG.map((c) => (
                                  <option key={c.category} value={c.category}>
                                    {c.label}
                                  </option>
                                ))}
                              </FormSelect>
                            </FormField>

                            <FormField label="Severity / Size" required>
                              <FormSelect
                                value={item.catalogItemId}
                                onChange={(e) =>
                                  updateDamageItem(item.id, { catalogItemId: e.target.value })
                                }
                                disabled={!category}
                              >
                                <option value="">
                                  {category ? 'Select severity…' : 'Select category first'}
                                </option>
                                {category?.items.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.severity}
                                    {i.wear ? ' — wear (no charge)' : ''}
                                    {i.estimate ? ' — estimate' : ''}
                                    {!i.wear && !i.estimate ? ` — $${i.charge}` : ''}
                                  </option>
                                ))}
                              </FormSelect>
                            </FormField>

                            <FormField label="Room" required>
                              <FormSelect
                                value={item.room}
                                onChange={(e) => updateDamageItem(item.id, { room: e.target.value })}
                              >
                                <option value="">Select room…</option>
                                {ROOM_OPTIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </FormSelect>
                            </FormField>

                            <FormField label="Charge">
                              <div className="mt-1 flex items-center h-[50px] px-4 bg-[var(--bg-section)] border border-[var(--border)] text-sm">
                                {catalogItem ? (
                                  catalogItem.wear ? (
                                    <span className="text-[var(--muted)]">
                                      $0 — normal wear
                                    </span>
                                  ) : catalogItem.estimate ? (
                                    <span className="text-[var(--ink)]">
                                      Estimate required (office will price)
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-[var(--ink)]">
                                      ${catalogItem.charge.toFixed(2)}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[var(--muted)]">—</span>
                                )}
                              </div>
                            </FormField>
                          </div>

                          <FormField label="Notes">
                            <FormTextarea
                              rows={2}
                              value={item.notes}
                              onChange={(e) => updateDamageItem(item.id, { notes: e.target.value })}
                              placeholder="Describe what you saw"
                            />
                          </FormField>

                          <FormPhotoUpload
                            maxPhotos={5}
                            label="Photos (1–5 required)"
                            helperText="Wide shot + close-up is ideal"
                            photos={item.photos}
                            onPhotosChange={(photos) => updateDamageItem(item.id, { photos })}
                          />

                          <div className="mt-3">
                            <FormCheckbox
                              label="Flag for review — I'm not sure if this is wear or damage"
                              checked={item.flagged}
                              onChange={(e) =>
                                updateDamageItem(item.id, { flagged: e.target.checked })
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <FormButton type="button" variant="secondary" onClick={addDamageItem}>
                    + Add Damage Item
                  </FormButton>

                  {damageItems.length > 0 && (
                    <div className="mt-6 bg-[var(--bg-section)] p-4 border border-[var(--border)]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--ink)]">Estimated total charges</span>
                        <span className="text-lg font-semibold text-[var(--primary)]">
                          ${totalCharges.toFixed(2)}
                        </span>
                      </div>
                      {estimateCount > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-1">
                          + {estimateCount} item{estimateCount === 1 ? '' : 's'} requiring an office
                          estimate (not included in total)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <FormButton type="button" variant="secondary" onClick={() => previousSection()}>
                      Back
                    </FormButton>
                    <FormButton type="button" onClick={() => nextSection()} fullWidth>
                      Continue
                    </FormButton>
                  </div>
                </FormSection>
              )}

              {/* ---------------- Section 4: Review & Sign ---------------- */}
              {currentSection === 4 && (
                <FormSection>
                  <SectionHeader title="Review & Sign" sectionNumber={4} totalSections={4} />

                  <div className="bg-[var(--bg-section)] p-4 border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">Inspection Info</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-[var(--muted)]">Tenant:</div>
                      <div className="font-medium">{formData.tenantName || '—'}</div>
                      <div className="text-[var(--muted)]">Building:</div>
                      <div className="font-medium">{formData.buildingAddress || '—'}</div>
                      <div className="text-[var(--muted)]">Unit:</div>
                      <div className="font-medium">{formData.unitNumber || '—'}</div>
                      <div className="text-[var(--muted)]">Inspection Date:</div>
                      <div className="font-medium">{formData.inspectionDate || '—'}</div>
                      <div className="text-[var(--muted)]">Inspector:</div>
                      <div className="font-medium">{formData.inspectorName || '—'}</div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-section)] p-4 border border-[var(--border)] mb-4">
                    <h4 className="text-sm font-semibold text-[var(--ink)] mb-2">Damage Summary</h4>
                    <div className="text-sm space-y-1">
                      <p>{damageItems.length} damage item{damageItems.length === 1 ? '' : 's'} logged</p>
                      <p>
                        Estimated charges:{' '}
                        <span className="font-semibold">${totalCharges.toFixed(2)}</span>
                      </p>
                      {estimateCount > 0 && (
                        <p className="text-[var(--muted)]">
                          {estimateCount} item{estimateCount === 1 ? '' : 's'} pending office estimate
                        </p>
                      )}
                      <p>
                        Flagged for review:{' '}
                        {damageItems.filter((d) => d.flagged).length}
                      </p>
                    </div>
                  </div>

                  <FormField label="Overall unit condition" required>
                    <FormSelect
                      value={formData.overallCondition}
                      onChange={(e) =>
                        updateField(
                          'overallCondition',
                          e.target.value as MoveOutFormData['overallCondition']
                        )
                      }
                      required
                    >
                      <option value="">Select…</option>
                      <option value="clean">Clean — minimal turnover needed</option>
                      <option value="light">Light — standard cleaning + touch-ups</option>
                      <option value="moderate">Moderate — multiple repairs</option>
                      <option value="heavy">Heavy — significant work required</option>
                    </FormSelect>
                  </FormField>

                  <div className="space-y-2 mb-4">
                    <SignatureCanvasComponent
                      label="Inspector Signature"
                      value={signature}
                      onSave={(dataUrl) => setSignature(dataUrl)}
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 mb-4">
                    Charges shown are estimates from the current damage schedule. Final deposit math
                    is handled by the office. Submitting this inspection locks it to the active
                    catalog version.
                  </div>

                  <FormCheckbox
                    label="I have walked the unit, photographed damage as applicable, and attest this record is accurate."
                    checked={formData.inspectorDisclaimer}
                    onChange={(e) => updateField('inspectorDisclaimer', e.target.checked)}
                    required
                  />

                  {submitError && (
                    <div className="bg-red-50 border border-red-200 p-4 mt-4">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <FormButton type="button" variant="secondary" onClick={() => previousSection()}>
                      Back
                    </FormButton>
                    <FormButton
                      type="submit"
                      variant="success"
                      fullWidth
                      loading={isSubmitting}
                      disabled={!signature || !formData.inspectorDisclaimer || !formData.overallCondition}
                    >
                      {isSubmitting ? 'Submitting…' : 'Submit Inspection'}
                    </FormButton>
                  </div>
                </FormSection>
              )}
            </motion.div>
          </AnimatePresence>
        </form>
      </FormLayout>

      <Footer />
    </>
  );
}

export default function MoveOutInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
          <p className="text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <MoveOutInspectionContent />
    </Suspense>
  );
}
