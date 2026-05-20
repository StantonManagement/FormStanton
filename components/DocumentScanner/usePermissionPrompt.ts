'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PermissionState =
  | { kind: 'idle' }
  | { kind: 'pre_prompt' }
  | { kind: 'requesting' }
  | { kind: 'granted'; stream: MediaStream }
  | { kind: 'denied'; reason: string };

interface UsePermissionPromptOptions {
  onGranted: (stream: MediaStream) => void;
  onDenied: (reason: string) => void;
}

export function usePermissionPrompt(opts: UsePermissionPromptOptions): {
  state: PermissionState;
  openPrePrompt: () => void;
  acceptPrePrompt: () => Promise<void>;
  cancel: () => void;
} {
  const [state, setState] = useState<PermissionState>({ kind: 'idle' });
  const streamRef = useRef<MediaStream | null>(null);
  const optsRef = useRef(opts);

  // Keep opts ref current without re-triggering effects
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const openPrePrompt = useCallback(() => {
    setState({ kind: 'pre_prompt' });
  }, []);

  const acceptPrePrompt = useCallback(async () => {
    setState({ kind: 'requesting' });

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setState({ kind: 'granted', stream });
      optsRef.current.onGranted(stream);
    } catch (err) {
      stopStream();

      let reason = 'unknown';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          reason = 'permission_denied';
        } else if (err.name === 'NotFoundError') {
          reason = 'no_camera';
        }
      }

      setState({ kind: 'denied', reason });
      optsRef.current.onDenied(reason);
    }
  }, [stopStream]);

  const cancel = useCallback(() => {
    stopStream();
    setState({ kind: 'idle' });
  }, [stopStream]);

  return {
    state,
    openPrePrompt,
    acceptPrePrompt,
    cancel,
  };
}
