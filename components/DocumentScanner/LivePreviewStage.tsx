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
  // jscanify exports a class; the detection loop needs an INSTANCE so prototype
  // methods (findPaperContour, getCornerPoints) are callable. Passing the class
  // itself trips Safari/iOS's "class constructor without |new|" error as soon
  // as React internals try to invoke it. Cache the instance under a dedicated
  // window key so we don't collide with DocumentScanner.tsx which caches the
  // class under window.jscanify for new-call use inside processImageBlob.
  if (typeof window !== 'undefined') {
    const cached = (window as unknown as { __jscanifyInstance?: unknown }).__jscanifyInstance;
    if (cached) return cached;
  }
  // jscanify's constructor depends on the global cv (OpenCV). Load it first.
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Create stability tracker (stable ref)
  const trackerRef = useRef(createStabilityTracker({ bufferSize: 12, toleranceLInf: 12 }));

  // Stable capture function ref to avoid dependency issues
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  // Load jscanify on mount
  useEffect(() => {
    let mounted = true;
    ensureJscanifyLoaded()
      .then((instance) => {
        if (mounted) setJscanifyInstance(instance);
      })
      .catch((err) => {
        // If OpenCV/jscanify can't load, the live preview gracefully degrades
        // to a blank video feed with manual capture only. Don't crash the tree.
        // eslint-disable-next-line no-console
        console.warn('[LivePreviewStage] jscanify load failed; manual capture only', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Start detection loop when jscanify is ready
  useEffect(() => {
    if (!jscanifyInstance || !videoRef.current) return;

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

        // Push to stability tracker
        const state = trackerRef.current.push(detectedQuad);
        setStabilityState(state);

        // Update overlay color based on stability
        if (detectedQuad === null) {
          // No overlay when seeking
          setOverlayColor('amber');
        } else if (state.kind === 'armed') {
          setOverlayColor('green');
        } else {
          // unstable, warming -> amber
          setOverlayColor('amber');
        }

        // Auto-capture when armed (stable for buffer duration)
        if (state.kind === 'armed' && !autoCaptured) {
          autoCaptured = true;
          // Small delay to let the green overlay render briefly
          setTimeout(() => {
            performCapture();
          }, 100);
        }
      },
    });

    return () => {
      stopLoop();
    };
  }, [jscanifyInstance]);

  // Attach stream to video element when it mounts
  const handleVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      // Store in ref so performCapture can access it
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
      if (node) {
        node.srcObject = streamRef.current;
      }
    },
    []
  );

  const handleCancel = useCallback(() => {
    // Stop all tracks to release camera
    streamRef.current.getTracks().forEach((track) => track.stop());
    onCancel();
  }, [onCancel]);

  const performCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Dismiss tooltip on capture
    setTooltipDismissed(true);

    // Create canvas at native video resolution
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Stop camera
          streamRef.current.getTracks().forEach((track) => track.stop());
          // Use ref to get current onCapture
          captureRef.current(blob);
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
      {/* Low-light warning toast */}
      {showLowLightWarning && (
        <div className="absolute top-4 left-4 right-4 z-40 bg-amber-100/95 border border-amber-300 px-4 py-2 rounded-none">
          <p className="text-sm text-amber-800 text-center">{t.lowLightWarning}</p>
        </div>
      )}

      {/* Video fills entire viewport */}
      <video
        ref={handleVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Quad overlay - needs positioned container matching video */}
      <div className="absolute inset-0 z-20">
        <QuadOverlay videoRef={videoRef} quad={quad} color={overlayColor} />
      </div>

      {/* Tooltip overlay */}
      {!tooltipDismissed && (
        <FirstScanTooltip
          language={language}
          onDismiss={() => setTooltipDismissed(true)}
        />
      )}

      {/* Floating controls at bottom with translucent gradient */}
      <div
        className="absolute left-0 right-0 bottom-0 z-40 p-4 space-y-3"
        style={{
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)',
        }}
      >
        {/* Manual capture button */}
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

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(overlay, document.body);
}
