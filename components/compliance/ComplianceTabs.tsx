'use client';

import { useState } from 'react';

export type ComplianceTab = 'tenants' | 'duplicates' | 'missing';

interface ComplianceTabsProps {
  activeTab: ComplianceTab;
  onTabChange: (tab: ComplianceTab) => void;
  actionCount: number;
  missingCount: number;
  duplicateCount: number;
}

export default function ComplianceTabs({ activeTab, onTabChange, actionCount, missingCount, duplicateCount }: ComplianceTabsProps) {
  const tabs: Array<{ id: ComplianceTab; label: string; badge?: number }> = [
    { id: 'tenants', label: 'Tenants', badge: actionCount > 0 ? actionCount : undefined },
    { id: 'duplicates', label: 'Duplicates', badge: duplicateCount > 0 ? duplicateCount : undefined },
    { id: 'missing', label: 'Missing', badge: missingCount > 0 ? missingCount : undefined },
  ];

  return (
    <div className="flex border-b border-[var(--divider)]">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors duration-200 ease-out ${
              isActive
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--divider)]'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold ${
                tab.id === 'missing' || tab.id === 'duplicates'
                  ? (isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--error)]/10 text-[var(--error)]')
                  : (isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--warning)]/10 text-[var(--warning)]')
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
