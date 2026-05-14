/**
 * packet-template.ts
 *
 * Template lookup and signature row generator for signing packets.
 * Handles conditional logic, property-specific addenda, and config-gap detection.
 */

import { supabaseAdmin } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TemplateSignature {
  slug: string;
  label: string;
  party: 'tenant' | 'stanton' | 'hach' | 'tenant_and_stanton' | 'stanton_and_hach';
  required: boolean;
  conditional_on?: {
    property_field: string;
    operator: '<' | '>' | '<=' | '>=' | '=' | '!=';
    value: number | string | boolean;
    default_when_null: 'required' | 'optional' | 'exclude';
  };
  plain_language_description?: string;
}

export interface SigningTemplate {
  id: string;
  template_key: string;
  display_label: string;
  signatures: TemplateSignature[];
  is_active: boolean;
}

export interface Property {
  id: string;
  building_address: string;
  year_built?: number | null;
  required_addenda: Array<{
    slug: string;
    label: string;
    signing_party: string;
    required: boolean;
    plain_language_description?: string;
  }>;
}

export interface GeneratedSignature {
  document_slug: string;
  document_label: string;
  signing_party: string;
  is_required: boolean;
  is_template_default: boolean;
  plain_language_description?: string;
  conditional_note?: string;
}

export interface PacketGenerationResult {
  signatures: GeneratedSignature[];
  used_default_template: boolean;
  used_default_property: boolean;
  config_gaps: {
    property_not_configured: boolean;
    template_defaulted: boolean;
    year_built_unknown: boolean;
  };
}

// ─── Template Loading ───────────────────────────────────────────────────────────

export async function loadTemplate(templateKey: string = 'default_pbv'): Promise<SigningTemplate> {
  const { data, error } = await supabaseAdmin
    .from('signing_packet_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (error) {
    // If requested template not found, fall back to default
    if (templateKey !== 'default_pbv') {
      return loadTemplate('default_pbv');
    }
    throw new Error(`Failed to load signing template: ${error.message}`);
  }

  return data as SigningTemplate;
}

// ─── Property Loading ───────────────────────────────────────────────────────────

export async function loadProperty(buildingAddress: string): Promise<Property | null> {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('building_address', buildingAddress)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new Error(`Failed to load property: ${error.message}`);
  }

  return data as Property | null;
}

// ─── Conditional Logic Evaluation ───────────────────────────────────────────────

function evaluateConditional(
  conditional: TemplateSignature['conditional_on'],
  propertyValue: any
): boolean {
  if (!conditional) return true;

  const { operator, value, default_when_null } = conditional;
  
  // Handle null property value
  if (propertyValue === null || propertyValue === undefined) {
    return default_when_null === 'required';
  }

  // Type-safe comparison
  switch (operator) {
    case '<':
      return Number(propertyValue) < Number(value);
    case '>':
      return Number(propertyValue) > Number(value);
    case '<=':
      return Number(propertyValue) <= Number(value);
    case '>=':
      return Number(propertyValue) >= Number(value);
    case '=':
      return propertyValue === value;
    case '!=':
      return propertyValue !== value;
    default:
      return true;
  }
}

// ─── Signature Generation ───────────────────────────────────────────────────────

export async function generatePacketSignatures(
  application: {
    id: string;
    building_address: string;
  },
  templateKey: string = 'default_pbv'
): Promise<PacketGenerationResult> {
  // Load template and property in parallel
  const [template, property] = await Promise.all([
    loadTemplate(templateKey),
    loadProperty(application.building_address)
  ]);

  const signatures: GeneratedSignature[] = [];
  const config_gaps = {
    property_not_configured: !property,
    template_defaulted: template.template_key === 'default_pbv',
    year_built_unknown: property?.year_built === null
  };

  // Process template signatures
  for (const templateSig of template.signatures) {
    // Evaluate conditional logic
    let includeSignature = true;
    let conditionalNote: string | undefined;

    if (templateSig.conditional_on) {
      const propertyValue = property?.[templateSig.conditional_on.property_field as keyof Property];
      includeSignature = evaluateConditional(templateSig.conditional_on, propertyValue);
      
      // Add note for default applications
      if (includeSignature && propertyValue === null && templateSig.conditional_on.default_when_null === 'required') {
        conditionalNote = `Default — ${templateSig.label.toLowerCase()} required when ${templateSig.conditional_on.property_field.replace('_', ' ')} is unknown`;
      }
    }

    if (includeSignature) {
      signatures.push({
        document_slug: templateSig.slug,
        document_label: templateSig.label,
        signing_party: templateSig.party,
        is_required: templateSig.required,
        is_template_default: true,
        plain_language_description: templateSig.plain_language_description,
        conditional_note: conditionalNote
      });
    }
  }

  // Add property-specific addenda
  if (property?.required_addenda && property.required_addenda.length > 0) {
    for (const addendum of property.required_addenda) {
      signatures.push({
        document_slug: addendum.slug,
        document_label: addendum.label,
        signing_party: addendum.signing_party,
        is_required: addendum.required,
        is_template_default: false,
        plain_language_description: addendum.plain_language_description
      });
    }
  }

  return {
    signatures,
    used_default_template: template.template_key === 'default_pbv',
    used_default_property: !property,
    config_gaps
  };
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

export function isHapSignature(signingParty: string): boolean {
  return signingParty === 'stanton_and_hach' || signingParty === 'hach';
}

export function isTenantSignature(signingParty: string): boolean {
  return signingParty.includes('tenant');
}

export function isStantonSignature(signingParty: string): boolean {
  return signingParty.includes('stanton');
}

export function getSignaturePartyLabel(signingParty: string): string {
  const labels = {
    tenant: 'Tenant',
    stanton: 'Stanton',
    hach: 'HACH',
    tenant_and_stanton: 'Tenant & Stanton',
    stanton_and_hach: 'Stanton & HACH'
  };
  return labels[signingParty as keyof typeof labels] || signingParty;
}
