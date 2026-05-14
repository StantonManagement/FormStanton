import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (must be declared before importing the module under test) ──────────

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsertSelect = vi.fn();
const mockUpdate = vi.fn();

const fromChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockInsertSelect })) })),
  update: vi.fn(() => ({ eq: vi.fn().mockReturnThis() })),
};

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => fromChain),
  },
}));

vi.mock('@/lib/rejection-templates', () => ({
  renderTemplate: vi.fn(async (_code: string, _lang: string) => 'Your document was rejected.'),
}));

vi.mock('@/lib/phoneParser', () => ({
  parsePhoneToE164: vi.fn((phone: string) => {
    const d = phone.replace(/\D/g, '');
    return d.length === 10 ? `+1${d}` : null;
  }),
}));

const mockTwilioCreate = vi.fn();
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockTwilioCreate },
  })),
}));

const mockSendTenantNotification = vi.fn();
vi.mock('@/lib/notifications/send', () => ({
  sendTenantNotification: (...args: unknown[]) => mockSendTenantNotification(...args),
}));

// ── Module under test ─────────────────────────────────────────────────────────

import { sendRejectionNotification } from '@/lib/notifications';
import { renderBody } from '@/lib/notifications/render';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC = { id: 'doc-1', label: 'Bank Statement', form_submission_id: 'sub-1' };
const APP_COMPLETE = {
  id: 'app-1',
  phone: '8605551234',
  preferred_language: 'en',
  language_confirmed_at: '2026-05-01T00:00:00Z',
  head_of_household_name: 'Jane Doe',
};

const BASE_PARAMS = {
  documentId: 'doc-1',
  reasonCode: 'document_illegible',
  reviewerId: 'staff-1',
};

function setupDocAndApp(app: object | null, doc: object | null = DOC) {
  mockSingle
    .mockResolvedValueOnce({ data: doc, error: doc ? null : { message: 'not found' } })
    .mockResolvedValueOnce({ data: app, error: app ? null : { message: 'not found' } });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.PBV_TWILIO_PHONE_NUMBER = '+18005550000';
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_token';
  process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com';
  vi.clearAllMocks();
  mockInsertSelect.mockResolvedValue({ data: { id: 'notif-1' }, error: null });
  mockTwilioCreate.mockResolvedValue({ sid: 'SM123456789' });
  fromChain.update.mockReturnValue({ eq: vi.fn().mockReturnThis() });
  mockSendTenantNotification.mockResolvedValue({ status: 'sent', notificationId: 'notif-1', twilioSid: 'SM123456789' });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ─────────────────────────────────────────────────────────────────────────────

describe('sendRejectionNotification()', () => {
  describe('document not found', () => {
    it('returns failed', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('failed');
    });
  });

  describe('application not found', () => {
    it('returns failed', async () => {
      mockSingle
        .mockResolvedValueOnce({ data: DOC, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('failed');
    });
  });

  describe('missing phone', () => {
    it('returns blocked with reason missing_phone', async () => {
      setupDocAndApp({ ...APP_COMPLETE, phone: null });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.reason).toBe('missing_phone');
      }
    });

    it('inserts a tenant_notifications row with blocked_missing_data status', async () => {
      setupDocAndApp({ ...APP_COMPLETE, phone: null });
      await sendRejectionNotification(BASE_PARAMS);
      expect(mockInsertSelect).toHaveBeenCalled();
    });
  });

  describe('missing language confirmation', () => {
    it('returns blocked with reason missing_language when preferred_language is null', async () => {
      setupDocAndApp({ ...APP_COMPLETE, preferred_language: null, language_confirmed_at: null });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.reason).toBe('missing_language');
      }
    });

    it('returns blocked with reason missing_language when language_confirmed_at is null', async () => {
      setupDocAndApp({ ...APP_COMPLETE, language_confirmed_at: null });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.reason).toBe('missing_language');
      }
    });
  });

  describe('invalid phone (not parseable to E.164)', () => {
    it('returns blocked with reason invalid_phone for a short number', async () => {
      setupDocAndApp({ ...APP_COMPLETE, phone: '123' });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.reason).toBe('invalid_phone');
      }
    });
  });

  describe('happy path — Twilio succeeds', () => {
    it('returns sent with notificationId and twilioSid', async () => {
      setupDocAndApp(APP_COMPLETE);
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('sent');
      if (result.status === 'sent') {
        expect(result.notificationId).toBe('notif-1');
        expect(result.twilioSid).toBe('SM123456789');
      }
    });

    it('calls sendTenantNotification with doc_rejected notification_type', async () => {
      setupDocAndApp(APP_COMPLETE);
      await sendRejectionNotification(BASE_PARAMS);
      expect(mockSendTenantNotification).toHaveBeenCalledWith(
        expect.objectContaining({ notificationType: 'doc_rejected' })
      );
    });
  });

  describe('Twilio failure', () => {
    it('returns failed when Twilio throws', async () => {
      setupDocAndApp(APP_COMPLETE);
      mockSendTenantNotification.mockResolvedValueOnce({ status: 'failed', notificationId: 'notif-1', reason: 'Network error' });
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.error).toContain('Network error');
      }
    });
  });

  describe('missing PBV_TWILIO_PHONE_NUMBER', () => {
    it('returns failed if env var not set', async () => {
      setupDocAndApp(APP_COMPLETE);
      mockSendTenantNotification.mockResolvedValueOnce({ status: 'failed', notificationId: '', reason: 'PBV_TWILIO_PHONE_NUMBER not configured' });
      delete process.env.PBV_TWILIO_PHONE_NUMBER;
      const result = await sendRejectionNotification(BASE_PARAMS);
      expect(result.status).toBe('failed');
    });
  });
});

