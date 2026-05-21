'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScannerLanguage, translations } from './translations';
import FirstScanTooltip from './FirstScanTooltip';
import QuadOverlay from './QuadOverlay';
import { startDetectionLoop, type Quad, type DetectorAdapter, createScanicAdapter } from './edgeDetectionLoop';
import { createStabilityTracker, type StabilityState } from './stabilityTracker';
import { createLockTimeoutTracker } from './lockTimeout';

// Extend Window interface for scanic (loaded via script tag from /public/scanic/)
// Using unknown to avoid type mismatches with actual scanic types - runtime works fine
type ScanicScanner = {
  initialize(): Promise<void>;
  scan(image: HTMLCanvasElement | HTMLImageElement, options: unknown): Promise<unknown>;
  extract(image: HTMLCanvasElement | HTMLImageElement, corners: unknown, options: unknown): Promise<unknown>;
};

declare global {
  interface Window {
    scanic?: { Scanner: new () => ScanicScanner };
    __scanicInstance?: ScanicScanner;
  }
}

// Load scanic from local /public/scanic/ directory (synced via postinstall script)
async function ensureScanicLoaded(): Promise<DetectorAdapter> {
  if (typeof window === 'undefined') {
    throw new Error('Scanic can only be loaded in browser');
  }
  
  // Return cached instance if available (cast to any since script-loaded)
  if (window.__scanicInstance) {
    return createScanicAdapter(window.__scanicInstance as unknown as import('scanic').Scanner);
  }
  
  // Check if scanic script already loaded
  if (!window.scanic?.Scanner) {
    // Load script dynamically like OpenCV.js
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-scanic="true"]') as HTMLScriptElement | null;
      if (existing && window.scanic?.Scanner) {
        resolve();
        return;
      }
      
      const script = existing ?? document.createElement('script');
      script.async = true;
      script.setAttribute('data-scanic', 'true');
      script.src = '/scanic/scanic.umd.cjs';
      
      script.onload = () => {
        if (window.scanic?.Scanner) {
          resolve();
        } else {
          reject(new Error('Scanic loaded but Scanner not available'));
        }
      };
      
      script.onerror = () => reject(new Error('Failed to load scanic from /public/scanic/'));
      
      if (!existing) {
        document.body.appendChild(script);
      }
    });
  }
  
  // Initialize scanic
  const Scanner = window.scanic?.Scanner;
  if (!Scanner) {
    throw new Error('Scanic failed to load');
  }
  
  const instance = new Scanner();
  await instance.initialize();
  window.__scanicInstance = instance;
  
  // Cast to any since we load scanic via script tag without full TypeScript types
  return createScanicAdapter(instance as unknown as import('scanic').Scanner);
}

// Re-export for DocumentScanner.tsx
export { ensureScanicLoaded };

export interface LiveCaptureMeta {
  documentDetected: boolean;
}

interface LivePreviewStageProps {
  stream: MediaStream;
  language: ScannerLanguage;
  onCancel: () => void;
  onCapture: (blob: Blob, meta: LiveCaptureMeta) => void;
}

