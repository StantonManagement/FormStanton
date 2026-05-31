/**
 * scripts/regen-applicant-forms.ts
 *
 * PRD-86 Phase A step 8 — regenerate a PBV applicant's unsigned documents from
 * the (corrected) field maps, via the REAL generation route so behavior matches
 * production exactly (conditional rules, generation_version, storage path, the
 * pbv_form_documents upsert). It does NOT notify the applicant — that is PRD-85
 * Phase 4, operator-triggered after the PRD-87 review/approval.
 *
 * IMPORTANT — deploy-gated:
 *   This calls ${NEXT_PUBLIC_APP_URL}/api/t/{token}/pbv-full-app/generate-forms,
 *   which runs the field maps bundled in the DEPLOYED build. Run it only AFTER
 *   the corrected scripts/field-maps/*.json have been deployed, or it will
 *   regenerate using the old (defective) maps. (A local dev server is not used —
 *   per docs/SHELL-PROTOCOL.md agents must not launch `npm run dev`.)
 *
 * Usage:
 *   npx tsx scripts/regen-applicant-forms.ts <appId> [<appId> ...]
 *   npx tsx scripts/regen-applicant-forms.ts --mia-santha   # the two PRD-85 applicants
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config({ path: '.env' });

const MIA = '2b451d4e-6578-43e6-9689-450cadcc62fe';
const SANTHA = '00d613e5-1573-4a7b-ab98-73a46ca4d681';

async function main() {
  const argv = process.argv.slice(2);
  const ids = argv.includes('--mia-santha')
    ? [MIA, SANTHA]
    : argv.filter((a) => !a.startsWith('--'));

  if (ids.length === 0) {
    console.error('Usage: npx tsx scripts/regen-applicant-forms.ts <appId> [...] | --mia-santha');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !serviceKey || !appUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_APP_URL');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  console.log(`[regen] target endpoint base: ${appUrl}`);
  console.log('[regen] reminder: corrected field maps must be DEPLOYED for this to apply them.\n');

  for (const appId of ids) {
    const { data: app, error } = await supabase
      .from('pbv_full_applications')
      .select('id, head_of_household_name, tenant_access_token, intake_status')
      .eq('id', appId)
      .maybeSingle();

    if (error || !app) {
      console.error(`[regen] ${appId}: not found (${error?.message ?? 'no row'})`);
      continue;
    }
    if (app.intake_status !== 'complete') {
      console.error(`[regen] ${appId} (${app.head_of_household_name}): intake not complete — skipping`);
      continue;
    }
    if (!app.tenant_access_token) {
      console.error(`[regen] ${appId} (${app.head_of_household_name}): no tenant_access_token — skipping`);
      continue;
    }

    const endpoint = `${appUrl}/api/t/${app.tenant_access_token}/pbv-full-app/generate-forms`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.text();
      console.log(`[regen] ${appId} (${app.head_of_household_name}): HTTP ${res.status} ${body.slice(0, 300)}`);
    } catch (err) {
      console.error(`[regen] ${appId}: request failed —`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n[regen] done. Documents regenerated; NO notification sent (PRD-85 Phase 4 is separate).');
}

main().catch((err) => {
  console.error('[regen] fatal:', err);
  process.exit(1);
});
