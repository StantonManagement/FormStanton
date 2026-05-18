'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { ScannerLanguage } from './translations';
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

async function ensureJscanifyLoaded(): Promise<unknown> {
  if (typeof window !== 'undefined' && window.jscanify) {
    return window.jscanify;
  }

  const mod = await import('jscanify/client');
  const Jscanify = (mod as { default?: unknown }).default ?? mod;
  window.jscanify = Jscanify;
  return Jscanify;
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

  // Create stability tracker (stable ref)
  const trackerRef = useRef(createStabilityTracker({ bufferSize: 12, toleranceLInf: 12 }));

  // Stable capture function ref to avoid dependency issues
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  // Load jscanify on mount
  useEffect(() => {
    let mounted = true;
    ensureJscanifyLoaded().then((instance) => {
      if (mounted) {
        setJscanifyInstance(instance);
      }
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

  // Get translations for low light warning
  const t = {
    lowLightWarning: language === 'en'
      ? "It's dark — try moving to better light"
      : language === 'es'
      ? 'Está oscuro — intenta mejor luz'
      : 'Está escuro — tente melhor luz',
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Low-light warning toast */}
      {showLowLightWarning && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-amber-100 border border-amber-300 px-4 py-2 rounded-none">
          <p className="text-sm text-amber-800 text-center">{t.lowLightWarning}</p>
        </div>
      )}

      {/* Video container */}
      <div className="relative flex-1 bg-black min-h-[300px]">
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Quad overlay */}
        <QuadOverlay videoRef={videoRef} quad={quad} color={overlayColor} />
        {/* Tooltip overlay - dismiss on capture */}
        {!tooltipDismissed && (
          <FirstScanTooltip
            language={language}
            onDismiss={() => setTooltipDismissed(true)}
          />
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 bg-white">
        {/* Manual capture button */}
        <button
          type="button"
          onClick={performCapture}
          className="w-full min-h-[48px] bg-[var(--primary)] text-white px-4 py-3 rounded-none text-base font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
        >
          Capture now
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="w-full min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
