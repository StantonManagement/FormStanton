'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

const FormCheckbox = forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, description, className = '', ...props }, ref) => {
    return (
      <label className={`flex items-start space-x-2 cursor-pointer ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="mt-1 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-2 focus:ring-offset-0"
          {...props}
        />
        <div className="flex-1">
          <span className="text-sm text-[var(--ink)]">{label}</span>
          {description && (
            <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
          )}
        </div>
      </label>
    );
  }
);

FormCheckbox.displayName = 'FormCheckbox';

export default FormCheckbox;
