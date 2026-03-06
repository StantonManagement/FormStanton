'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`mt-1 block w-full px-4 py-3 border ${
          error ? 'border-[var(--error)]' : 'border-[var(--border)]'
        } rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 resize-y ${className}`}
        {...props}
      />
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

export default FormTextarea;
