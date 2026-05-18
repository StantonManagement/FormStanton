'use client';

import { useEffect, useState } from 'react';
import { ScannerLanguage } from './translations';

interface FirstScanTooltipProps {
  language: ScannerLanguage;
  onDismiss: () => void;
}

const tooltipText: Record<ScannerLanguage, string> = {
  en: 'Hold the document flat in the frame. We\'ll capture automatically when steady.',
  es: 'Mantén el documento plano en el marco. Capturaremos automáticamente cuando esté estable.',
  pt: 'Mantenha o documento plano no quadro. Capturaremos automaticamente quando estiver estável.',
};

export default function FirstScanTooltip({ language, onDismiss }: FirstScanTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if tooltip has been seen before
    const hasSeen = typeof window !== 'undefined' && localStorage.getItem('pbv_scanner_tooltip_seen') === '1';
    if (!hasSeen) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pbv_scanner_tooltip_seen', '1');
    }
    onDismiss();
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleDismiss}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 cursor-pointer"
    >
      <div className="bg-white/95 px-6 py-4 max-w-[280px] text-center rounded-none shadow-lg mx-4">
        <p className="text-sm text-[var(--ink)] leading-relaxed">
          {tooltipText[language]}
        </p>
      </div>
    </div>
  );
}
