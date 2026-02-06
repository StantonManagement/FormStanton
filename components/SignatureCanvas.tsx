'use client';

import { useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureCanvasComponentProps {
  onSave: (dataUrl: string) => void;
  label: string;
  value?: string;
}

export default function SignatureCanvasComponent({ onSave, label, value }: SignatureCanvasComponentProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onSave('');
  };

  const save = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  // Restore signature when component mounts or value changes
  useEffect(() => {
    if (value && sigCanvas.current) {
      sigCanvas.current.fromDataURL(value);
    }
  }, [value]);

  useEffect(() => {
    const canvas = sigCanvas.current;
    if (canvas) {
      const handleEnd = () => {
        save();
      };
      const canvasElement = canvas.getCanvas();
      canvasElement.addEventListener('mouseup', handleEnd);
      canvasElement.addEventListener('touchend', handleEnd);

      return () => {
        canvasElement.removeEventListener('mouseup', handleEnd);
        canvasElement.removeEventListener('touchend', handleEnd);
      };
    }
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white signature-canvas-container">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: 'w-full h-48 sm:h-40',
            style: { width: '100%', height: '192px', touchAction: 'none' }
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
