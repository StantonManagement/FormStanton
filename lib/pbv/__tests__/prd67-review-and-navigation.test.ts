/**
 * PRD-67 — Structural assertions for the launch-hardening UI cuts.
 *
 * Heavy UI / router mocking would test framework plumbing more than the
 * invariants we care about. These structural tests target the cross-file
 * contracts the PRD called out: navigation via router.push (not
 * window.location.href), the view-all subview, the ?view=all + ?filter=rejected
 * deep-links, the read-only review surface, the download-link gating switch
 * (intake_status → submitted_at), and the U5 + U6 fixes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function read(...parts: string[]): string {
  const p = join(process.cwd(), ...parts);
  return readFileSync(p, 'utf8');
}

describe('PRD-67 — Tenant dashboard view-all + review entries', () => {
  const src = read('components', 'pbv', 'sign', 'TenantDashboard.tsx');

  it('Gate 6: download link is gated on data.submitted_at (was intake_status)', () => {
    // The link is rendered inside {data.submitted_at && (...)} — not the old
    // {data.intake_status === 'complete' && (...)}.
    expect(src).toMatch(/\{data\.submitted_at\s*&&\s*\(/);
    // And the print/download href is still present (the gating moved, not the link).
    expect(src).toMatch(/print\/download/);
    // Negative: no remaining gate that fires on intake_status alone for the link.
    const downloadIdx = src.indexOf('print/download');
    const blockBefore = src.slice(Math.max(0, downloadIdx - 400), downloadIdx);
    expect(blockBefore).not.toMatch(/intake_status\s*===\s*['"]complete['"]\s*&&\s*\(\s*[\s\S]*?\/\* Download/);
  });

  it('adds "View my documents" and "Review my application" entries that router.push to the right URLs', () => {
    expect(src).toMatch(/view_documents/);
    expect(src).toMatch(/review_application/);
    expect(src).toMatch(/router\.push\(`\/pbv-full-app\/\$\{token\}\/documents\?view=all`\)/);
    expect(src).toMatch(/router\.push\(`\/pbv-full-app\/\$\{token\}\/review`\)/);
  });

  it('EN/ES/PT strings exist for both new dashboard entries', () => {
    expect(src).toMatch(/view_documents:\s*'View my documents'/);
    expect(src).toMatch(/view_documents:\s*'Ver mis documentos'/);
    expect(src).toMatch(/view_documents:\s*'Ver meus documentos'/);
    expect(src).toMatch(/review_application:\s*'Review my application'/);
    expect(src).toMatch(/review_application:\s*'Revisar mi solicitud'/);
    expect(src).toMatch(/review_application:\s*'Revisar minha inscri/);
  });
});

describe('PRD-67 — Documents page navigation + view-all + filter=rejected', () => {
  const src = read('app', 'pbv-full-app', '[token]', 'documents', 'page.tsx');

  it('imports useRouter + useSearchParams from next/navigation', () => {
    expect(src).toMatch(/useRouter[\s,}]/);
    expect(src).toMatch(/useSearchParams[\s,}]/);
  });

  it('Gate 5: navigation uses router.push, not window.location.href (except for full-page reload fallback)', () => {
    // window.location.reload() is the error-fallback escape hatch and is
    // intentional. window.location.href = '...' is the broken nav we're
    // replacing.
    expect(src).not.toMatch(/window\.location\.href\s*=\s*['"`]/);
    // Positive: the two prior assignments now use router.push.
    expect(src).toMatch(/router\.push\(`\/pbv-full-app\/\$\{token\}\/dashboard`\)/);
    expect(src).toMatch(/router\.push\(`\/pbv-full-app\/\$\{token\}\/sign\/summary`\)/);
  });

  it('handles the ?view=all deep-link (view-all subview)', () => {
    expect(src).toMatch(/viewParam\s*===\s*'all'/);
    expect(src).toMatch(/pageView\.kind === 'view_all'/);
  });

  it('U10: honors ?filter=rejected and jumps to the first rejected card', () => {
    expect(src).toMatch(/filterParam\s*===\s*'rejected'/);
    expect(src).toMatch(/firstRejectedIndex/);
  });

  it('passes onGoToViewAll into DocumentCardStack so the in-stack "see full list" can navigate', () => {
    expect(src).toMatch(/onGoToViewAll=\{handleGoToViewAll\}/);
  });
});

describe('PRD-67 — DocumentCardStack U5 + U6', () => {
  const src = read('components', 'pbv', 'cards', 'DocumentCardStack.tsx');

  it('U5: handleSeeFullList navigates via onGoToViewAll (no more alert)', () => {
    expect(src).toMatch(/onGoToViewAll\?:/);
    expect(src).toMatch(/if\s*\(onGoToViewAll\)/);
    expect(src).not.toMatch(/alert\('Sidesheet coming in Phase 3 \(F6\)'\)/);
  });

  it('U6: the help phone is the real office contact, not the (203) 555-1234 placeholder', () => {
    expect(src).not.toMatch(/\(203\)\s*555-1234/);
    expect(src).not.toMatch(/tel:\+12035551234/);
    expect(src).toMatch(/defaultOfficeContact/);
  });
});

describe('PRD-67 — Review-application page exists, read-only, includes building/unit + call-office line', () => {
  const reviewPagePath = join(
    process.cwd(),
    'app', 'pbv-full-app', '[token]', 'review', 'page.tsx'
  );

  it('the page file exists', () => {
    expect(existsSync(reviewPagePath)).toBe(true);
  });

  it('renders read-only via IntakeDataDisplay (mode="review") and useSectionVisibility', () => {
    const src = readFileSync(reviewPagePath, 'utf8');
    expect(src).toMatch(/IntakeDataDisplay/);
    expect(src).toMatch(/mode=['"]review['"]/);
    expect(src).toMatch(/useSectionVisibility/);
  });

  it('shows building/unit read-only (no editable input bound to them)', () => {
    const src = readFileSync(reviewPagePath, 'utf8');
    expect(src).toMatch(/data\.building_address/);
    expect(src).toMatch(/data\.unit_number/);
    // No <input>, <select>, <textarea>, or onChange for the building/unit values.
    expect(src).not.toMatch(/<input[^>]*data\.(building_address|unit_number)/);
    expect(src).not.toMatch(/<select[^>]*data\.(building_address|unit_number)/);
    expect(src).not.toMatch(/<textarea[^>]*data\.(building_address|unit_number)/);
  });

  it('exposes a "call the office" path with the real office number', () => {
    const src = readFileSync(reviewPagePath, 'utf8');
    expect(src).toMatch(/defaultOfficeContact/);
    expect(src).toMatch(/href=\{`tel:\$\{phoneHref\}`\}/);
  });

  it('the back button uses router.push to /dashboard, not window.location', () => {
    const src = readFileSync(reviewPagePath, 'utf8');
    expect(src).toMatch(/router\.push\(`\/pbv-full-app\/\$\{token\}\/dashboard`\)/);
    expect(src).not.toMatch(/window\.location\.href\s*=\s*['"`]/);
  });
});
