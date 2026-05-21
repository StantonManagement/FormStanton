import { describe, it, expect } from 'vitest';
import { DOC_TYPE_HELP } from '../docTypeHelp';
import { DOC_CONTENT } from '../cards/docContent';

/**
 * PRD-59 Phase 4: Translation coverage fail-loud guard.
 *
 * These tests assert that for every key in the EN block,
 * ES and PT have a non-empty value NOT beginning with 'TODO:'.
 *
 * This is the drift guard: if a developer adds a new EN string
 * without ES/PT translations, these tests will fail.
 */

describe('DOC_TYPE_HELP — translation coverage (PRD-59)', () => {
  const docTypes = Object.keys(DOC_TYPE_HELP);

  it('has EN for all doc types', () => {
    for (const docType of docTypes) {
      const help = DOC_TYPE_HELP[docType];
      expect(help.en, `${docType} missing EN`).toBeTruthy();
      expect(help.en.length, `${docType} EN is empty`).toBeGreaterThan(0);
    }
  });

  it('has ES for all doc types (no TODO:)', () => {
    for (const docType of docTypes) {
      const help = DOC_TYPE_HELP[docType];
      expect(help.es, `${docType} missing ES`).toBeTruthy();
      expect(help.es.length, `${docType} ES is empty`).toBeGreaterThan(0);
      expect(
        help.es.startsWith('TODO:'),
        `${docType} ES has TODO: placeholder`
      ).toBe(false);
    }
  });

  it('has PT for all doc types (no TODO:)', () => {
    for (const docType of docTypes) {
      const help = DOC_TYPE_HELP[docType];
      expect(help.pt, `${docType} missing PT`).toBeTruthy();
      expect(help.pt.length, `${docType} PT is empty`).toBeGreaterThan(0);
      expect(
        help.pt.startsWith('TODO:'),
        `${docType} PT has TODO: placeholder`
      ).toBe(false);
    }
  });
});

describe('DOC_CONTENT — translation coverage (PRD-59)', () => {
  const docTypes = Object.keys(DOC_CONTENT);

  it('has title EN/ES/PT for all doc types', () => {
    for (const docType of docTypes) {
      const content = DOC_CONTENT[docType];
      expect(content.title.en, `${docType} title EN`).toBeTruthy();
      expect(content.title.es, `${docType} title ES`).toBeTruthy();
      expect(content.title.pt, `${docType} title PT`).toBeTruthy();
    }
  });

  it('has description EN/ES/PT for all doc types', () => {
    for (const docType of docTypes) {
      const content = DOC_CONTENT[docType];
      expect(content.description.en, `${docType} description EN`).toBeTruthy();
      expect(content.description.es, `${docType} description ES`).toBeTruthy();
      expect(content.description.pt, `${docType} description PT`).toBeTruthy();
    }
  });

  it('has fallback EN/ES/PT for all doc types', () => {
    for (const docType of docTypes) {
      const content = DOC_CONTENT[docType];
      expect(content.fallback.en, `${docType} fallback EN`).toBeTruthy();
      expect(content.fallback.es, `${docType} fallback ES`).toBeTruthy();
      expect(content.fallback.pt, `${docType} fallback PT`).toBeTruthy();
    }
  });

  it('no TODO: placeholders in ES/PT strings', () => {
    for (const docType of docTypes) {
      const content = DOC_CONTENT[docType];
      const esStrings = [content.title.es, content.description.es, content.fallback.es];
      const ptStrings = [content.title.pt, content.description.pt, content.fallback.pt];

      for (const str of esStrings) {
        expect(
          str?.startsWith('TODO:'),
          `${docType} ES has TODO: placeholder`
        ).toBe(false);
      }
      for (const str of ptStrings) {
        expect(
          str?.startsWith('TODO:'),
          `${docType} PT has TODO: placeholder`
        ).toBe(false);
      }
    }
  });
});
