'use client';

import { InputHTMLAttributes } from 'react';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface FormRadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export default function FormRadioGroup({
  name,
  options,
  value,
  onChange,
  direction = 'vertical',
  className = '',
}: FormRadioGroupProps) {
  return (
    <div className={`mt-1 ${direction === 'horizontal' ? 'flex flex-wrap gap-3' : 'space-y-2'} ${className}`}>
      {options.map((option) => (
        <label key={option.value} className="flex items-start space-x-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)] focus:ring-2 focus:ring-offset-0 border-[var(--border)]"
          />
          <div className="flex-1">
            <span className="text-sm text-[var(--ink)]">{option.label}</span>
            {option.description && (
              <p className="text-xs text-[var(--muted)] mt-0.5">{option.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}