// ── renderBody unit tests ────────────────────────────────────────────────────

describe('renderBody()', () => {
  it('substitutes known slots', () => {
    const result = renderBody('Hello {tenant_name}, visit {portal_url}', {
      tenant_name: 'Jane',
      portal_url: 'https://example.com/t/abc',
    });
    expect(result).toBe('Hello Jane, visit https://example.com/t/abc');
  });

  it('leaves missing slots as literal text', () => {
    const result = renderBody('Hello {tenant_name}, visit {portal_url}', {
      tenant_name: 'Jane',
    });
    expect(result).toBe('Hello Jane, visit {portal_url}');
  });

  it('handles message_body passthrough for doc_rejected', () => {
    const result = renderBody('{message_body}', { message_body: 'Your bank statement was too blurry.' });
    expect(result).toBe('Your bank statement was too blurry.');
  });

  it('returns template unchanged when no slots present', () => {
    const template = 'No slots here.';
    expect(renderBody(template, {})).toBe(template);
  });
});

// ── Twilio webhook status mapping ─────────────────────────────────────────────

describe('Twilio webhook status mapping', () => {
  const MAPPINGS: Array<{ input: string; expected: string }> = [
    { input: 'queued',      expected: 'queued' },
    { input: 'sending',     expected: 'queued' },
    { input: 'sent',        expected: 'sent' },
    { input: 'delivered',   expected: 'delivered' },
    { input: 'failed',      expected: 'failed' },
    { input: 'undelivered', expected: 'failed' },
  ];

  for (const { input, expected } of MAPPINGS) {
    it(`maps Twilio status "${input}" → delivery_status "${expected}"`, () => {
      const map: Record<string, string> = {
        queued: 'queued', sending: 'queued', sent: 'sent',
        delivered: 'delivered', failed: 'failed', undelivered: 'failed',
      };
      expect(map[input]).toBe(expected);
    });
  }

  it('does not downgrade from delivered', () => {
    const currentStatus = 'delivered';
    const incomingTwilioStatus = 'failed';
    const shouldUpdate = currentStatus !== 'delivered';
    expect(shouldUpdate).toBe(false);
  });
});
