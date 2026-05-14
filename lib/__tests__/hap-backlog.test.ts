/**
 * hap-backlog.test.ts
 * 
 * Tests for the HAP execution backlog query.
 * Tests the workforce dashboard integration for signing packets.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHapExecutionBacklog, HapExecutionBacklogApp } from '@/lib/work/queries';

// Mock supabaseAdmin
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(() => ({
          order: vi.fn()
        }))
      }))
    }))
  }
}));

describe('HAP Execution Backlog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHapExecutionBacklog', () => {
    it('should return applications ready for HAP execution', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      // Mock signing packets query
      const mockPackets = [
        {
          application_id: 'app-1',
          created_at: '2026-05-10T00:00:00Z',
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'John Doe',
            building_address: '123 Main St',
            unit_number: 'A1'
          }
        },
        {
          application_id: 'app-2',
          created_at: '2026-05-12T00:00:00Z',
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'Jane Smith',
            building_address: '456 Oak Ave',
            unit_number: 'B2'
          }
        }
      ];

      const mockSignatures = [
        // App 1 signatures - all complete
        {
          packet_id: 'app-1',
          document_slug: 'hap_contract',
          document_label: 'HAP Contract',
          signing_party: 'stanton_and_hach',
          is_required: true,
          status: 'signed'
        },
        {
          packet_id: 'app-1',
          document_slug: 'lease_agreement',
          document_label: 'Lease Agreement',
          signing_party: 'tenant_and_stanton',
          is_required: true,
          status: 'signed'
        },
        // App 2 signatures - missing HAP signature
        {
          packet_id: 'app-2',
          document_slug: 'lease_agreement',
          document_label: 'Lease Agreement',
          signing_party: 'tenant_and_stanton',
          is_required: true,
          status: 'signed'
        },
        {
          packet_id: 'app-2',
          document_slug: 'hap_contract',
          document_label: 'HAP Contract',
          signing_party: 'stanton_and_hach',
          is_required: true,
          status: 'pending'
        }
      ];

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'signing_packets') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: mockPackets,
                  error: null
                })
              }))
            }))
          } as any;
        }
        if (table === 'packet_signatures') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: mockSignatures,
                error: null
              })
            }))
          } as any;
        }
        return {} as any;
      });

      const result = await getHapExecutionBacklog();

      expect(result).toHaveLength(2);
      
      // App 1 should be ready to execute
      const app1 = result.find(app => app.application_id === 'app-1');
      expect(app1).toBeDefined();
      expect(app1!.can_execute).toBe(true);
      expect(app1!.hap_signature_status).toBe('signed');
      expect(app1!.completed_signatures_count).toBe(2);
      expect(app1!.required_signatures_count).toBe(2);
      expect(app1!.blocking_signatures).toHaveLength(0);

      // App 2 should not be ready to execute
      const app2 = result.find(app => app.application_id === 'app-2');
      expect(app2).toBeDefined();
      expect(app2!.can_execute).toBe(false);
      expect(app2!.hap_signature_status).toBe('pending');
      expect(app2!.completed_signatures_count).toBe(1);
      expect(app2!.required_signatures_count).toBe(2);
      expect(app2!.blocking_signatures).toHaveLength(1);
      expect(app2!.blocking_signatures[0].document_slug).toBe('hap_contract');
    });

    it('should return empty array when no packets exist', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'signing_packets') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              }))
            }))
          } as any;
        }
        return {} as any;
      });

      const result = await getHapExecutionBacklog();
      expect(result).toHaveLength(0);
    });

    it('should handle waived signatures correctly', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      const mockPackets = [
        {
          application_id: 'app-1',
          created_at: '2026-05-10T00:00:00Z',
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'John Doe',
            building_address: '123 Main St',
            unit_number: 'A1'
          }
        }
      ];

      const mockSignatures = [
        {
          packet_id: 'app-1',
          document_slug: 'hap_contract',
          document_label: 'HAP Contract',
          signing_party: 'stanton_and_hach',
          is_required: true,
          status: 'signed'
        },
        {
          packet_id: 'app-1',
          document_slug: 'lease_agreement',
          document_label: 'Lease Agreement',
          signing_party: 'tenant_and_stanton',
          is_required: true,
          status: 'waived'
        }
      ];

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'signing_packets') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: mockPackets,
                  error: null
                })
              }))
            }))
          } as any;
        }
        if (table === 'packet_signatures') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: mockSignatures,
                error: null
              })
            }))
          } as any;
        }
        return {} as any;
      });

      const result = await getHapExecutionBacklog();

      expect(result).toHaveLength(1);
      const app = result[0];
      expect(app.can_execute).toBe(true);
      expect(app.completed_signatures_count).toBe(2); // Both signed and waived count as complete
      expect(app.blocking_signatures).toHaveLength(0);
    });

    it('should calculate days since packet creation correctly', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      const now = new Date('2026-05-15T00:00:00Z');
      vi.setSystemTime(now);
      
      const mockPackets = [
        {
          application_id: 'app-1',
          created_at: '2026-05-10T00:00:00Z', // 5 days ago
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'John Doe',
            building_address: '123 Main St',
            unit_number: 'A1'
          }
        },
        {
          application_id: 'app-2',
          created_at: '2026-05-13T00:00:00Z', // 2 days ago
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'Jane Smith',
            building_address: '456 Oak Ave',
            unit_number: 'B2'
          }
        }
      ];

      const mockSignatures = [
        {
          packet_id: 'app-1',
          document_slug: 'hap_contract',
          document_label: 'HAP Contract',
          signing_party: 'stanton_and_hach',
          is_required: true,
          status: 'signed'
        },
        {
          packet_id: 'app-2',
          document_slug: 'hap_contract',
          document_label: 'HAP Contract',
          signing_party: 'stanton_and_hach',
          is_required: true,
          status: 'signed'
        }
      ];

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'signing_packets') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: mockPackets,
                  error: null
                })
              }))
            }))
          } as any;
        }
        if (table === 'packet_signatures') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: mockSignatures,
                error: null
              })
            }))
          } as any;
        }
        return {} as any;
      });

      const result = await getHapExecutionBacklog();

      expect(result).toHaveLength(2);
      
      // Should be sorted by days_since_packet_creation descending (oldest first)
      expect(result[0].application_id).toBe('app-1');
      expect(result[0].days_since_packet_creation).toBe(5);
      
      expect(result[1].application_id).toBe('app-2');
      expect(result[1].days_since_packet_creation).toBe(2);
      
      vi.useRealTimers();
    });

    it('should handle missing HAP signature', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      
      const mockPackets = [
        {
          application_id: 'app-1',
          created_at: '2026-05-10T00:00:00Z',
          executed_at: null,
          pbv_full_applications: {
            head_of_household_name: 'John Doe',
            building_address: '123 Main St',
            unit_number: 'A1'
          }
        }
      ];

      const mockSignatures = [
        {
          packet_id: 'app-1',
          document_slug: 'lease_agreement',
          document_label: 'Lease Agreement',
          signing_party: 'tenant_and_stanton',
          is_required: true,
          status: 'signed'
        }
        // No HAP signature
      ];

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'signing_packets') {
          return {
            select: vi.fn(() => ({
              is: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: mockPackets,
                  error: null
                })
              }))
            }))
          } as any;
        }
        if (table === 'packet_signatures') {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: mockSignatures,
                error: null
              })
            }))
          } as any;
        }
        return {} as any;
      });

      const result = await getHapExecutionBacklog();

      expect(result).toHaveLength(1);
      const app = result[0];
      expect(app.can_execute).toBe(false);
      expect(app.hap_signature_status).toBe('missing');
      expect(app.blocking_signatures).toHaveLength(0); // No blocking signatures, but HAP is missing
    });
  });
});
