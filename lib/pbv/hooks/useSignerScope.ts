'use client';

/**
 * lib/pbv/hooks/useSignerScope.ts
 *
 * Manages the "active signer" client-side context.
 * No auth swap — the HOH token remains active; this is a UI state switch.
 *
 * device_owner:
 *   'self'      — signer is on their own device (magic-link flow)
 *   'hoh_device' — signer borrowed HOH's device (same-device handoff)
 */

import { useState, useCallback } from 'react';
import type { PreferredLanguage } from '@/types/compliance';

export type DeviceOwner = 'self' | 'hoh_device';

export interface SignerContext {
  memberId: string;
  memberName: string;
  deviceOwner: DeviceOwner;
  language: PreferredLanguage;
}

export function useSignerScope() {
  const [activeSigner, setActiveSigner] = useState<SignerContext | null>(null);

  const startHandoff = useCallback((
    memberId: string,
    memberName: string,
    language: PreferredLanguage,
  ) => {
    setActiveSigner({ memberId, memberName, deviceOwner: 'hoh_device', language });
  }, []);

  const endHandoff = useCallback(() => {
    setActiveSigner(null);
  }, []);

  return { activeSigner, startHandoff, endHandoff };
}
