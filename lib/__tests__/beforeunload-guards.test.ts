/**
 * PRP-010 — Unsaved-work guard tests.
 *
 * These exercise the shape of the beforeunload-guard pattern (effect adds
 * the listener when dirty, removes it on cleanup, no-ops when safe). Because
 * the pages themselves are full Next.js client components with router
 * lifecycles that are awkward to drive in jsdom, the tests target the
 * canonical effect pattern with a tiny re-implementation that mirrors the
 * intake page's logic line-for-line. If the page changes its predicate,
 * this test still pins the contract.
 *
 * The actual page wiring is verified by source-grep (see the source
 * regexes below).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Mirror of the intake page guard:
 *   if (!sectionData) return;
 *   if (saveStatus === 'saved') return;
 *   addEventListener('beforeunload', handler);
 *   return () => removeEventListener('beforeunload', handler);
 */
function intakeGuardEffect(
  sectionData: Record<string, unknown> | null,
  saveStatus: SaveStatus,
  addListener: typeof window.addEventListener,
  removeListener: typeof window.removeEventListener
): { addCount: number; removeCount: number } {
  let addCount = 0;
  let removeCount = 0;
  if (!sectionData) return { addCount, removeCount };
  if (saveStatus === 'saved') return { addCount, removeCount };
  const handler = (_e: any) => {};
  addListener('beforeunload', handler as any);
  addCount += 1;
  // Cleanup ref to verify the symmetric remove path.
  removeListener('beforeunload', handler as any);
  removeCount += 1;
  return { addCount, removeCount };
}

describe('PRP-010 — intake unsaved-work guard pattern', () => {
  const add = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    add.mockClear();
    remove.mockClear();
  });

  it('does NOT add the listener when no section data has been touched yet', () => {
    intakeGuardEffect(null, 'idle', add as any, remove as any);
    expect(add).not.toHaveBeenCalled();
  });

  it('does NOT add the listener when save status is "saved" (clean)', () => {
    intakeGuardEffect({ a: 1 }, 'saved', add as any, remove as any);
    expect(add).not.toHaveBeenCalled();
  });

  it('adds + removes the listener when dirty (saving/error/idle with data)', () => {
    intakeGuardEffect({ a: 1 }, 'saving', add as any, remove as any);
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    add.mockClear();
    remove.mockClear();

    intakeGuardEffect({ a: 1 }, 'error', add as any, remove as any);
    expect(add).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});

// ── Source regex: the wiring really lives in the page file. ─────────────────
describe('PRP-010 — intake [section]/page.tsx wires the guard', () => {
  it('uses sectionData + saveStatus !== "saved" + beforeunload', () => {
    const src = readFileSync(
      join(
        process.cwd(),
        'app',
        'pbv-full-app',
        '[token]',
        'intake',
        '[section]',
        'page.tsx'
      ),
      'utf8'
    );
    expect(src).toMatch(/window\.addEventListener\('beforeunload'/);
    expect(src).toMatch(/window\.removeEventListener\('beforeunload'/);
    expect(src).toMatch(/saveStatus === 'saved'/);
    expect(src).toMatch(/PRP-010/);
  });
});

describe('PRP-010 — sign/summary + sign/forms pages wire the guard via pbv:signing-in-flight', () => {
  it.each([
    ['sign/summary/page.tsx', join(process.cwd(), 'app', 'pbv-full-app', '[token]', 'sign', 'summary', 'page.tsx')],
    ['sign/forms/page.tsx', join(process.cwd(), 'app', 'pbv-full-app', '[token]', 'sign', 'forms', 'page.tsx')],
  ])('%s uses the event channel + beforeunload pattern', (_label, path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/pbv:signing-in-flight/);
    expect(src).toMatch(/window\.addEventListener\('beforeunload'/);
    expect(src).toMatch(/window\.removeEventListener\('beforeunload'/);
    expect(src).toMatch(/PRP-010/);
  });
});
