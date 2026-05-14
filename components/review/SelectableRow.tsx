'use client';

interface SelectableRowProps {
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  disabled?: boolean;
}

export default function SelectableRow({
  isSelected,
  onSelect,
  disabled = false,
}: SelectableRowProps) {
  return (
    <label className="inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelect(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 border border-[var(--border)] rounded-none focus:ring-0 focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
      />
    </label>
  );
}

interface SelectableHeaderProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function SelectableHeader({
  checked,
  indeterminate = false,
  onChange,
  label = 'Select all',
}: SelectableHeaderProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) {
            el.indeterminate = indeterminate;
          }
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 border border-[var(--border)] rounded-none focus:ring-0 focus:outline-none focus:border-[var(--primary)]"
      />
      {label && <span className="text-xs text-[var(--muted)]">{label}</span>}
    </label>
  );
}
