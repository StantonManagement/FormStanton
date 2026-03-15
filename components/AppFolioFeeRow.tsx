'use client';

import { useState } from 'react';

interface AppFolioFeeRowProps {
  feeType: 'Pet Rent' | 'Permit Fee';
  feeAdded: boolean;
  amount?: number | null;
  addedAt?: string | null;
  addedBy?: string | null;
  onMarkAdded: (amount: number) => Promise<void>;
  disabled?: boolean;
}

export default function AppFolioFeeRow({
  feeType,
  feeAdded,
  amount,
  addedAt,
  addedBy,
  onMarkAdded,
  disabled = false
}: AppFolioFeeRowProps) {
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkAdded = async () => {
    const parsedAmount = parseFloat(feeAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await onMarkAdded(parsedAmount);
      setShowAmountInput(false);
      setFeeAmount('');
    } catch (error) {
      console.error('Failed to mark fee added:', error);
      alert('Failed to mark fee as added');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--divider)] last:border-b-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--ink)]">
          {feeType}
        </div>
        
        {feeAdded ? (
          <div className="flex items-center gap-2 text-xs text-[var(--success)] mt-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              ${amount?.toFixed(2)}/mo added to AppFolio
            </span>
            {addedBy && (
              <span className="text-[var(--muted)]">by {addedBy}</span>
            )}
            {addedAt && (
              <span 
                className="text-[var(--muted)]"
                title={new Date(addedAt).toLocaleString()}
              >
                on {new Date(addedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs text-[var(--muted)] mt-1">
            Not added to AppFolio
          </div>
        )}
      </div>

      {!feeAdded && !disabled && (
        <div className="flex-shrink-0">
          {!showAmountInput ? (
            <button
              onClick={() => setShowAmountInput(true)}
              className="text-xs px-3 py-1.5 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out whitespace-nowrap"
            >
              Mark Added
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <span className="text-sm text-[var(--ink)] mr-1">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-20 text-xs px-2 py-1 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                />
                <span className="text-xs text-[var(--muted)] ml-1">/mo</span>
              </div>
              <button
                onClick={handleMarkAdded}
                disabled={isSubmitting}
                className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Confirm'}
              </button>
              <button
                onClick={() => {
                  setShowAmountInput(false);
                  setFeeAmount('');
                }}
                disabled={isSubmitting}
                className="text-xs px-2 py-1 bg-white text-[var(--muted)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
