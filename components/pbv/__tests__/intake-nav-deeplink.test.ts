/**
 * PRP-015 — intake navigation + deep-link integrity regression tests.
 *
 * Source-grep style. Rendering the full IntakeSectionPage in jsdom is
 * out-of-scope (router + bootstrap hook + section components); the page
 * already has an end-to-end smoke as a deferred runtime gate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sectionPagePath = join(
  process.cwd(),
  'app',
  'pbv-full-app',
  '[token]',
  'intake',
  '[section]',
  'page.tsx'
);
const documentsPagePath = join(
  process.cwd(),
  'app',
  'pbv-full-app',
  '[token]',
  'documents',
  'page.tsx'
);

describe('PRP-015 / E1 — handleSectionChange functional-updater merge', () => {
  const src = readFileSync(sectionPagePath, 'utf8');
  it('uses a functional setLocalIntakeData(prev => …) merge', () => {
    expect(src).toMatch(/setLocalIntakeData\(\s*\(\s*prev\s*\)\s*=>/);
  });
  it('no longer closes over intakeData in handleSectionChange deps', () => {
    // The pre-PRP-015 dep array was `[intakeData]` + eslint-disable; the
    // fix uses a functional updater and drops the eslint-disable comment
    // immediately above the dep array. So: that comment must be gone.
    const idx = src.indexOf('const handleSectionChange = useCallback(');
    expect(idx).toBeGreaterThan(0);
    const slice = src.slice(idx, idx + 1200);
    expect(slice).not.toMatch(/eslint-disable-next-line\s+react-hooks\/exhaustive-deps/);
    expect(slice).not.toMatch(/\[intakeData\]/);
  });
});

describe('PRP-015 / F2 — resume-section guard', () => {
  const src = readFileSync(sectionPagePath, 'utf8');
  it('reads resume_section and uses router.replace to redirect when currentIndex > resumeIndex', () => {
    expect(src).toMatch(/resume_section/);
    expect(src).toMatch(/router\.replace\(/);
    expect(src).toMatch(/currentIndex\s*>\s*resumeIndex/);
  });
  it('allows the review section through (no redirect)', () => {
    expect(src).toMatch(/currentSlug === 'review'/);
  });
});

describe('PRP-015 / §8.2 — scroll-to-top after navigateTo', () => {
  const src = readFileSync(sectionPagePath, 'utf8');
  it('calls window.scrollTo({ top: 0, behavior: "smooth" }) after router.push', () => {
    expect(src).toMatch(/router\.push\([^)]+\)[\s\S]{0,600}window\.scrollTo\(\s*\{\s*top:\s*0/);
  });
});

describe('PRP-015 / F1 — documents ?filter= allow-list', () => {
  const src = readFileSync(documentsPagePath, 'utf8');
  it('filterParam type is restricted to "all" | "rejected" | null', () => {
    expect(src).toMatch(/'all'\s*\|\s*'rejected'\s*\|\s*null/);
  });
  it("coerces unknown values to null (no raw passthrough)", () => {
    expect(src).toMatch(/rawFilterParam === 'rejected'\s*\|\|\s*rawFilterParam === 'all'/);
  });
});
