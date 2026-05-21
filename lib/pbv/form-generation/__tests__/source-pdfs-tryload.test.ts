/**
 * PRD-66 (audit #13): tryLoadPdf — distinguish "intentional not found" from
 * a real operational error.
 *
 * Pre-PRD-66, an empty `catch { return null }` swallowed permission denied /
 * EMFILE / corruption errors and made them indistinguishable from an
 * unsourced form. Now: ENOENT or the "Source PDF not found" message stays
 * silent; everything else returns null AND logs at ERROR with the file name.
 *
 * tryLoadPdf is not exported, so we exercise it indirectly through the
 * SOURCE_PDFS registry initialiser and through a direct file-system mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('PRD-66 tryLoadPdf — error inspection', () => {
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrSpy.mockRestore();
    vi.resetModules();
    vi.unmock('fs');
  });

  it('ENOENT from fs.readFileSync returns null silently (no console.error)', async () => {
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        existsSync: () => true, // bypass the early throw so we exercise readFileSync's ENOENT path
        readFileSync: () => {
          const err: any = new Error('ENOENT: no such file or directory');
          err.code = 'ENOENT';
          throw err;
        },
      };
    });

    // Importing SOURCE_PDFS triggers tryLoadPdf for every registered file.
    // Because every file would now ENOENT, no errors should be logged.
    const mod = await import('../source-pdfs');
    expect(mod.SOURCE_PDFS).toBeDefined();
    expect(consoleErrSpy).not.toHaveBeenCalled();
    // All entries are null since readFileSync always throws ENOENT.
    for (const formId of Object.keys(mod.SOURCE_PDFS)) {
      expect(mod.SOURCE_PDFS[formId].en).toBeNull();
      expect(mod.SOURCE_PDFS[formId].es).toBeNull();
    }
  });

  it('the "Source PDF not found" path stays silent (when assets dir is absent)', async () => {
    // This is the path taken by the un-mocked production code when the assets
    // dir is missing: loadPdf throws a generic Error whose message contains
    // "Source PDF not found". We just verify that importing source-pdfs in
    // such an environment never logs at ERROR.
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        existsSync: () => false, // forces loadPdf's "Source PDF not found" branch
      };
    });

    const mod = await import('../source-pdfs');
    expect(mod.SOURCE_PDFS).toBeDefined();
    expect(consoleErrSpy).not.toHaveBeenCalled();
  });

  it('non-ENOENT error (e.g. EACCES) returns null AND logs ERROR including the file name', async () => {
    vi.resetModules();
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        existsSync: () => true,
        readFileSync: () => {
          const err: any = new Error('EACCES: permission denied');
          err.code = 'EACCES';
          throw err;
        },
      };
    });

    const mod = await import('../source-pdfs');
    expect(mod.SOURCE_PDFS).toBeDefined();
    // Every read fails non-silently — many calls expected, but at least one.
    expect(consoleErrSpy).toHaveBeenCalled();
    // The log should include the [source-pdfs] tag + a file name.
    const firstCall = consoleErrSpy.mock.calls[0];
    expect(String(firstCall[0])).toMatch(/\[source-pdfs\] Failed to load .+\.pdf:/);
    // And every registry entry is null.
    for (const formId of Object.keys(mod.SOURCE_PDFS)) {
      expect(mod.SOURCE_PDFS[formId].en).toBeNull();
    }
  });
});
