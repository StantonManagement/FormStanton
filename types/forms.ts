/**
 * Form Type Definitions
 * TypeScript types for standardized form components and patterns
 */

import { ReactNode } from 'react';
import { Language } from '@/lib/translations';

/**
 * Base form field props
 */
export interface BaseFieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Form section configuration
 */
export interface FormSectionConfig {
  id: number;
  label: string;
  title: string;
  component: ReactNode;
  validation?: (data: any) => boolean | string;
}

/**
 * Multi-section form props
 */
export interface MultiSectionFormProps {
  sections: FormSectionConfig[];
  onSubmit: (data: any) => Promise<void>;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  initialData?: any;
}

/**
 * Language landing props
 */
export interface LanguageLandingProps {
  title: string;
  subtitle?: string;
  description?: string;
  onSelect: (lang: Language) => void;
}

/**
 * Success screen props
 */
export interface SuccessScreenProps {
  title: string;
  message: string;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

/**
 * Form validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Form submission state
 */
export interface FormSubmissionState {
  isSubmitting: boolean;
  submitError: string;
  submitSuccess: boolean;
}

/**
 * Radio option type
 */
export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Select option type
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * File upload state
 */
export interface FileUploadState {
  files: File[];
  maxFiles: number;
  canAddMore: boolean;
}

/**
 * Form section navigation state
 */
export interface FormSectionState {
  currentSection: number;
  completedSections: number[];
  totalSections: number;
}

/**
 * Generic form data type
 */
export type FormData<T = Record<string, any>> = T;

/**
 * Form field error map
 */
export type FormErrors<T = Record<string, any>> = Partial<Record<keyof T, string>>;

/**
 * Form validation schema
 */
export type ValidationSchema<T = Record<string, any>> = {
  [K in keyof T]?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: T[K]) => boolean | string;
  };
};
