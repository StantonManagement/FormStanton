/**
 * PRD-84 — Observability & path-safety.
 *
 * A8: events response carries persistence_initiated (default async posture).
 * A9: signature-thumbnails strip uses .startsWith() + .slice() instead of a
 *     silent .replace(), and logs a structured warning on signed-URL failure.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const eventsSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'events', 'route.ts'),
  'utf8'
);

const thumbsSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'signature-thumbnails', 'route.ts'),
  'utf8'
);

describe('PRD-84 A8 — events response carries persistence_initiated', () => {
  it('response data includes persistence_initiated from processedEvents.length', () => {
    expect(eventsSrc).toMatch(/persistence_initiated:\s*processedEvents\.length/);
  });

  it('keeps the non-blocking write posture (Promise.allSettled is not awaited)', () => {
    // Should still be fire-and-forget (the comment + the non-await form).
    expect(eventsSrc).toMatch(/Promise\.allSettled\(writePromises\)\.then/);
    // No `await Promise.allSettled(writePromises)` snuck in.
    expect(eventsSrc).not.toMatch(/await\s+Promise\.allSettled\(writePromises\)/);
  });

  it('accepted / rejected counts are unchanged', () => {
    expect(eventsSrc).toMatch(/accepted:\s*results\.filter\(\(r\)\s*=>\s*r\.status\s*===\s*['"]accepted['"]\)\.length/);
    expect(eventsSrc).toMatch(/rejected:\s*results\.filter\(\(r\)\s*=>\s*r\.status\s*===\s*['"]rejected['"]\)\.length/);
  });

  it('event validation logic is unchanged (VALID_EVENT_TYPES still gates)', () => {
    expect(eventsSrc).toMatch(/VALID_EVENT_TYPES\.has\(event\.event_type\)/);
  });
});

describe('PRD-84 A9 — signature-thumbnails explicit prefix strip', () => {
  it('no longer uses the silent .replace() pattern on the storage path', () => {
    expect(thumbsSrc).not.toMatch(
      /storagePath\.replace\(['"]pbv-applications\/['"]/
    );
  });

  it('strips via .startsWith() guard + .slice() (explicit + observable)', () => {
    expect(thumbsSrc).toMatch(/storagePath\.startsWith\(bucketPrefix\)/);
    expect(thumbsSrc).toMatch(/storagePath\.slice\(bucketPrefix\.length\)/);
  });

  it('logs signature_thumbnail_signed_url_failed on createSignedUrl failure (no broken-URL leak)', () => {
    expect(thumbsSrc).toMatch(/signature_thumbnail_signed_url_failed/);
    // Failure branch must omit the entry, not emit a partial URL.
    const failBranch = thumbsSrc.split('signature_thumbnail_signed_url_failed')[1] ?? '';
    expect(failBranch.split('urlMap[storagePath]')[0]).toMatch(/return\s*;/);
  });

  it('preserves the per-application safePaths guard (unchanged eligibility)', () => {
    expect(thumbsSrc).toMatch(/const\s+prefix\s*=\s*`pbv-applications\/\$\{app\.id\}\/`/);
    expect(thumbsSrc).toMatch(/paths\.filter\(\(p\)\s*=>\s*p\.startsWith\(prefix\)\)/);
  });
});
