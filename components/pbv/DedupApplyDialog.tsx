'use client';

/**
 * components/pbv/DedupApplyDialog.tsx
 *
 * Post-upload dialog that suggests applying the same file to other compatible slots.
 * F1 of PRD-41.
 */

import { useState } from 'react';

interface CompatibleSlot {
  id: string;
  doc_type: string;
  label: string;
  category: string | null;
  person_slot: number | null;
}

interface DedupApplyDialogProps {
  isOpen: boolean;
  filename: string;
  compatibleSlots: CompatibleSlot[];
  language: 'en' | 'es' | 'pt';
  onClose: () => void;
  onApply: (selectedIds: string[]) => void;
}

const copy = {
  en: {
    title: 'This file fits other slots too',
    body: (filename: string) => `You uploaded "${filename}". The same file can satisfy these other required documents:`,
    applyButton: (count: number) => `Apply to ${count} selected`,
    noThanks: 'No thanks',
    checkboxLabel: (category: string, label: string) => `${category || 'Document'} — ${label}`,
  },
  es: {
    title: 'Este archivo también sirve para otros documentos',
    body: (filename: string) => `Subió "${filename}". El mismo archivo puede satisfacer estos otros documentos requeridos:`,
    applyButton: (count: number) => `Aplicar a ${count} seleccionados`,
    noThanks: 'No, gracias',
    checkboxLabel: (category: string, label: string) => `${category || 'Documento'} — ${label}`,
  },
  pt: {
    title: 'Este arquivo também serve para outros documentos',
    body: (filename: string) => `Você enviou "${filename}". O mesmo arquivo pode satisfazer estes outros documentos obrigatórios:`,
    applyButton: (count: number) => `Aplicar a ${count} selecionados`,
    noThanks: 'Não, obrigado',
    checkboxLabel: (category: string, label: string) => `${category || 'Documento'} — ${label}`,
  },
};

export default function DedupApplyDialog({
  isOpen,
  filename,
  compatibleSlots,
  language,
  onClose,
  onApply,
}: DedupApplyDialogProps) {
  const c = copy[language] ?? copy.en;
  
  // All slots checked by default
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(compatibleSlots.map((s) => s.id))
  );
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen || compatibleSlots.length === 0) return null;

  const toggleSlot = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) return;
    
    setIsApplying(true);
    try {
      await onApply(Array.from(selectedIds));
    } finally {
      setIsApplying(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md border border-[var(--border)] shadow-lg">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold font-serif text-[var(--primary)]">
            {c.title}
          </h3>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-[var(--body)] mb-4">
            {c.body(filename)}
          </p>

          {/* Checkbox list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {compatibleSlots.map((slot) => (
              <label
                key={slot.id}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(slot.id)}
                  onChange={() => toggleSlot(slot.id)}
                  className="mt-0.5 w-4 h-4 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--body)]">
                  {c.checkboxLabel(slot.category || '', slot.label)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--border)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--body)] transition-colors"
          >
            {c.noThanks}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedCount === 0 || isApplying}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isApplying ? '...' : c.applyButton(selectedCount)}
          </button>
        </div>
      </div>
    </div>
  );
}
