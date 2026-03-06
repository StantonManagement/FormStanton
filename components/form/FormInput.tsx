'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`mt-1 block w-full px-4 py-3 border ${
          error ? 'border-[var(--error)]' : 'border-[var(--border)]'
        } rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ${className}`}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
