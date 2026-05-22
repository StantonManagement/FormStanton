/**
 * PRP-017 — render-path performance + motion regression tests.
 *
 * Source-grep style for the page.tsx + globals.css wiring; full hydration
 * tests live in the deferred runtime gates.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const tenantPagePath = join(process.cwd(), 'app', 'pbv-full-app', '[token]', 'page.tsx');
const globalsCssPath = join(process.cwd(), 'app', 'globals.css');
const sectionHouseholdPath = join(process.cwd(), 'components', 'pbv', 'intake', 'SectionHousehold.tsx');
const generateFormsPath = join(
  process.cwd(),
  'app',
  'api',
  't',
  '[token]',
  'pbv-full-app',
  'generate-forms',
  'route.ts'
);

describe('PRP-017 / §1.3 — page.tsx uses min-h-dvh (no min-h-screen)', () => {
  const src = readFileSync(tenantPagePath, 'utf8');
  it('contains at least one min-h-dvh', () => {
    expect(src).toMatch(/min-h-dvh/);
  });
  it('contains no min-h-screen (the iOS-toolbar-broken form)', () => {
    expect(src).not.toMatch(/min-h-screen/);
  });
});

describe('PRP-017 / B6 + H1 — reduced-motion gate', () => {
  const src = readFileSync(tenantPagePath, 'utf8');
  it('imports useReducedMotion from framer-motion', () => {
    expect(src).toMatch(/useReducedMotion[^;]*from\s+['"]framer-motion['"]/);
  });
  it('builds motionProps from prefersReducedMotion (no static initial/animate/exit on motion.div)', () => {
    expect(src).toMatch(/const\s+prefersReducedMotion\s*=\s*useReducedMotion\(\)/);
    expect(src).toMatch(/const\s+motionProps\s*=\s*prefersReducedMotion/);
    // Ensure the inline initial={{ ... }} block on the section motion.div
    // has been replaced with {...motionProps}.
    expect(src).toMatch(/motion\.div[\s\S]{0,300}\{\.\.\.motionProps\}/);
  });

  const css = readFileSync(globalsCssPath, 'utf8');
  it('globals.css has a @media (prefers-reduced-motion: reduce) override block', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});

describe('PRP-017 / B4 — generate-forms stamp timing log', () => {
  const src = readFileSync(generateFormsPath, 'utf8');
  it('records per-form stamp duration in ms', () => {
    expect(src).toMatch(/const\s+stampStartedAt\s*=\s*Date\.now\(\)/);
    expect(src).toMatch(/const\s+stampMs\s*=\s*Date\.now\(\)\s*-\s*stampStartedAt/);
  });
  it('warns when stampMs > 5_000 (or 5000)', () => {
    expect(src).toMatch(/stampMs\s*>\s*5_000/);
    expect(src).toMatch(/\[generate-forms\] slow stamp/);
  });
});

describe('PRP-017 / A4 + H4 — SectionHousehold dob inputs have aria-describedby + onBlur clear', () => {
  const src = readFileSync(sectionHouseholdPath, 'utf8');
  it('hoh_dob input declares aria-describedby="hoh_dob_hint" + matching span', () => {
    expect(src).toMatch(/aria-describedby="hoh_dob_hint"/);
    expect(src).toMatch(/id="hoh_dob_hint"/);
  });
  it("member dob inputs use the same per-row aria-describedby pattern", () => {
    expect(src).toMatch(/aria-describedby=\{`m\$\{i\}_dob_hint`\}/);
    expect(src).toMatch(/id=\{`m\$\{i\}_dob_hint`\}/);
  });
  it('both date inputs add an onBlur handler that re-syncs the value (Firefox safety)', () => {
    expect(src).toMatch(/onBlur=\{\(e\) => \{ if \(e\.target\.value !== hohDob\)/);
    expect(src).toMatch(/onBlur=\{\(e\) => \{[\s\S]{0,200}m\.dob/);
  });
});

describe('PRP-017 — generate-forms required-signer region untouched', () => {
  const src = readFileSync(generateFormsPath, 'utf8');
  it("the inline `members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.id)` union is still present (PRP-005 invariant)", () => {
    expect(src).toMatch(/members\.filter\(\(m\)\s*=>\s*\(m\.age\s*\?\?\s*0\)\s*>=\s*18\)\.map\(\(m\)\s*=>\s*m\.id\)/);
  });
});
