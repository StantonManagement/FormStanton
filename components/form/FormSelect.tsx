'use client';

import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children: ReactNode;
}

const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ error, className = '', children, ...props }, ref) => {
    return (
      <div className="relative mt-1">
        <select
          ref={ref}
          className={`block w-full appearance-none rounded-none border ${
            error ? 'border-[var(--error)]' : 'border-[var(--border)]'
          } bg-[var(--bg-input)] text-[var(--ink)] px-4 py-3 pr-10 text-base focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="h-5 w-5 text-[var(--muted)]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';

export default FormSelect;
