'use client';

import type { ProjectStatus } from '@/types/compliance';

const statusConfig: Record<ProjectStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700 border-gray-300' },
  active: { label: 'Active', classes: 'bg-blue-50 text-blue-700 border-blue-300' },
  closed: { label: 'Closed', classes: 'bg-green-50 text-green-700 border-green-300' },
};

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export default function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-none ${config.classes}`}>
      {config.label}
    </span>
  );
}
