'use client';

import { useState, forwardRef, useCallback } from 'react';

interface FormPhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  className?: string;
  disabled?: boolean;
}

function formatDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function extractDigits(input: string): string {
  return input.replace(/\D/g, '').slice(0, 10);
}

const FormPhoneInput = forwardRef<HTMLInputElement, FormPhoneInputProps>(
  ({ value, onChange, placeholder = '(860) 555-0123', required, error, errorMessage, className = '', disabled }, ref) => {
    const [touched, setTouched] = useState(false);

    const digits = extractDigits(value);
    const display = formatDisplay(digits);
    const isValid = digits.length === 10;
    const showError = touched && digits.length > 0 && !isValid;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = extractDigits(e.target.value);
      onChange(raw);
    }, [onChange]);

    const handleBlur = useCallback(() => {
      setTouched(true);
    }, []);

    const borderClass = (error || showError)
      ? 'border-[var(--error)]'
      : 'border-[var(--border)]';

    return (
      <div>
        <input
          ref={ref}
          type="tel"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`mt-1 block w-full px-4 py-3 border ${borderClass} rounded-none bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ${className}`}
        />
        {(showError || (error && errorMessage)) && (
          <p className="text-xs text-[var(--error)] mt-1">
            {errorMessage || 'Phone number must be exactly 10 digits'}
          </p>
        )}
      </div>
    );
  }
);

FormPhoneInput.displayName = 'FormPhoneInput';

export default FormPhoneInput;
