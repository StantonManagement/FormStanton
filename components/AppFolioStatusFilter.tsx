'use client';

interface AppFolioStatusFilterProps {
  value: 'all' | 'ready' | 'partial' | 'complete';
  onChange: (value: 'all' | 'ready' | 'partial' | 'complete') => void;
}

export default function AppFolioStatusFilter({ value, onChange }: AppFolioStatusFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-[var(--muted)]">
        AppFolio:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as any)}
        className="text-xs px-2 py-1 border border-[var(--border)] rounded-none bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out"
      >
        <option value="all">All</option>
        <option value="ready">Ready to Upload</option>
        <option value="partial">Partially Uploaded</option>
        <option value="complete">Complete</option>
      </select>
    </div>
  );
}
