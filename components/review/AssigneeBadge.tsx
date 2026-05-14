'use client';

import { useState, useEffect, useCallback } from 'react';

interface AssigneeInfo {
  id: string;
  display_name: string;
  initials: string;
}

interface AssigneeBadgeProps {
  userId: string | null;
  assignedAt?: string | null;
  onClick?: () => void;
  showUnassigned?: boolean;
}

export default function AssigneeBadge({
  userId,
  assignedAt,
  onClick,
  showUnassigned = true,
}: AssigneeBadgeProps) {
  const [userInfo, setUserInfo] = useState<AssigneeInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fetchUserInfo = useCallback(async () => {
    if (!userId) {
      setUserInfo(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const name = json.data.display_name ?? 'Unknown';
        setUserInfo({
          id: userId,
          display_name: name,
          initials: getInitials(name),
        });
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  if (!userId) {
    if (!showUnassigned) return null;
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
      >
        <span className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[10px]">
          +
        </span>
        <span>Assign</span>
      </button>
    );
  }

  if (loading || !userInfo) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
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
      className="inline-flex items-center gap-1.5 text-xs group"
      title={`${userInfo.display_name}${formattedDate ? ` — assigned ${formattedDate}` : ''}`}
    >
      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-semibold group-hover:bg-blue-200 transition-colors">
        {userInfo.initials}
      </span>
      <span className="text-[var(--muted)] group-hover:text-[var(--ink)] transition-colors max-w-24 truncate">
        {userInfo.display_name}
      </span>
    </button>
  );
}
