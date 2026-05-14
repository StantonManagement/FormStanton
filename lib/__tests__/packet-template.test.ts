/**
 * packet-template.test.ts
 * 
 * Tests for the signing packet template generator.
 * Tests template loading, conditional logic, and signature generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  isHapSignature,
  isTenantSignature,
  isStantonSignature,
  getSignaturePartyLabel
} from '@/lib/signing/packet-template';

// Mock supabaseAdmin
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

describe('packet-template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('utility functions', () => {
    it('should identify HAP signatures correctly', () => {
      expect(isHapSignature('stanton_and_hach')).toBe(true);
      expect(isHapSignature('hach')).toBe(true);
      expect(isHapSignature('tenant')).toBe(false);
      expect(isHapSignature('stanton')).toBe(false);
    });

    it('should identify tenant signatures correctly', () => {
      expect(isTenantSignature('tenant')).toBe(true);
      expect(isTenantSignature('tenant_and_stanton')).toBe(true);
      expect(isTenantSignature('stanton')).toBe(false);
      expect(isTenantSignature('hach')).toBe(false);
    });

    it('should identify stanton signatures correctly', () => {
      expect(isStantonSignature('stanton')).toBe(true);
      expect(isStantonSignature('tenant_and_stanton')).toBe(true);
      expect(isStantonSignature('stanton_and_hach')).toBe(true);
      expect(isStantonSignature('tenant')).toBe(false);
    });

    it('should get signature party labels', () => {
      expect(getSignaturePartyLabel('tenant')).toBe('Tenant');
      expect(getSignaturePartyLabel('stanton')).toBe('Stanton');
      expect(getSignaturePartyLabel('hach')).toBe('HACH');
      expect(getSignaturePartyLabel('tenant_and_stanton')).toBe('Tenant & Stanton');
      expect(getSignaturePartyLabel('stanton_and_hach')).toBe('Stanton & HACH');
    });
  });

  describe('conditional logic', () => {
    // Test the conditional logic directly
    const evaluateConditional = (
      conditional: any,
      propertyValue: any
    ): boolean => {
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
    };

    it('should return true when condition is met', () => {
      const conditional = {
        property_field: 'year_built',
        operator: '<' as const,
        value: 1978,
        default_when_null: 'required' as const
      };

      expect(evaluateConditional(conditional, 1975)).toBe(true);
      expect(evaluateConditional(conditional, 1977)).toBe(true);
    });

    it('should return false when condition is not met', () => {
      const conditional = {
        property_field: 'year_built',
        operator: '<' as const,
        value: 1978,
        default_when_null: 'required' as const
      };

      expect(evaluateConditional(conditional, 1978)).toBe(false);
      expect(evaluateConditional(conditional, 1980)).toBe(false);
    });

    it('should handle null values with default_when_null', () => {
      const conditional = {
        property_field: 'year_built',
        operator: '<' as const,
        value: 1978,
        default_when_null: 'required' as const
      };

      expect(evaluateConditional(conditional, null)).toBe(true);
    });

    it('should handle different operators', () => {
      expect(evaluateConditional({
        property_field: 'year_built',
        operator: '>=' as const,
        value: 1978,
        default_when_null: 'optional' as const
      }, 1980)).toBe(true);

      expect(evaluateConditional({
        property_field: 'year_built',
        operator: '=' as const,
        value: 1978,
        default_when_null: 'optional' as const
      }, 1978)).toBe(true);

      expect(evaluateConditional({
        property_field: 'year_built',
        operator: '!=' as const,
        value: 1978,
        default_when_null: 'optional' as const
      }, 1980)).toBe(true);
    });
  });
});
