import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function canManage(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return false;
  return user.isSuperAdmin || userHasPermission(user, 'role-management', 'admin');
}

/**
 * Expected CSV format (header row required):
 *   effective_year, ami_pct, msa_code, msa_name, size_1, size_2, ..., size_8
 *
 * Each data row produces 8 hud_ami_limits rows (one per household size).
 * msa_name is optional — leave blank to inherit the existing name for that MSA.
 *
 * POST /api/admin/ami-limits/csv
 * Body: { csv: string, commit: boolean }
 *   commit=false → preview parsed rows, no DB write
 *   commit=true  → insert all rows (ON CONFLICT DO NOTHING)
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!canManage(user)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: { csv?: string; commit?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { csv, commit = false } = body;
  if (!csv || typeof csv !== 'string') {
    return NextResponse.json({ success: false, message: 'csv field is required' }, { status: 400 });
  }

  const parseResult = parseCsv(csv);
  if ('error' in parseResult) {
    return NextResponse.json({ success: false, message: parseResult.error }, { status: 422 });
  }

  const { rows } = parseResult;
  if (rows.length === 0) {
    return NextResponse.json({ success: false, message: 'No data rows found in CSV' }, { status: 422 });
  }

  if (!commit) {
    return NextResponse.json({ success: true, preview: rows, count: rows.length });
  }

  const { error } = await supabaseAdmin
    .from('hud_ami_limits')
    .upsert(
      rows.map((r) => ({ ...r, created_by: user.username })),
      { onConflict: 'msa_code,effective_year,ami_pct,household_size', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[ami-limits/csv] upsert error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser
// ─────────────────────────────────────────────────────────────────────────────

interface AmiRow {
  msa_code: string;
  msa_name: string | null;
  effective_year: number;
  ami_pct: number;
  household_size: number;
  annual_limit: number;
}

function parseCsv(csv: string): { rows: AmiRow[] } | { error: string } {
  const lines = csv
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    return { error: 'CSV must have a header row and at least one data row' };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const required = ['effective_year', 'ami_pct', 'msa_code'];
  for (const req of required) {
    if (!headers.includes(req)) {
      return { error: `Missing required column: ${req}` };
    }
  }

  // Detect size columns: size_1 … size_8
  const sizeColIndices: Record<number, number> = {};
  for (let size = 1; size <= 8; size++) {
    const idx = headers.indexOf(`size_${size}`);
    if (idx !== -1) sizeColIndices[size] = idx;
  }

  if (Object.keys(sizeColIndices).length === 0) {
    return { error: 'CSV must include at least one size column (size_1 through size_8)' };
  }

  const col = (row: string[], name: string): string =>
    (row[headers.indexOf(name)] ?? '').trim();

  const rows: AmiRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    const effectiveYear = parseInt(col(parts, 'effective_year'), 10);
    const amiPct = parseInt(col(parts, 'ami_pct'), 10);
    const msaCode = col(parts, 'msa_code');
    const msaName = headers.includes('msa_name') ? col(parts, 'msa_name') || null : null;

    if (isNaN(effectiveYear) || effectiveYear < 2000 || effectiveYear > 2100) {
      return { error: `Row ${i + 1}: invalid effective_year "${col(parts, 'effective_year')}"` };
    }
    if (![30, 50, 80, 100].includes(amiPct)) {
      return { error: `Row ${i + 1}: ami_pct must be 30, 50, 80, or 100 — got "${amiPct}"` };
    }
    if (!msaCode) {
      return { error: `Row ${i + 1}: msa_code is required` };
    }

    for (const [size, colIdx] of Object.entries(sizeColIndices) as [string, number][]) {
      const rawLimit = parts[colIdx] ?? '';
      const annualLimit = parseFloat(rawLimit.replace(/[$,]/g, ''));
      if (isNaN(annualLimit) || annualLimit <= 0) {
        return {
          error: `Row ${i + 1}: invalid annual_limit for size_${size}: "${rawLimit}"`,
        };
      }
      rows.push({
        msa_code: msaCode,
        msa_name: msaName,
        effective_year: effectiveYear,
        ami_pct: amiPct,
        household_size: Number(size),
        annual_limit: annualLimit,
      });
    }
  }

  return { rows };
}
