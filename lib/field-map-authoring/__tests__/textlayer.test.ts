import { describe, it, expect } from 'vitest';
import { classifyWord } from '@/lib/field-map-authoring/textlayer';

describe('classifyWord', () => {
  it('treats pure fill runs as fill_line (values belong on them)', () => {
    for (const s of ['_____', '..........', '- - - -', '——', '–––', '   ', '___ ___']) {
      expect(classifyWord(s)).toBe('fill_line');
    }
  });

  it('treats anything with a letter or digit as a real_label', () => {
    for (const s of ['Email', 'Apt #', 'Date of Birth:', 'SSN', 'Dirección', 'Teléfono', '18']) {
      expect(classifyWord(s)).toBe('real_label');
    }
  });
});
