'use client';

import { useState, useEffect, useCallback } from 'react';

interface LeadInfo {
  id: string;
  display_name: string;
  initials: string;
}

interface LeadBadgeProps {
  userId: string | null;
  assignedAt?: string | null;
  onClick?: () => void;
}

export default function LeadBadge({
  userId,
  assignedAt,
  onClick,
}: LeadBadgeProps) {
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fetchLeadInfo = useCallback(async () => {
    if (!userId) {
      setLeadInfo(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const name = json.data.display_name ?? 'Unknown';
        setLeadInfo({
          id: userId,
          display_name: name,
          initials: getInitials(name),
        });
      }
    } catch (error) {
      console.error('Failed to fetch lead info:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLeadInfo();
  }, [fetchLeadInfo]);

  if (!userId) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
      >
        <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[10px]">
          +
        </span>
        <span>Assign Lead</span>
      </button>
    );
  }

  if (loading || !leadInfo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <span className="w-5 h-5 rounded-full bg-gray-200 animate-pulse"></span>
        <span>Loading...</span>
      </span>
    );
  }

  const formattedDate = assignedAt
    ? new Date(assignedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-xs group"
      title={`Lead: ${leadInfo.display_name}${formattedDate ? ` — assigned ${formattedDate}` : ''}`}
    >
      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-semibold group-hover:bg-purple-200 transition-colors">
        {leadInfo.initials}
      </span>
      <span className="text-[var(--ink)] font-medium">
        {leadInfo.display_name}
      </span>
      <span className="text-[var(--muted)]">(Lead)</span>
    </button>
  );
}
