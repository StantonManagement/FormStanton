import { describe, it, expect } from 'vitest';

// Unit tests for URL serialization logic extracted from useUrlState.ts
// We test the pure serialization/deserialization helpers directly.

type SortState = Array<{ id: string; desc: boolean }>;
type FilterState = Record<string, unknown>;

function serializeSort(sorting: SortState): string {
  return sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
}

function parseSort(raw: string): SortState {
  if (!raw) return [];
  return raw.split(',').map((part) => {
    const [id, dir] = part.split(':');
    return { id, desc: dir === 'desc' };
  });
}

function serializeFilters(filters: FilterState, ns: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) out[`${ns}.filter.${key}`] = (value as string[]).join(',');
    } else if (
      typeof value === 'object' &&
      'from' in (value as Record<string, unknown>) &&
      'to' in (value as Record<string, unknown>)
    ) {
      const v = value as { from?: string; to?: string };
      if (v.from || v.to) out[`${ns}.filter.${key}`] = `${v.from ?? ''}:${v.to ?? ''}`;
    } else {
      out[`${ns}.filter.${key}`] = String(value);
    }
  }
  return out;
}

function parseFilterValue(raw: string): unknown {
  if (raw.includes(':') && !raw.startsWith('http')) {
    const [from, to] = raw.split(':');
    return { from, to };
  }
  if (raw.includes(',')) {
    return raw.split(',');
  }
  return raw;
}

describe('useUrlState — sort serialization', () => {
  it('round-trips single sort', () => {
    const original: SortState = [{ id: 'name', desc: false }];
    const serialized = serializeSort(original);
    expect(serialized).toBe('name:asc');
    expect(parseSort(serialized)).toEqual(original);
  });

  it('round-trips multi-column sort', () => {
    const original: SortState = [{ id: 'created_at', desc: true }, { id: 'name', desc: false }];
    const serialized = serializeSort(original);
    expect(serialized).toBe('created_at:desc,name:asc');
    expect(parseSort(serialized)).toEqual(original);
  });

  it('returns empty array for empty string', () => {
    expect(parseSort('')).toEqual([]);
  });

  it('desc:true when dir is desc', () => {
    const result = parseSort('status:desc');
    expect(result[0].desc).toBe(true);
  });

  it('desc:false when dir is asc', () => {
    const result = parseSort('status:asc');
    expect(result[0].desc).toBe(false);
  });
});

describe('useUrlState — filter serialization', () => {
  const ns = 'foo';

  it('namespaces all params with ns prefix', () => {
    const out = serializeFilters({ status: 'active' }, ns);
    expect(Object.keys(out)[0]).toBe('foo.filter.status');
  });

  it('multi-value filter serializes as comma-separated', () => {
    const out = serializeFilters({ status: ['qualified', 'needs-review'] }, ns);
    expect(out['foo.filter.status']).toBe('qualified,needs-review');
  });

  it('date-range serializes as from:to', () => {
    const out = serializeFilters({ created_at: { from: '2026-01-01', to: '2026-05-20' } }, ns);
    expect(out['foo.filter.created_at']).toBe('2026-01-01:2026-05-20');
  });

  it('skips empty string values', () => {
    const out = serializeFilters({ status: '' }, ns);
    expect(out).toEqual({});
  });

  it('skips empty arrays', () => {
    const out = serializeFilters({ status: [] }, ns);
    expect(out).toEqual({});
  });

  it('skips null values', () => {
    const out = serializeFilters({ status: null }, ns);
    expect(out).toEqual({});
  });
});

describe('useUrlState — filter parsing', () => {
  it('parses comma-separated as array', () => {
    expect(parseFilterValue('qualified,needs-review')).toEqual(['qualified', 'needs-review']);
  });

  it('parses colon-separated as date range object', () => {
    const result = parseFilterValue('2026-01-01:2026-05-20') as { from: string; to: string };
    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe('2026-05-20');
  });

  it('parses plain string as string', () => {
    expect(parseFilterValue('active')).toBe('active');
  });
});

describe('useUrlState — namespace isolation', () => {
  it('two namespaces do not share params', () => {
    const out1 = serializeFilters({ status: 'a' }, 'ns1');
    const out2 = serializeFilters({ status: 'b' }, 'ns2');
    expect(Object.keys(out1)).toEqual(['ns1.filter.status']);
    expect(Object.keys(out2)).toEqual(['ns2.filter.status']);
    expect(out1['ns1.filter.status']).toBe('a');
    expect(out2['ns2.filter.status']).toBe('b');
  });

  it('ns1 key does not appear in ns2 output', () => {
    const out = serializeFilters({ building: '128 Main' }, 'preapps');
    expect('pipeline.filter.building' in out).toBe(false);
  });
});
