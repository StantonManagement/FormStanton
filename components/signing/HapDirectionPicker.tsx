'use client';

interface HapDirectionPickerProps {
  currentDirection?: 'stanton_first' | 'hach_first' | null;
  onSelectDirection: (direction: 'stanton_first' | 'hach_first') => void;
  disabled?: boolean;
}

export default function HapDirectionPicker({
  currentDirection,
  onSelectDirection,
  disabled = false,
}: HapDirectionPickerProps) {
  // Once a direction is chosen, it can't be changed without resetting the signature
  const isDirectionChosen = !!currentDirection;

  if (isDirectionChosen) {
    return (
      <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4">
        <p className="text-sm text-[var(--ink)]">
          <span className="font-medium">HAP Initiation Path:</span>{' '}
          {currentDirection === 'stanton_first'
            ? 'Stanton signs first, then sends to HACH'
            : 'HACH sent first, Stanton countersigns'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 p-4">
      <p className="text-sm font-medium text-amber-900 mb-3">
        Choose HAP contract initiation path:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onSelectDirection('stanton_first')}
          disabled={disabled}
          className="p-3 text-left border border-amber-300 bg-white hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          <p className="font-medium text-sm text-amber-900">Stanton signs first</p>
          <p className="text-xs text-amber-700 mt-1">
            Stanton signs HAP, sends to HACH for countersignature
          </p>
        </button>
        <button
          onClick={() => onSelectDirection('hach_first')}
          disabled={disabled}
          className="p-3 text-left border border-amber-300 bg-white hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          <p className="font-medium text-sm text-amber-900">HACH sends first</p>
          <p className="text-xs text-amber-700 mt-1">
            HACH sends pre-signed HAP, Stanton countersigns
          </p>
        </button>
      </div>
    </div>
  );
}
