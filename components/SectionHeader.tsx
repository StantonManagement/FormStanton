'use client';

interface SectionHeaderProps {
  title: string;
  sectionNumber: number;
  totalSections: number;
}

export default function SectionHeader({ title, sectionNumber, totalSections }: SectionHeaderProps) {
  return (
    <div className="relative py-6 mb-6">
      {/* Decorative line */}
      <div className="absolute left-0 top-1/2 w-full h-px bg-[var(--divider)]" />
      
      {/* Header with background knockout */}
      <h2 className="relative inline-block bg-white pr-4 font-serif text-xl text-[var(--primary)]">
        {title}
      </h2>
      
      {/* Section number */}
      <span className="absolute right-0 top-1/2 -translate-y-1/2 bg-white pl-4 text-sm text-[var(--muted)] font-medium">
        Section {sectionNumber} of {totalSections}
      </span>
    </div>
  );
}
