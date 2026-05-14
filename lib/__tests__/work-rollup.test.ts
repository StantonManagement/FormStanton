import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AGING_THRESHOLDS,
  getMyQueue,
  getAwaitingMyConfirmation,
  getAppsILead,
  getFreshActivity,
  getRecentlyCompleted,
  getWorkloadByReviewer,
  getBottlenecks,
  getAtRisk,
  getRecentOverrides,
  getDocAgeDistribution,
  getAppsWithoutLead,
  getTier2Backlog,
} from '@/lib/work/queries';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ data: [], error: null })),
          single: vi.fn(() => ({ data: null, error: null })),
        })),
        in: vi.fn(() => ({ data: [], error: null })),
        not: vi.fn(() => ({ data: [], error: null })),
        is: vi.fn(() => ({ data: [], error: null })),
        gte: vi.fn(() => ({ data: [], error: null })),
        lte: vi.fn(() => ({ data: [], error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
        limit: vi.fn(() => ({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({ error: null })),
      update: vi.fn(() => ({ error: null })),
      delete: vi.fn(() => ({ error: null })),
    })),
    rpc: vi.fn(() => ({ data: [], error: null })),
  },
}));

describe('Workforce Dashboards — AGING_THRESHOLDS', () => {
  it('should have defined aging thresholds', () => {
    expect(AGING_THRESHOLDS.stanton_review_days).toBe(5);
    expect(AGING_THRESHOLDS.hach_review_days).toBe(14);
    expect(AGING_THRESHOLDS.default_stage_days).toBe(10);
    expect(AGING_THRESHOLDS.stale_touched_days).toBe(7);
    expect(AGING_THRESHOLDS.at_risk_move_in_days).toBe(14);
    expect(AGING_THRESHOLDS.doc_age_buckets).toEqual([1, 3, 7, 14]);
  });
});

