'use client';

import { useState, useRef, useEffect } from 'react';

interface FeeEntryPopoverProps {
  submissionId: string;
  feeType: 'pet_rent' | 'permit_fee';
  label: string;
  onSuccess: () => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
  tenantName?: string;
  unitNumber?: string;
  defaultAmount?: number | null;
}

export default function FeeEntryPopover({
  submissionId,
  feeType,
  label,
  onSuccess,
  onClose,
  anchorRect,
  tenantName,
  unitNumber,
  defaultAmount,
}: FeeEntryPopoverProps) {
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus + select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed < 0) {
      setError('Enter a valid amount (0 or more)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/compliance/mark-fee-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, feeType, amount: parsed }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to save');
        return;
      }
      onSuccess();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  // Position the popover near the anchor
  const style: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: Math.max(8, anchorRect.left - 40),
        zIndex: 60,
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 60 };

  return (
    <div ref={popoverRef} style={style} className="bg-white border border-[var(--border)] shadow-lg p-3 w-56">
      <div className="text-xs font-semibold text-[var(--primary)] mb-2">{label}</div>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-sm text-[var(--muted)]">$</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            placeholder="0.00"
            className="flex-1 min-w-0 px-2 py-1.5 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out"
          />
        </div>
        {error && <div className="text-xs text-[var(--error)] mb-2">{error}</div>}
        {amount && !error && tenantName && (
          <div className="text-[10px] text-[var(--muted)] mb-2 leading-snug">
            This will mark <span className="font-medium text-[var(--ink)]">{feeType === 'pet_rent' ? 'pet fee' : 'permit fee'} ${amount}</span> as loaded for <span className="font-medium text-[var(--ink)]">{tenantName}{unitNumber ? ` (Unit ${unitNumber})` : ''}</span>.
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-2 py-1.5 text-xs border border-[var(--border)] text-[var(--muted)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-2 py-1.5 text-xs bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Mark Loaded'}
          </button>
        </div>
      </form>
    </div>
  );
}