export default function LivePreviewStage({
  stream,
  language,
  onCancel,
  onCapture,
}: LivePreviewStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream>(stream);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [overlayColor, setOverlayColor] = useState<'amber' | 'green'>('amber');
  const [adapter, setAdapter] = useState<DetectorAdapter | null>(null);
  const [stabilityState, setStabilityState] = useState<StabilityState>({ kind: 'seeking' });
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [showLowLightWarning, setShowLowLightWarning] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [detectionAvailable, setDetectionAvailable] = useState(true);
  const capturingRef = useRef(false);

  // Tolerance is set proportional to video width once metadata loads.
  // Default ~40px is roughly 2% of a 1920px-wide frame (handheld camera jitter).
  const trackerRef = useRef(createStabilityTracker({ bufferSize: 10, toleranceLInf: 40 }));
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  // Timestamp of last valid quad detection — used to decide if capture had a doc in frame
  const lastValidQuadAtRef = useRef<number>(0);

  // PRD-60: Lock timeout tracker for low-contrast / can't-lock hint (3.5s threshold)
  const lockTimeoutRef = useRef(createLockTimeoutTracker({ thresholdMs: 3500 }));
  const [showContrastHint, setShowContrastHint] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    const tryPlay = () => {
      v.play().catch(() => { /* ignore */ });
    };
    if (v.readyState >= 1) {
      tryPlay();
    } else {
      v.addEventListener('loadedmetadata', tryPlay, { once: true });
    }
  }, [stream]);

  // Load detector adapter on mount
  useEffect(() => {
    let mounted = true;
    ensureScanicLoaded()
      .then((loadedAdapter: DetectorAdapter) => {
        if (mounted) setAdapter(loadedAdapter);
      })
      .catch((err: Error) => {
        if (!mounted) return;
        setDetectionAvailable(false);
        console.warn('[LivePreviewStage] detector load failed; manual capture only', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Start detection loop when both adapter and video are ready
  useEffect(() => {
    if (!adapter || !videoReady) return;

    let autoCaptured = false;

    const stopLoop = startDetectionLoop({
      videoRef,
      adapter,
      targetFps: 8,
      onLowLight: (isLowLight) => {
        setShowLowLightWarning(isLowLight);
      },
      onQuad: (detectedQuad) => {
        setQuad(detectedQuad);
        if (detectedQuad) {
          lastValidQuadAtRef.current = Date.now();
        }
        const state = trackerRef.current.push(detectedQuad);
        setStabilityState(state);

        // PRD-60: Update lock timeout tracker based on seeking state
        const isLocked = state.kind !== 'seeking';
        const shouldShowHint = lockTimeoutRef.current.update(isLocked, Date.now());
        setShowContrastHint(shouldShowHint);

        if (detectedQuad === null) {
          setOverlayColor('amber');
        } else if (state.kind === 'armed') {
          setOverlayColor('green');
        } else {
          setOverlayColor('amber');
        }

        if (state.kind === 'armed' && !autoCaptured) {
          autoCaptured = true;
          setTimeout(() => {
            performCapture();
          }, 100);
        }
      },
    });

    return () => {
      stopLoop();
    };
  }, [adapter, videoReady]);

  // PRD-60: Lock timeout tracker handles the timing internally via update() calls
  // No polling effect needed — the tracker is driven by onQuad callbacks

  const handleCancel = useCallback(() => {
    streamRef.current.getTracks().forEach((track) => track.stop());
    onCancel();
  }, [onCancel]);

  const performCapture = useCallback(() => {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setTimeout(() => performCapture(), 100);
      return;
    }
    capturingRef.current = true;
    setTooltipDismissed(true);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      capturingRef.current = false;
      return;
    }

    ctx.drawImage(video, 0, 0);

    // documentDetected: true if we saw a valid quad in the last 1.5s
    const documentDetected = Date.now() - lastValidQuadAtRef.current < 1500;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          captureRef.current(blob, { documentDetected });
        } else {
          capturingRef.current = false;
        }
      },
      'image/jpeg',
      0.92
    );
  }, []);

  const t = translations[language];

  const overlay = (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {showLowLightWarning && (
        <div className="absolute top-4 left-4 right-4 z-40 bg-amber-100/95 border border-amber-300 px-4 py-2 rounded-none">
          <p className="text-sm text-amber-800 text-center">{t.lowLightWarning}</p>
        </div>
      )}

      {!detectionAvailable && (
        <div className="absolute top-16 left-4 right-4 z-40 bg-black/70 px-4 py-2 rounded-none">
          <p className="text-sm text-white/90 text-center">Auto-detect unavailable — tap Capture</p>
        </div>
      )}

      {/* PRD-60: Transparent, non-blocking contrast hint — positioned clear of bottom controls */}
      {showContrastHint && !showLowLightWarning && detectionAvailable && (
        <div className="absolute top-4 left-4 right-4 z-40 bg-black/55 px-4 py-2 pointer-events-none">
          <p className="text-sm text-white/90 text-center leading-snug">{t.stuckHint}</p>
          <p className="text-xs text-white/70 text-center mt-1 leading-snug">{t.stuckHintSecondary}</p>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => setVideoReady(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 z-20">
        <QuadOverlay videoRef={videoRef} quad={quad} color={overlayColor} />
      </div>

      {!tooltipDismissed && (
        <FirstScanTooltip
          language={language}
          onDismiss={() => setTooltipDismissed(true)}
        />
      )}

      <div
        className="absolute left-0 right-0 bottom-0 z-40 p-4 space-y-3"
        style={{
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
        }}
      >
        <button
          type="button"
          onClick={performCapture}
          className="w-full min-h-12 h-auto py-3 bg-[var(--primary)]/90 text-white px-4 rounded-none text-base font-medium border border-white/30 hover:bg-[var(--primary)] transition-colors duration-200"
        >
          {t.captureNow}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="w-full min-h-12 h-auto py-3 bg-transparent text-white px-4 rounded-none text-sm font-medium border border-white/50 hover:bg-white/10 transition-colors duration-200"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(overlay, document.body);
}
