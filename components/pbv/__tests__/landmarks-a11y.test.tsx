/**
 * PRP-009 — Landmarks / skip-link / progress live region / status dot tests.
 *
 * Covers A5 + A6 + A7. The layout-level <main> + skip-link is asserted by
 * source-grep (the route layout is a Next.js client component using `use()`,
 * which is awkward to mount in jsdom without a router runtime).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('@/lib/pbv/hooks/useSectionAutoSave', () => ({}));
vi.mock('@/components/pbv/intake/SaveStatusIndicator', () => ({
  default: () => <span data-testid="save-status" />,
}));
vi.mock('@/components/pbv/intake/PickUpLaterButton', () => ({
  default: () => <button data-testid="pick-up-later">later</button>,
}));
vi.mock('@/components/pbv/intake/LanguageSwitcher', () => ({
  default: () => <button data-testid="lang">lang</button>,
}));

import IntakeShell from '@/components/pbv/intake/IntakeShell';

// ── A7: layout-level <main id="main"> + skip-link ────────────────────────────
describe('PRP-009 / A7 — page landmark + skip-link', () => {
  it('layout renders a skip-link as the first node + <main id="main">', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'pbv-full-app', '[token]', 'layout.tsx'),
      'utf8'
    );
    // Skip-link must target #main, use sr-only (visually hidden) + focus:not-sr-only.
    expect(source).toMatch(/href="#main"/);
    expect(source).toMatch(/sr-only[^"]*focus:not-sr-only/);
    expect(source).toMatch(/Skip to main content/);
    // <main> landmark with id="main".
    expect(source).toMatch(/<main\s+id="main"/);
  });

  it('IntakeShell no longer renders its own <main> (so we avoid two nested main landmarks)', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'pbv', 'intake', 'IntakeShell.tsx'),
      'utf8'
    );
    // The content slot must now be a <section>, not a <main>.
    expect(source).toMatch(/<section[^>]*aria-label=\{sectionTitle\}/);
    expect(source).not.toMatch(/<main className="flex-1 px-4 py-6"/);
  });
});

// ── A6: section progress in a live region ───────────────────────────────────
describe('PRP-009 / A6 — intake progress announce', () => {
  const baseProps = {
    token: 't',
    language: 'en' as const,
    sectionNumber: 2,
    totalSections: 5,
    sectionTitle: 'Household',
    saveStatus: 'idle' as any,
    lastSavedAt: null,
    canGoBack: true,
    canGoNext: true,
    onBack: () => {},
    onNext: () => {},
  };

  it('mounts a sr-only role=status aria-live=polite region carrying "Section 2 of 5"', () => {
    render(
      <IntakeShell {...baseProps}>
        <p>body</p>
      </IntakeShell>
    );
    const live = screen.getByTestId('intake-progress-live');
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.className).toContain('sr-only');
    expect(live.textContent).toBe('Section 2 of 5');
  });

  it('progressbar carries an aria-label so the role conveys progress meaningfully', () => {
    const { container } = render(
      <IntakeShell {...baseProps}>
        <p>body</p>
      </IntakeShell>
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Section 2 of 5');
  });
});

// ── A5: status dot has an accessible name (not color-only) ──────────────────
describe('PRP-009 / A5 — document status dot accessible name', () => {
  it('source: status dot has role="img" + aria-label keyed on doc.status', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'pbv', 'TenantDocumentUpload.tsx'),
      'utf8'
    );
    // Match the role + aria-label decoration on the status dot.
    expect(source).toMatch(/role="img"\s+aria-label=\{String\(t\[`status_\$\{doc\.status\}/);
  });
});
