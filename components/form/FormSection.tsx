'use client';

import { ReactNode } from 'react';

interface FormSectionProps {
  children: ReactNode;
  className?: string;
  background?: boolean;
}

export default function FormSection({
  children,
  className = '',
  background = false,
}: FormSectionProps) {
  return (
    <div
      className={`space-y-4 ${
        background ? 'bg-[var(--bg-section)] p-4 sm:p-6 rounded-sm border border-[var(--border)]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
