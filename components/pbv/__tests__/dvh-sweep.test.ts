/**
 * PRP-014 — dvh sweep regression tests.
 *
 * Source-grep tests that pin the dvh + vh-fallback intent on the in-scope
 * files and assert that no 'vh' regressions creep back in on the standalone
 * iframe containers we just converted.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

describe('PRP-014 — MagicLinkSigningFlow iframe heights use dvh', () => {
  const src = readFileSync(
    join(root, 'components', 'pbv', 'sign', 'MagicLinkSigningFlow.tsx'),
    'utf8'
  );

  it('has at least one height: 40dvh inline style', () => {
    expect(src).toMatch(/height:\s*['"]40dvh['"]/);
  });

  it('does NOT contain the bare height: 40vh that would regress the iOS toolbar fix', () => {
    // Match only the standalone-iframe pattern; do not over-match on the
    // string "vh" inside JS identifiers.
    expect(src).not.toMatch(/height:\s*['"]40vh['"]/);
  });
});

describe('PRP-014 — SectionDvHomelessRa has no fixed vh containers (verified)', () => {
  const src = readFileSync(
    join(root, 'components', 'pbv', 'intake', 'SectionDvHomelessRa.tsx'),
    'utf8'
  );

  it('no inline height: Nvh and no h-[Nvh] / max-h-[Nvh] Tailwind arbitrary values', () => {
    expect(src).not.toMatch(/height:\s*['"]\d+vh['"]/);
    expect(src).not.toMatch(/h-\[\d+vh\]/);
    expect(src).not.toMatch(/max-h-\[\d+vh\]/);
  });
});

describe("PRP-014 — mobile-styles.css iOS 16px rule covers input[type='date']", () => {
  const css = readFileSync(join(root, 'app', 'mobile-styles.css'), 'utf8');

  it('the 16px rule selector list now includes input[type="date"]', () => {
    // Match the multi-selector rule containing the date selector.
    expect(css).toMatch(/input\[type="date"\][\s,]*\n[\s\S]{0,200}font-size:\s*16px/);
  });
});
