'use client';

import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}

export default function FormField({
  label,
  required = false,
  helperText,
  error,
  children,
  htmlFor,
}: FormFieldProps) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-sm font-medium text-[var(--ink)]">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
      </span>
      {children}
      {error && (
        <p className="text-xs text-[var(--error)] mt-1">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-xs text-[var(--muted)] mt-1">{helperText}</p>
      )}
    </label>
  );
}
