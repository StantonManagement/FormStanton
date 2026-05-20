'use client';

import { useState } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface ExecuteHapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (executionDate: string) => Promise<void>;
  hapSignature: {
    document_label: string;
    status: string;
    signed_pdf_path?: string | null;
  } | null;
  hasPermission: boolean;
}

export default function ExecuteHapDialog({
  isOpen,
  onClose,
  onExecute,
  hapSignature,
  hasPermission,
}: ExecuteHapDialogProps) {
  const [executionDate, setExecutionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canExecute = hasPermission &&
    hapSignature?.status === 'signed' &&
    hapSignature?.signed_pdf_path;

  const handleSubmit = async () => {
    if (!canExecute) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onExecute(executionDate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--ink)]">Execute HAP Contract</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Prerequisites Check */}
          <div className="mb-4 space-y-2">
            <div className={`flex items-center gap-2 text-sm ${
              hapSignature?.signed_pdf_path ? 'text-green-700' : 'text-red-600'
            }`}>
              {hapSignature?.signed_pdf_path ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>HAP contract signed by both parties</span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${
              hasPermission ? 'text-green-700' : 'text-red-600'
            }`}>
              {hasPermission ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>User has execute_hap permission</span>
            </div>
          </div>

          {!canExecute && (
            <div className="mb-4 bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">
                Cannot execute: HAP contract must be signed by both Stanton and HACH,
                and you must have execute_hap permission.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Date of Execution *
            </label>
            <input
              type="date"
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              This is a terminal action. After execution, the application stage
              will be set to &quot;executed&quot; and no further modifications will be allowed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] hover:bg-[var(--paper)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canExecute || isSubmitting}
            className="px-4 py-2 text-sm bg-purple-700 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Executing...' : 'Execute HAP Contract'}
          </button>
        </div>
      </div>
    </div>
  );
}
