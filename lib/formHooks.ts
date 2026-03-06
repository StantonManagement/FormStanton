/**
 * Form Hooks
 * Custom React hooks for common form patterns
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing multi-section form navigation
 */
export function useFormSection(totalSections: number) {
  const [currentSection, setCurrentSection] = useState(1);
  const [completedSections, setCompletedSections] = useState<number[]>([]);

  const goToSection = useCallback((section: number) => {
    if (section >= 1 && section <= totalSections) {
      setCurrentSection(section);
    }
  }, [totalSections]);

  const nextSection = useCallback(() => {
    if (currentSection < totalSections) {
      setCompletedSections(prev => 
        prev.includes(currentSection) ? prev : [...prev, currentSection]
      );
      setCurrentSection(prev => prev + 1);
    }
  }, [currentSection, totalSections]);

  const previousSection = useCallback(() => {
    if (currentSection > 1) {
      setCurrentSection(prev => prev - 1);
    }
  }, [currentSection]);

  const markSectionComplete = useCallback((section: number) => {
    setCompletedSections(prev => 
      prev.includes(section) ? prev : [...prev, section]
    );
  }, []);

  const isSectionComplete = useCallback((section: number) => {
    return completedSections.includes(section);
  }, [completedSections]);

  return {
    currentSection,
    completedSections,
    goToSection,
    nextSection,
    previousSection,
    markSectionComplete,
    isSectionComplete,
    isFirstSection: currentSection === 1,
    isLastSection: currentSection === totalSections,
  };
}

/**
 * Hook for managing form submission state
 */
export function useFormSubmit<T = any>(
  submitHandler: (data: T) => Promise<void>
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const submit = useCallback(async (data: T) => {
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      await submitHandler(data);
      setSubmitSuccess(true);
    } catch (error: any) {
      setSubmitError(error.message || 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  }, [submitHandler]);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setSubmitError('');
    setSubmitSuccess(false);
  }, []);

  return {
    submit,
    isSubmitting,
    submitError,
    submitSuccess,
    reset,
  };
}

/**
 * Hook for managing field validation
 */
export function useFieldValidation<T extends Record<string, any>>(
  initialErrors: Partial<Record<keyof T, string>> = {}
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>(initialErrors);

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = Object.keys(errors).length > 0;
  const getFieldError = useCallback((field: keyof T) => errors[field], [errors]);

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasErrors,
    getFieldError,
  };
}

/**
 * Hook for managing form data state
 */
export function useFormData<T extends Record<string, any>>(initialData: T) {
  const [formData, setFormData] = useState<T>(initialData);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialData);
  }, [initialData]);

  const getFieldValue = useCallback(<K extends keyof T>(field: K): T[K] => {
    return formData[field];
  }, [formData]);

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    getFieldValue,
  };
}

/**
 * Hook for managing file uploads
 */
export function useFileUpload(maxFiles: number = 5) {
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    setFiles(prev => {
      const combined = [...prev, ...fileArray];
      return combined.slice(0, maxFiles);
    });
  }, [maxFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const canAddMore = files.length < maxFiles;
  const remainingSlots = maxFiles - files.length;

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    canAddMore,
    remainingSlots,
    fileCount: files.length,
  };
}
