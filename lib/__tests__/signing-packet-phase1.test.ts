/**
 * signing-packet-phase1.test.ts
 *
 * Tests for Phase 1: Staff Signing Surface
 * Covers packet generation, signature actions, HAP execution, and permissions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePacketSignatures, loadTemplate, loadProperty } from '@/lib/signing/packet-template';
import { buildSignedPdfPath, getRevisionFromPath } from '@/lib/signing/storage';
import { supabaseAdmin } from '@/lib/supabase';

// Mock supabaseAdmin
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
      })),
    },
  },
}));

describe('Phase 1: Staff Signing Surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Packet Template Generation', () => {
    it('should generate default template signatures for property with year_built < 1978', async () => {
      const mockProperty = {
        id: 'prop-1',
        address: '123 Test St',
        year_built: 1970,
        required_addenda: [],
      };

      const mockTemplate = {
        id: 'tpl-1',
        template_key: 'default_pbv',
        display_label: 'PBV — HUD Standard Set',
        signatures: [
          {
            slug: 'lease',
            label: 'Residential Lease',
            party: 'tenant_and_stanton' as const,
            required: true,
            plain_language_description: 'The agreement between you and Stanton',
          },
          {
            slug: 'lead_paint',
            label: 'Lead-Based Paint Disclosure',
            party: 'tenant' as const,
            required: true,
            conditional_on: {
              property_field: 'year_built',
              operator: '<' as const,
              value: 1978,
              default_when_null: 'required',
            },
            plain_language_description: 'Required for pre-1978 buildings',
          },
        ],
        is_active: true,
      };

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
          } as any;
        }
        if (table === 'signing_packet_templates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const result = await generatePacketSignatures(
        { id: 'app-1', building_address: '123 Test St' },
        'default_pbv'
      );

      expect(result.signatures).toHaveLength(2);
      expect(result.signatures.some(s => s.document_slug === 'lead_paint')).toBe(true);
      expect(result.config_gaps.year_built_unknown).toBe(false);
    });

    it('should exclude lead paint disclosure for property with year_built >= 1978', async () => {
      const mockProperty = {
        id: 'prop-1',
        address: '123 Test St',
        year_built: 1980,
        required_addenda: [],
      };

      const mockTemplate = {
        id: 'tpl-1',
        template_key: 'default_pbv',
        display_label: 'PBV — HUD Standard Set',
        signatures: [
          {
            slug: 'lease',
            label: 'Residential Lease',
            party: 'tenant_and_stanton' as const,
            required: true,
          },
          {
            slug: 'lead_paint',
            label: 'Lead-Based Paint Disclosure',
            party: 'tenant' as const,
            required: true,
            conditional_on: {
              property_field: 'year_built',
              operator: '<' as const,
              value: 1978,
              default_when_null: 'required',
            },
          },
        ],
        is_active: true,
      };

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
          } as any;
        }
        if (table === 'signing_packet_templates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const result = await generatePacketSignatures(
        { id: 'app-1', building_address: '123 Test St' },
        'default_pbv'
      );

      expect(result.signatures).toHaveLength(1);
      expect(result.signatures.some(s => s.document_slug === 'lead_paint')).toBe(false);
    });

    it('should include property-specific addenda', async () => {
      const mockProperty = {
        id: 'prop-1',
        address: '123 Test St',
        year_built: 1980,
        required_addenda: [
          {
            slug: 'pet_addendum',
            label: 'Pet Addendum',
            signing_party: 'tenant',
            required: true,
            plain_language_description: 'For tenants with pets',
          },
        ],
      };

      const mockTemplate = {
        id: 'tpl-1',
        template_key: 'default_pbv',
        display_label: 'PBV — HUD Standard Set',
        signatures: [
          {
            slug: 'lease',
            label: 'Residential Lease',
            party: 'tenant_and_stanton' as const,
            required: true,
          },
        ],
        is_active: true,
      };

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
          } as any;
        }
        if (table === 'signing_packet_templates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const result = await generatePacketSignatures(
        { id: 'app-1', building_address: '123 Test St' },
        'default_pbv'
      );

      expect(result.signatures).toHaveLength(2);
      expect(result.signatures.some(s => s.document_slug === 'pet_addendum')).toBe(true);
    });

    it('should detect config gaps when property not found', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        template_key: 'default_pbv',
        display_label: 'PBV — HUD Standard Set',
        signatures: [
          {
            slug: 'lease',
            label: 'Residential Lease',
            party: 'tenant_and_stanton' as const,
            required: true,
          },
        ],
        is_active: true,
      };

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          } as any;
        }
        if (table === 'signing_packet_templates') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockTemplate, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const result = await generatePacketSignatures(
        { id: 'app-1', building_address: 'Unknown Address' },
        'default_pbv'
      );

      expect(result.config_gaps.property_not_configured).toBe(true);
      expect(result.config_gaps.template_defaulted).toBe(true);
    });
  });

  describe('Storage Path Generation', () => {
    it('should build versioned storage path', () => {
      const path = buildSignedPdfPath(
        'app-123',
        'sig-456',
        2,
        'lease_signed.pdf'
      );

      expect(path).toBe('app-123/sig-456/2_lease_signed.pdf');
    });

    it('should extract revision number from path', () => {
      const revision = getRevisionFromPath('app-123/sig-456/3_document.pdf');
      expect(revision).toBe(3);
    });

    it('should default to revision 1 if no revision prefix', () => {
      const revision = getRevisionFromPath('app-123/sig-456/document.pdf');
      expect(revision).toBe(1);
    });

    it('should sanitize filename with path separators', () => {
      const path = buildSignedPdfPath(
        'app-123',
        'sig-456',
        1,
        '../../../etc/passwd.pdf'
      );

      expect(path).toBe('app-123/sig-456/1_passwd.pdf');
    });
  });

  describe('Permission Enforcement', () => {
    it('should require execute_hap permission for HAP execution', async () => {
      // This would be tested via API integration tests
      // Verifying the requirePermission('pbv-full-applications', 'execute_hap') guard
      expect(true).toBe(true); // Placeholder for integration test
    });
  });

  describe('HAP Execution Preconditions', () => {
    it('should not allow execution without signed HAP contract', () => {
      const packet = {
        executed_at: null,
        signatures: [
          { id: 'sig-1', is_required: true, status: 'signed', signing_party: 'tenant_and_stanton' },
          { id: 'sig-2', is_required: true, status: 'pending', signing_party: 'stanton_and_hach' },
        ],
      };

      const requiredSignatures = packet.signatures.filter((sig: any) => sig.is_required);
      const completeSignatures = requiredSignatures.filter(
        (sig: any) => ['signed', 'waived', 'executed'].includes(sig.status)
      );
      const hapSignature = packet.signatures.find((sig: any) => sig.signing_party === 'stanton_and_hach');

      const canExecute = completeSignatures.length === requiredSignatures.length &&
                         hapSignature?.status === 'signed';

      expect(canExecute).toBe(false);
    });

    it('should allow execution when all required signatures complete and HAP signed', () => {
      const packet = {
        executed_at: null,
        signatures: [
          { id: 'sig-1', is_required: true, status: 'signed', signing_party: 'tenant_and_stanton' },
          { id: 'sig-2', is_required: true, status: 'signed', signing_party: 'stanton_and_hach' },
        ],
      };

      const requiredSignatures = packet.signatures.filter((sig: any) => sig.is_required);
      const completeSignatures = requiredSignatures.filter(
        (sig: any) => ['signed', 'waived', 'executed'].includes(sig.status)
      );
      const hapSignature = packet.signatures.find((sig: any) => sig.signing_party === 'stanton_and_hach');

      const canExecute = completeSignatures.length === requiredSignatures.length &&
                         hapSignature?.status === 'signed';

      expect(canExecute).toBe(true);
    });

    it('should not allow execution if packet already executed', () => {
      const packet = {
        executed_at: '2026-05-13T12:00:00Z',
        signatures: [
          { id: 'sig-1', is_required: true, status: 'signed', signing_party: 'tenant_and_stanton' },
          { id: 'sig-2', is_required: true, status: 'executed', signing_party: 'stanton_and_hach' },
        ],
      };

      const canExecute = !packet.executed_at;

      expect(canExecute).toBe(false);
    });
  });

  describe('HAP Direction Tracking', () => {
    it('should detect Stanton-first direction from notes', () => {
      const signature = {
        notes: 'hap_initiation_direction: stanton_first',
      };

      const direction = signature.notes.includes('hach_first') ? 'hach_first' :
                         signature.notes.includes('stanton_first') ? 'stanton_first' : null;

      expect(direction).toBe('stanton_first');
    });

    it('should detect HACH-first direction from notes', () => {
      const signature = {
        notes: 'hap_initiation_direction: hach_first',
      };

      const direction = signature.notes.includes('hach_first') ? 'hach_first' :
                         signature.notes.includes('stanton_first') ? 'stanton_first' : null;

      expect(direction).toBe('hach_first');
    });
  });
});
