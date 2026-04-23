'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  AlertCircle,
  Send,
  FolderKanban,
  DoorOpen,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '@/components/admin/PageHeader';
import { ProjectStatusBadge } from '@/components/projects';
import type { ProjectStatus } from '@/types/compliance';

interface HomeSummary {
  submissions: {
    pending_review: number;
    revision_requested: number;
    approved_unsent: number;
  };
  projects: {
    active_count: number;
    draft_count: number;
    active: Array<{ id: string; name: string; deadline: string | null; status: ProjectStatus }>;
  };
  lobby: {
    pickups_today: number;
    tow_flagged: number;
  };
}

export default function AdminHomePage() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/admin/home-summary');
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          setError(json.message || 'Failed to load summary');
        } else {
          setSummary(json.data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeader
        title="Admin Home"
        subtitle="Overview of today's activity and pending work"
        breadcrumbs={[{ label: 'Home' }]}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            href="/admin/form-submissions?view=needs_action"
            icon={AlertCircle}
            label="Needs Review"
            value={
              loading
                ? null
                : (summary?.submissions.pending_review ?? 0) +
                  (summary?.submissions.revision_requested ?? 0)
            }
            sublabel="Form submissions awaiting action"
            tone="warning"
          />
          <StatCard
            href="/admin/form-submissions?view=ready_for_appfolio"
            icon={Send}
            label="Ready for AppFolio"
            value={loading ? null : summary?.submissions.approved_unsent ?? 0}
            sublabel="Approved, not yet sent"
            tone="default"
          />
          <StatCard
            href="/admin/projects"
            icon={FolderKanban}
            label="Active Projects"
            value={loading ? null : summary?.projects.active_count ?? 0}
            sublabel={
              summary?.projects.draft_count
                ? `${summary.projects.draft_count} draft${summary.projects.draft_count === 1 ? '' : 's'}`
                : 'No drafts'
            }
            tone="default"
          />
          <StatCard
            href="/admin/tow-list"
            icon={AlertTriangle}
            label="Tow Flagged"
            value={loading ? null : summary?.lobby.tow_flagged ?? 0}
            sublabel="Vehicles flagged for tow"
            tone={summary?.lobby.tow_flagged ? 'error' : 'default'}
          />
        </section>

        {/* Two-column: Active projects + Quick actions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active projects */}
          <div className="lg:col-span-2 bg-white border border-[var(--border)]">
            <div className="px-5 py-3 border-b border-[var(--divider)] flex items-center justify-between">
              <h2 className="font-serif text-lg text-[var(--primary)]">Active Projects</h2>
              <Link
                href="/admin/projects"
                className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-[var(--muted)]">Loading...</div>
            ) : summary?.projects.active.length ? (
              <ul className="divide-y divide-[var(--divider)]">
                {summary.projects.active.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-section)] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-medium text-[var(--ink)] truncate">
                          {p.name}
                        </span>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {p.deadline && (
                          <span className="text-xs text-[var(--muted)]">
                            Due {p.deadline}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-[var(--muted)]" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-[var(--muted)]">
                No active projects.{' '}
                <Link href="/admin/projects" className="text-[var(--primary)] hover:underline">
                  Create one
                </Link>
                .
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-[var(--border)]">
            <div className="px-5 py-3 border-b border-[var(--divider)]">
              <h2 className="font-serif text-lg text-[var(--primary)]">Quick Actions</h2>
            </div>
            <ul className="divide-y divide-[var(--divider)]">
              <QuickAction
                href="/admin/lobby"
                icon={DoorOpen}
                label="Open Lobby"
                sublabel={
                  summary?.lobby.pickups_today
                    ? `${summary.lobby.pickups_today} pickup${summary.lobby.pickups_today === 1 ? '' : 's'} today`
                    : 'Permit distribution'
                }
              />
              <QuickAction
                href="/admin/compliance"
                icon={FileText}
                label="All Buildings"
                sublabel="Legacy compliance dashboard"
              />
              <QuickAction
                href="/admin/form-submissions"
                icon={FileText}
                label="Form Submissions"
                sublabel="Review incoming forms"
              />
              <QuickAction
                href="/admin/appfolio-queue"
                icon={Send}
                label="AppFolio Queue"
                sublabel="Pending uploads"
              />
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  value: number | null;
  sublabel: string;
  tone: 'default' | 'warning' | 'error';
}) {
  const toneClasses =
    tone === 'error'
      ? 'text-[var(--error)]'
      : tone === 'warning'
      ? 'text-[var(--warning)]'
      : 'text-[var(--ink)]';

  return (
    <Link
      href={href}
      className="block bg-white border border-[var(--border)] p-5 hover:bg-[var(--bg-section)] transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
            {label}
          </div>
          <div className={`mt-2 text-3xl font-serif ${toneClasses}`}>
            {value === null ? <span className="text-[var(--muted)]">—</span> : value}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">{sublabel}</div>
        </div>
        <Icon className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--ink)] transition-colors" />
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  sublabel,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  sublabel: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-section)] transition-colors"
      >
        <Icon className="w-5 h-5 text-[var(--muted)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--ink)]">{label}</div>
          <div className="text-xs text-[var(--muted)] truncate">{sublabel}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
      </Link>
    </li>
  );
}
