/**
 * PRD-68: mapSignerForms unit tests.
 *
 * Gates from PRD-68 prompt:
 *  - Gate 1: counts come from `*_member_ids.length`; display_name is the
 *    language-selected template name, falling back to `form_id`.
 *  - Gate 2: language resolves preferred_language → doc.language → 'en';
 *    'es' selects display_name_es, otherwise display_name_en.
 */

import { describe, it, expect } from 'vitest';
import {
  mapSignerForms,
  type SignerFormDoc,
  type SignerFormTemplate,
} from '@/lib/pbv/signer-forms-mapping';

function makeDoc(overrides: Partial<SignerFormDoc> = {}): SignerFormDoc {
  return {
    id: 'doc-1',
    form_id: 'lease',
    language: 'en',
    status: 'generated',
    generated_at: '2026-05-21T00:00:00Z',
    finalized_at: null,
    required_signer_member_ids: [],
    collected_signer_member_ids: [],
    conditional_trigger: null,
    ...overrides,
  };
}

function tmpl(
  form_id: string,
  en: string | null,
  es: string | null,
  pt: string | null = null
): SignerFormTemplate {
  return { form_id, display_name_en: en, display_name_es: es, display_name_pt: pt };
}

describe('mapSignerForms — Gate 1 (counts + display_name fallback)', () => {
  it('counts equal the *_member_ids array lengths', () => {
    const out = mapSignerForms({
      docs: [
        makeDoc({
          required_signer_member_ids: ['m1', 'm2', 'm3'],
          collected_signer_member_ids: ['m1'],
        }),
      ],
      templates: [tmpl('lease', 'Lease Agreement', 'Contrato de Arrendamiento')],
      preferredLanguage: 'en',
      signedFormIds: new Set(),
    });

    expect(out[0].required_signer_count).toBe(3);
    expect(out[0].collected_signer_count).toBe(1);
  });

  it('treats null *_member_ids as empty arrays', () => {
    const out = mapSignerForms({
      docs: [
        makeDoc({
          required_signer_member_ids: null,
          collected_signer_member_ids: null,
        }),
      ],
      templates: [],
      preferredLanguage: 'en',
      signedFormIds: new Set(),
    });

    expect(out[0].required_signer_count).toBe(0);
    expect(out[0].collected_signer_count).toBe(0);
  });

  it('display_name falls back to form_id when no template row exists', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'unmapped_form' })],
      templates: [],
      preferredLanguage: 'en',
      signedFormIds: new Set(),
    });

    expect(out[0].display_name).toBe('unmapped_form');
  });

  it('signatures_complete reflects the signedFormIds set', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ id: 'doc-a' }), makeDoc({ id: 'doc-b' })],
      templates: [],
      preferredLanguage: 'en',
      signedFormIds: new Set(['doc-a']),
    });

    expect(out.find((f) => f.id === 'doc-a')!.signatures_complete).toBe(true);
    expect(out.find((f) => f.id === 'doc-b')!.signatures_complete).toBe(false);
  });
});

describe('mapSignerForms — Gate 2 (language fallback)', () => {
  const templates = [tmpl('lease', 'Lease Agreement', 'Contrato de Arrendamiento')];

  it('preferredLanguage="es" selects display_name_es', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease' })],
      templates,
      preferredLanguage: 'es',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Contrato de Arrendamiento');
  });

  it('preferredLanguage="en" selects display_name_en', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease' })],
      templates,
      preferredLanguage: 'en',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Lease Agreement');
  });

  it('falls back to doc.language when preferredLanguage is null', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease', language: 'es' })],
      templates,
      preferredLanguage: null,
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Contrato de Arrendamiento');
  });

  it("falls back to 'en' when both preferredLanguage and doc.language are null", () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease', language: null })],
      templates,
      preferredLanguage: null,
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Lease Agreement');
  });

  it('preferredLanguage="pt" selects display_name_pt when present (PRD-72)', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease' })],
      templates: [tmpl('lease', 'Lease Agreement', 'Contrato de Arrendamiento', 'Contrato de Arrendamento')],
      preferredLanguage: 'pt',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Contrato de Arrendamento');
  });

  it('preferredLanguage="pt" falls back to EN when display_name_pt is NULL (PRD-72)', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'lease' })],
      templates,
      preferredLanguage: 'pt',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('Lease Agreement');
  });

  it('preferredLanguage="pt" falls back to form_id when both _pt and _en are NULL', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'unmapped' })],
      templates: [tmpl('unmapped', null, null, null)],
      preferredLanguage: 'pt',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('unmapped');
  });

  it('falls back to form_id even in es when display_name_es is null', () => {
    const out = mapSignerForms({
      docs: [makeDoc({ form_id: 'half_mapped' })],
      templates: [tmpl('half_mapped', 'Halfway', null)],
      preferredLanguage: 'es',
      signedFormIds: new Set(),
    });
    expect(out[0].display_name).toBe('half_mapped');
  });
});

describe('mapSignerForms — response shape (PRD-68 D3: unchanged for signer page)', () => {
  it('exposes exactly the fields the signer page consumes', () => {
    const out = mapSignerForms({
      docs: [
        makeDoc({
          id: 'doc-x',
          form_id: 'lease',
          status: 'signed',
          required_signer_member_ids: ['m1'],
          collected_signer_member_ids: ['m1'],
          conditional_trigger: 'has_pets',
        }),
      ],
      templates: [tmpl('lease', 'Lease Agreement', null)],
      preferredLanguage: 'en',
      signedFormIds: new Set(['doc-x']),
    });

    expect(Object.keys(out[0]).sort()).toEqual(
      [
        'id',
        'form_id',
        'display_name',
        'language',
        'status',
        'generated_at',
        'finalized_at',
        'required_signer_count',
        'collected_signer_count',
        'signatures_complete',
        'conditional_trigger',
      ].sort()
    );
    expect(out[0].conditional_trigger).toBe('has_pets');
  });
});