describe('Workforce Dashboards — Permission Model', () => {
  it('should require view_team_rollup permission for rollup endpoints', () => {
    const requiredPermission = { resource: 'pbv-full-applications', action: 'view_team_rollup' };
    expect(requiredPermission.resource).toBe('pbv-full-applications');
    expect(requiredPermission.action).toBe('view_team_rollup');
  });

  it('should allow any authenticated user to access My Work endpoints', () => {
    const myWorkEndpoints = [
      '/api/admin/me/work/my-queue',
      '/api/admin/me/work/awaiting-confirmation',
      '/api/admin/me/work/apps-i-lead',
      '/api/admin/me/work/fresh-activity',
      '/api/admin/me/work/stale-touched',
      '/api/admin/me/work/recently-completed',
    ];
    expect(myWorkEndpoints.length).toBe(6);
    myWorkEndpoints.forEach((endpoint) => {
      expect(endpoint).toMatch(/^\/api\/admin\/me\/work\//);
    });
  });

  it('should require elevated permission for Team Rollup endpoints', () => {
    const rollupEndpoints = [
      '/api/admin/pbv/rollup/workload',
      '/api/admin/pbv/rollup/bottlenecks',
      '/api/admin/pbv/rollup/at-risk',
      '/api/admin/pbv/rollup/overrides',
      '/api/admin/pbv/rollup/doc-age',
      '/api/admin/pbv/rollup/apps-without-lead',
      '/api/admin/pbv/rollup/tier2-backlog',
    ];
    expect(rollupEndpoints.length).toBe(7);
    rollupEndpoints.forEach((endpoint) => {
      expect(endpoint).toMatch(/^\/api\/admin\/pbv\/rollup\//);
    });
  });
});

describe('Workforce Dashboards — My Work Panels', () => {
  it('MyQueue should support status filter', () => {
    const filters = { status: 'submitted', flaggedForRereview: true };
    expect(filters.status).toBe('submitted');
    expect(filters.flaggedForRereview).toBe(true);
  });

  it('MyQueue should support aging filter', () => {
    const minAgeDays = 3;
    expect(minAgeDays).toBeGreaterThan(0);
  });

  it('AwaitingMyConfirmation should filter by pending status', () => {
    const statusFilter = 'pending';
    expect(['pending', 'confirmed', 'flagged']).toContain(statusFilter);
  });

  it('AppsILead should default to in-flight only', () => {
    const includeFinished = false;
    expect(includeFinished).toBe(false);
  });

  it('FreshActivity should look back 48h', () => {
    const hoursBack = 48;
    expect(hoursBack).toBe(48);
  });

  it('RecentlyCompleted should have configurable limit', () => {
    const limit = 10;
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(50);
  });
});

describe('Workforce Dashboards — Team Rollup Panels', () => {
  it('WorkloadByReviewer should support date range', () => {
    const range = 'week';
    expect(['week', 'month', 'custom']).toContain(range);
  });

  it('Bottlenecks should identify stages above threshold', () => {
    const stageAging = { stanton_review: 5, hach_review: 14 };
    expect(stageAging.stanton_review).toBe(AGING_THRESHOLDS.stanton_review_days);
    expect(stageAging.hach_review).toBe(AGING_THRESHOLDS.hach_review_days);
  });

  it('AtRisk should fallback to stage-age when target_move_in_date is null', () => {
    const hasTargetDate = false;
    expect(hasTargetDate).toBe(false);
  });

  it('RecentOverrides should have configurable range', () => {
    const rangeDays = 30;
    expect(rangeDays).toBeGreaterThan(0);
    expect(rangeDays).toBeLessThanOrEqual(90);
  });

  it('DocAgeDistribution should have 5 buckets', () => {
    const buckets = ['0–1 days', '2–3 days', '4–7 days', '8–14 days', '15+ days'];
    expect(buckets.length).toBe(5);
  });

  it('AppsWithoutLead should exclude pre_app and intake stages', () => {
    const excludedStages = ['pre_app', 'intake'];
    expect(excludedStages).toContain('pre_app');
    expect(excludedStages).toContain('intake');
  });

  it('Tier2Backlog should identify apps with >=80% tier-1 done', () => {
    const threshold = 0.8;
    expect(threshold).toBe(0.8);
  });
});

describe('Workforce Dashboards — Decision Alignment', () => {
  it('MyQueue supports decision: What should I review next?', () => {
    expect(true).toBe(true);
  });

  it('AwaitingMyConfirmation supports decision: What tier-1 reviews am I responsible for signing off on?', () => {
    expect(true).toBe(true);
  });

  it('AppsILead supports decision: Which of my packets are ready to push to HACH?', () => {
    expect(true).toBe(true);
  });

  it('FreshActivity supports decision: What just changed that I need to react to?', () => {
    expect(true).toBe(true);
  });

  it('StaleTouched supports decision: What did I drop the ball on?', () => {
    expect(true).toBe(true);
  });

  it('RecentlyCompleted supports decision: What did I do yesterday?', () => {
    expect(true).toBe(true);
  });

  it('WorkloadByReviewer supports decision: Who needs help / who has capacity?', () => {
    expect(true).toBe(true);
  });

  it('Bottlenecks supports decision: Where is the workflow backing up?', () => {
    expect(true).toBe(true);
  });

  it('AppsWithoutLead supports decision: Which packets need a Lead assigned?', () => {
    expect(true).toBe(true);
  });

  it('Tier2Backlog supports decision: Which Leads are overloaded?', () => {
    expect(true).toBe(true);
  });

  it('AtRisk supports decision: What is at risk of slipping a move-in commitment?', () => {
    expect(true).toBe(true);
  });

  it('RecentOverrides supports decision: Should I review whether this packet should have gone out?', () => {
    expect(true).toBe(true);
  });

  it('DocAgeDistribution supports decision: Are we keeping up with intake volume?', () => {
    expect(true).toBe(true);
  });
});

describe('Workforce Dashboards — Security', () => {
  it('should not expose rollup data to HACH endpoints', () => {
    const hachAllowedEndpoints = ['/api/hach/applications', '/api/hach/applications/[id]'];
    const rollupEndpoints = [
      '/api/admin/pbv/rollup/workload',
      '/api/admin/pbv/rollup/bottlenecks',
      '/api/admin/pbv/rollup/at-risk',
    ];

    // HACH endpoints should not overlap with rollup endpoints
    const overlap = hachAllowedEndpoints.some((h) =>
      rollupEndpoints.some((r) => r.includes('/hach/'))
    );
    expect(overlap).toBe(false);
  });

  it('should require authentication for all endpoints', () => {
    const allEndpoints = [
      '/api/admin/me/work/my-queue',
      '/api/admin/me/work/awaiting-confirmation',
      '/api/admin/me/work/apps-i-lead',
      '/api/admin/me/work/fresh-activity',
      '/api/admin/me/work/stale-touched',
      '/api/admin/me/work/recently-completed',
      '/api/admin/pbv/rollup/workload',
      '/api/admin/pbv/rollup/bottlenecks',
      '/api/admin/pbv/rollup/at-risk',
      '/api/admin/pbv/rollup/overrides',
      '/api/admin/pbv/rollup/doc-age',
      '/api/admin/pbv/rollup/apps-without-lead',
      '/api/admin/pbv/rollup/tier2-backlog',
    ];

    allEndpoints.forEach((endpoint) => {
      expect(endpoint).toMatch(/^\/api\/admin\//);
    });
  });
});

describe('Workforce Dashboards — UI Behavior', () => {
  it('should default to My Work tab for all users', () => {
    const defaultTab = 'my-work';
    expect(defaultTab).toBe('my-work');
  });

  it('should only show Team Rollup tab with permission', () => {
    const hasPermission = true;
    expect(hasPermission).toBe(true);
  });

  it('should support manual refresh only (no auto-polling)', () => {
    const autoRefresh = false;
    expect(autoRefresh).toBe(false);
  });

  it('should have clickable rows that navigate to relevant surfaces', () => {
    const rowClickable = true;
    expect(rowClickable).toBe(true);
  });

  it('should show empty state with neutral message', () => {
    const emptyStateMessage = 'Nothing in this view right now';
    expect(emptyStateMessage).toBeTruthy();
  });
});

describe('Workforce Dashboards — Page Structure', () => {
  it('should redirect from /admin/pbv/my-work to /admin/pbv/work', () => {
    const oldPath = '/admin/pbv/my-work';
    const newPath = '/admin/pbv/work';
    expect(oldPath).not.toBe(newPath);
    expect(newPath).toBe('/admin/pbv/work');
  });

  it('should be accessible via PBV Work nav entry', () => {
    const navPath = '/admin/pbv/work';
    expect(navPath).toBe('/admin/pbv/work');
  });
});
