'use client';

interface SectionHeaderProps {
  title: string;
  sectionNumber?: number;
  totalSections?: number;
  subtitle?: string;
}

export default function SectionHeader({ title, sectionNumber, totalSections, subtitle }: SectionHeaderProps) {
  return (
    <div className="py-6 mb-6 border-b border-[var(--divider)]">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-[var(--primary)]">
          {title}
        </h2>
        
        {sectionNumber && totalSections && (
          <span className="text-sm text-[var(--muted)] font-medium">
            Section {sectionNumber} of {totalSections}
          </span>
        )}
      </div>
      
      {subtitle && (
        <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
      )}
    </div>
  );
}
