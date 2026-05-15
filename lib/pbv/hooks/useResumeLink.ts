'use client';

/**
 * lib/pbv/hooks/useResumeLink.ts
 *
 * Handles the "Pick up later" action. Calls POST /api/t/[token]/pbv-full-app/resume
 * to stamp resume_token_last_sent_at. Rate-limited by the API (60min cooldown).
 */

import { useState, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';

export type ResumeLinkStatus = 'idle' | 'sending' | 'sent' | 'error' | 'rate_limited';

export interface UseResumeLinkResult {
  status: ResumeLinkStatus;
  errorMessage: string;
  retryAfterMinutes: number | null;
  sendResumeLink: () => Promise<void>;
}

export function useResumeLink(token: string): UseResumeLinkResult {
  const [status, setStatus] = useState<ResumeLinkStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryAfterMinutes, setRetryAfterMinutes] = useState<number | null>(null);

  const sendResumeLink = useCallback(async () => {
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMessage('');
    setRetryAfterMinutes(null);

    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/resume`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setStatus('rate_limited');
        setRetryAfterMinutes(json.retry_after_minutes ?? 60);
        return;
      }
      if (!res.ok) {
        throw new Error(json.message || 'Failed to send link');
      }
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Could not send link. Please try again.');
    }
  }, [token, status]);

  return { status, errorMessage, retryAfterMinutes, sendResumeLink };
}
