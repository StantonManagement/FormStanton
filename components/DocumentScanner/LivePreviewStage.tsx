'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScannerLanguage, translations } from './translations';
import FirstScanTooltip from './FirstScanTooltip';
import QuadOverlay from './QuadOverlay';
import { startDetectionLoop, type Quad } from './edgeDetectionLoop';
import { createStabilityTracker, type StabilityState } from './stabilityTracker';

interface LivePreviewStageProps {
  stream: MediaStream;
  language: ScannerLanguage;
  onCancel: () => void;
  onCapture: (blob: Blob) => void;
}

async function ensureOpenCvLoaded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { cv?: unknown }).cv) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-opencv="true"]') as HTMLScriptElement | null;
    if (existing && (window as unknown as { cv?: unknown }).cv) {
      resolve();
      return;
    }
    const script = existing ?? document.createElement('script');
    script.async = true;
    script.defer = true;
    script.setAttribute('data-opencv', 'true');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.onload = () => {
      const cv = (window as unknown as { cv?: { onRuntimeInitialized?: () => void } }).cv;
      if (cv?.onRuntimeInitialized) {
        const original = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          original();
          resolve();
        };
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error('OpenCV failed to load'));
    if (!existing) document.body.appendChild(script);
  });
}

async function ensureJscanifyLoaded(): Promise<unknown> {
  if (typeof window !== 'undefined') {
    const cached = (window as unknown as { __jscanifyInstance?: unknown }).__jscanifyInstance;
    if (cached) return cached;
  }
  await ensureOpenCvLoaded();
  const mod = await import('jscanify/client');
  const Jscanify = (mod as { default?: unknown }).default ?? mod;
  const Ctor = Jscanify as new () => unknown;
  const instance = new Ctor();
  if (typeof window !== 'undefined') {
    (window as unknown as { __jscanifyInstance?: unknown }).__jscanifyInstance = instance;
  }
  return instance;
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
  const [jscanifyInstance, setJscanifyInstance] = useState<unknown>(null);
  const [stabilityState, setStabilityState] = useState<StabilityState>({ kind: 'seeking' });
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [showLowLightWarning, setShowLowLightWarning] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [detectionAvailable, setDetectionAvailable] = useState(true);
  const capturingRef = useRef(false);

  const trackerRef = useRef(createStabilityTracker({ bufferSize: 12, toleranceLInf: 12 }));
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

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

  // Load jscanify on mount
  useEffect(() => {
    let mounted = true;
    ensureJscanifyLoaded()
      .then((instance) => {
        if (mounted) setJscanifyInstance(instance);
      })
      .catch((err) => {
        if (!mounted) return;
        setDetectionAvailable(false);
        console.warn('[LivePreviewStage] jscanify load failed; manual capture only', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Start detection loop when both jscanify and video are ready
  useEffect(() => {
    if (!jscanifyInstance || !videoReady) return;

    let autoCaptured = false;

    const stopLoop = startDetectionLoop({
      videoRef,
      jscanify: jscanifyInstance,
      targetFps: 8,
      onLowLight: (isLowLight) => {
        setShowLowLightWarning(isLowLight);
      },
      onQuad: (detectedQuad) => {
        setQuad(detectedQuad);
        const state = trackerRef.current.push(detectedQuad);
        setStabilityState(state);

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
  }, [jscanifyInstance, videoReady]);

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

    canvas.toBlob(
      (blob) => {
        if (blob) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          captureRef.current(blob);
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
          <p className="text-sm text-white/90 text-center">{t.manualOnly || 'Auto-detect unavailable — tap Capture'}</p>
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
