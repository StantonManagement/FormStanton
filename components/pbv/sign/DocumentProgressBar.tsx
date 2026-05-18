'use client';

/**
 * components/pbv/sign/DocumentProgressBar.tsx
 * Visual progress bar for document upload status on tenant dashboard.
 * F4 of PRD-41.
 */

interface DocumentProgressBarProps {
  uploaded: number;
  total: number;
  optionalUploaded?: number;
  language: 'en' | 'es' | 'pt';
}

const copy = {
  en: {
    label: (uploaded: number, total: number) => `${uploaded} of ${total} required documents uploaded`,
    optional: (n: number) => `+${n} optional uploaded`,
  },
  es: {
    label: (uploaded: number, total: number) => `${uploaded} de ${total} documentos requeridos subidos`,
    optional: (n: number) => `+${n} opcional subido`,
  },
  pt: {
    label: (uploaded: number, total: number) => `${uploaded} de ${total} documentos obrigatórios enviados`,
    optional: (n: number) => `+${n} opcional enviado`,
  },
};

export default function DocumentProgressBar({
  uploaded,
  total,
  optionalUploaded = 0,
  language,
}: DocumentProgressBarProps) {
  const c = copy[language] ?? copy.en;
  
  // Calculate percentage (capped at 100)
  const percentage = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;
  
  // Determine color based on completion
  let barColor = 'bg-gray-400'; // 0%
  if (percentage === 100) {
    barColor = 'bg-green-600'; // Complete
  } else if (percentage > 0) {
    barColor = 'bg-amber-500'; // In progress (1-99%)
  }

  return (
    <div className="w-full">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--ink)]">
          {c.label(uploaded, total)}
        </span>
        <span className="text-sm font-medium text-[var(--ink)]">
          {percentage}%
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-none overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={uploaded}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${uploaded} of ${total} documents uploaded`}
        />
      </div>
      
      {/* Optional count */}
      {optionalUploaded > 0 && (
        <p className="text-xs text-[var(--muted)] mt-1">
          {c.optional(optionalUploaded)}
        </p>
      )}
    </div>
  );
}
