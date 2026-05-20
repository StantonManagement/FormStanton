'use client';

import { useState, useEffect, useCallback } from 'react';
import MyWork from './MyWork';
import TeamRollup from './TeamRollup';

interface UserPermissions {
  canViewTeamRollup: boolean;
}

export default function WorkPage() {
  const [activeTab, setActiveTab] = useState<'my-work' | 'team-rollup'>('my-work');
  const [userPerms, setUserPerms] = useState<UserPermissions>({ canViewTeamRollup: false });
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dateRange, setDateRange] = useState<'week' | 'month'>('week');

  // Fetch user permissions
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await fetch('/api/admin/me/permissions');
        const json = await res.json();
        if (json.success) {
          const hasRollupPerm = json.data.permissions?.some(
            (p: { resource: string; action: string }) =>
              p.resource === 'pbv-full-applications' && p.action === 'view_team_rollup'
          );
          setUserPerms({ canViewTeamRollup: hasRollupPerm || json.data.isSuperAdmin });
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      } finally {
        setLoadingPerms(false);
      }
    };

    fetchPerms();
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // If user loses permission while on team-rollup tab, switch back to my-work
  useEffect(() => {
    if (activeTab === 'team-rollup' && !userPerms.canViewTeamRollup && !loadingPerms) {
      setActiveTab('my-work');
    }
  }, [activeTab, userPerms.canViewTeamRollup, loadingPerms]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">Work</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Personal queue and team workload distribution
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range picker (only affects Team Rollup) */}
          {activeTab === 'team-rollup' && (
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'week' | 'month')}
              className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm bg-white"
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          )}
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 text-sm border border-[var(--border)] hover:bg-[var(--bg-section)] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--divider)] mb-6">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('my-work')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'my-work'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            My Work
          </button>
          {userPerms.canViewTeamRollup && (
            <button
              type="button"
              onClick={() => setActiveTab('team-rollup')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'team-rollup'
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Team Rollup
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'my-work' && <MyWork refreshTrigger={refreshTrigger} />}
      {activeTab === 'team-rollup' && userPerms.canViewTeamRollup && (
        <TeamRollup refreshTrigger={refreshTrigger} range={dateRange} />
      )}
    </div>
  );
}
