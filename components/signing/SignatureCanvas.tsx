'use client';

import { useRef, useState, useCallback } from 'react';
import SignaturePad from 'react-signature-canvas';

interface SignatureCanvasProps {
  onChange?: (dataUrl: string | null) => void;
  minStrokes?: number;
  width?: string;
  height?: string;
  label?: string;
  clearLabel?: string;
}

export default function SignatureCanvas({
  onChange,
  minStrokes = 10,
  width = '100%',
  height = '140px',
  label = 'Draw your signature',
  clearLabel = 'Clear',
}: SignatureCanvasProps) {
  const canvasRef = useRef<SignaturePad>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isValid, setIsValid] = useState(false);

  const handleEndStroke = useCallback(() => {
    setStrokeCount((prev) => {
      const newCount = prev + 1;
      const valid = newCount >= minStrokes;
      setIsValid(valid);
      
      if (canvasRef.current && valid) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onChange?.(dataUrl);
      }
      
      return newCount;
    });
  }, [minStrokes, onChange]);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setStrokeCount(0);
    setIsValid(false);
    onChange?.(null);
  }, [onChange]);

  const isEmpty = strokeCount === 0;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--ink)]">
        {label}
      </label>
      
      <div className="border border-[var(--border)] bg-white overflow-hidden">
        <SignaturePad
          ref={canvasRef}
          canvasProps={{
            className: 'w-full',
            style: { width, height, touchAction: 'none' },
          }}
          backgroundColor="white"
          onEnd={handleEndStroke}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline"
        >
          {clearLabel}
        </button>

        {!isEmpty && !isValid && (
          <span className="text-xs text-[var(--warning)]">
            Signature too short - please sign more clearly
          </span>
        )}

        {isValid && (
          <span className="text-xs text-green-600">Signature captured</span>
        )}
      </div>
    </div>
  );
}
