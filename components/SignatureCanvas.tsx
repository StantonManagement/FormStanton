'use client';

import { useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureCanvasComponentProps {
  onSave: (dataUrl: string) => void;
  label: string;
  value?: string;
  /** Element id for the wrapping group, used by aria-labelledby on the wrapper. */
  id?: string;
}

/**
 * PRP-006 / mobile §4.2: react-signature-canvas does not scale the backing
 * store by `devicePixelRatio`, so strokes look blurry on Retina/iOS. We
 * observe the wrapper size + the DPR and re-size the canvas backing store
 * to match, preserving the current stroke by round-tripping toDataURL/
 * fromDataURL. The CSS size remains fluid (100% width, ~25vh height) so
 * orientation changes do not distort.
 */
export default function SignatureCanvasComponent({ onSave, label, value, id }: SignatureCanvasComponentProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const errorId = `${id ?? 'signature'}-error`;

  const clear = () => {
    sigRef.current?.clear();
    onSave('');
  };

  const save = () => {
    const sig = sigRef.current;
    if (sig && !sig.isEmpty()) {
      onSave(sig.toDataURL('image/png'));
    }
  };

  // Restore signature when component mounts or `value` changes.
  useEffect(() => {
    if (value && sigRef.current) {
      sigRef.current.fromDataURL(value);
    }
  }, [value]);

  // Mouse/touch end → push the current data URL up.
  useEffect(() => {
    const sig = sigRef.current;
    if (!sig) return;
    const canvasEl = sig.getCanvas();
    const onEnd = () => save();
    canvasEl.addEventListener('mouseup', onEnd);
    canvasEl.addEventListener('touchend', onEnd);
    return () => {
      canvasEl.removeEventListener('mouseup', onEnd);
      canvasEl.removeEventListener('touchend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DPR + container resize. Re-size backing store, preserve stroke.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const sig = sigRef.current;
    if (!wrapper || !sig) return;

    const resize = () => {
      const canvasEl = sig.getCanvas();
      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rect.width));
      const targetH = Math.max(1, Math.floor(rect.height));
      // Only resize when the CSS size or DPR changed; otherwise we'd clear
      // the canvas on every observer tick.
      if (canvasEl.width === targetW * dpr && canvasEl.height === targetH * dpr) return;

      const preserved = !sig.isEmpty() ? sig.toDataURL('image/png') : null;
      canvasEl.width = targetW * dpr;
      canvasEl.height = targetH * dpr;
      canvasEl.style.width = `${targetW}px`;
      canvasEl.style.height = `${targetH}px`;
      const ctx = canvasEl.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (preserved) {
        sig.fromDataURL(preserved);
      } else {
        sig.clear();
      }
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrapper);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700" id={`${id ?? 'signature'}-label`}>
        {label}
      </label>
      <div
        ref={wrapperRef}
        className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white signature-canvas-container"
        role="img"
        aria-labelledby={`${id ?? 'signature'}-label`}
        aria-describedby={errorId}
      >
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            className: 'w-full h-48 sm:h-40',
            style: { width: '100%', height: '192px', touchAction: 'none' },
          }}
          backgroundColor="white"
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-sm sm:text-base text-blue-600 hover:text-blue-800 font-medium py-2"
      >
        Clear Signature
      </button>
    </div>
  );
}
