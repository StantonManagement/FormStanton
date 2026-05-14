'use client';

import { useState, useCallback } from 'react';
import WorkloadByReviewer from './panels/WorkloadByReviewer';
import Bottlenecks from './panels/Bottlenecks';
import AppsWithoutLead from './panels/AppsWithoutLead';
import Tier2Backlog from './panels/Tier2Backlog';
import AtRisk from './panels/AtRisk';
import RecentOverrides from './panels/RecentOverrides';
import DocAgeDistribution from './panels/DocAgeDistribution';

interface TeamRollupProps {
  refreshTrigger?: number;
  range: 'week' | 'month' | 'custom';
}

export default function TeamRollup({ refreshTrigger, range }: TeamRollupProps) {
  return (
    <div className="space-y-6">
      {/* Header note about workload distribution framing */}
      <div className="bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Workload Distribution View</strong> — This rollup shows workload across the team
          to identify capacity imbalances and bottlenecks. It is not a performance management tool.
          Throughput counts are shown for capacity planning, not ranking.
        </p>
      </div>

      {/* Workload by Reviewer */}
      <WorkloadByReviewer refreshTrigger={refreshTrigger} range={range} />

      {/* Bottlenecks */}
      <Bottlenecks refreshTrigger={refreshTrigger} range={range} />

      {/* Apps Without Lead */}
      <AppsWithoutLead refreshTrigger={refreshTrigger} />

      {/* Tier-2 Backlog */}
      <Tier2Backlog refreshTrigger={refreshTrigger} />

      {/* At-Risk Applications */}
      <AtRisk refreshTrigger={refreshTrigger} />

      {/* Recent Overrides */}
      <RecentOverrides refreshTrigger={refreshTrigger} />

      {/* Doc Age Distribution */}
      <DocAgeDistribution refreshTrigger={refreshTrigger} />
    </div>
  );
}
