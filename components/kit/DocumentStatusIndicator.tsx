'use client';

interface DocumentStatusIndicatorProps {
  hasEvidence: boolean;
  className?: string;
}

/**
 * Visual indicator for document evidence availability.
 * Shows filled icon when evidence exists, muted/outline when missing.
 */
export default function DocumentStatusIndicator({
  hasEvidence,
  className = '',
}: DocumentStatusIndicatorProps) {
  if (hasEvidence) {
    return (
      <svg
        className={`w-4 h-4 text-[var(--primary)] ${className}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <title>Has document evidence</title>
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      className={`w-4 h-4 text-[var(--muted)] opacity-50 ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <title>No document evidence</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
