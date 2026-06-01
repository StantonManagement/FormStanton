/**
 * Add to the main_application map (EN or ES):
 *   - Disabled / Student / U.S. Citizen Yes/No columns on adults + minors
 *   - tighten relationship/age widths (would otherwise overlap the new columns)
 *   - race / ethnicity / marital flat checkbox fields (page-1 demographics)
 *   - DV (Q8, page 4) + sold-assets (Q3, page 3) Yes/No checkbox fields
 * Coordinates verified against assets/pbv-source-pdfs/main-application-<lang>.pdf.
 *
 *   node scripts/_gen_demographics.mjs <map.json> <en|es>
 */
import { readFileSync, writeFileSync } from 'fs';

const mapPath = process.argv[2];
const lang = process.argv[3] ?? 'en';

// Per-lang geometry. status = [disabled.x, student.x, citizen.x]; demo boxes are
// [value, x]; questions carry their page + y + yes/no x.
const GEO = {
  en: {
    status: [438, 485, 560],
    race: [675.5, [['white', 87.1], ['black', 133.5], ['native', 231.5], ['asian', 325.5], ['pacific_islander', 370.6], ['other', 457.7]]],
    ethnicity: [653.6, [['yes', 195.1], ['no', 231.1]]],
    marital: [631.7, [['single', 195.1], ['married', 242.6], ['separated', 297.3], ['divorced', 359.7]]],
    q_sold_assets: { page: 3, y: 615.4, yes: 391, no: 428 },
    q_dv: { page: 4, y: 961.8, yes: 251, no: 288 },
  },
  es: {
    status: [398, 458, 552],
    race: [661.7, [['white', 87.1], ['black', 137.6], ['native', 222.8], ['asian', 322.7], ['pacific_islander', 378.5], ['other', 478.6]]],
    ethnicity: [639.8, [['yes', 195.1], ['no', 231.1]]],
    marital: [617.9, [['single', 195.1], ['married', 255.4], ['separated', 314.9], ['divorced', 382.9]]],
    q_sold_assets: { page: 3, y: 601.4, yes: 359, no: 388 },
    q_dv: { page: 4, y: 960.2, yes: 262, no: 291 },
  },
};
const g = GEO[lang];

const map = JSON.parse(readFileSync(mapPath, 'utf8'));

const statusCols = () => [
  { field_prefix: 'disabled', type: 'text', x: g.status[0], y_offset: 5, width: 24, font_size: 7, label: 'Disabled Yes/No' },
  { field_prefix: 'student', type: 'text', x: g.status[1], y_offset: 5, width: 24, font_size: 7, label: 'Student Yes/No' },
  { field_prefix: 'citizen', type: 'text', x: g.status[2], y_offset: 5, width: 24, font_size: 7, label: 'U.S. Citizen Yes/No' },
];

for (const rp of map.row_patterns) {
  if (rp.id !== 'adults' && rp.id !== 'minors') continue;
  for (const c of rp.columns) {
    if (c.field_prefix === 'relationship') c.width = Math.min(c.width ?? 999, Math.max(40, g.status[0] - c.x - 4));
    if (c.field_prefix === 'age') c.width = 25;
  }
  const have = new Set(rp.columns.map((c) => c.field_prefix));
  for (const col of statusCols()) if (!have.has(col.field_prefix)) rp.columns.push(col);
}

const demoFields = [];
for (const [name, key] of [['race_box', 'race'], ['ethnicity_box', 'ethnicity'], ['marital_box', 'marital']]) {
  const [y, opts] = g[key];
  for (const [val, x] of opts) {
    demoFields.push({ name, type: 'checkbox', page: 1, x, y, width: 9, check_value: val, font_size: 9, label: `${name} ${val}` });
  }
}
for (const name of ['q_sold_assets', 'q_dv']) {
  const q = g[name];
  for (const [val, x] of [['yes', q.yes], ['no', q.no]]) {
    demoFields.push({ name, type: 'checkbox', page: q.page, x, y: q.y, width: 9, check_value: val, font_size: 9, label: `${name} ${val}` });
  }
}
const existing = new Set(map.fields.map((f) => `${f.name}:${f.check_value ?? ''}`));
for (const f of demoFields) if (!existing.has(`${f.name}:${f.check_value}`)) map.fields.push(f);

writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
console.log(`[${lang}] status cols + ${demoFields.length} demographic/Yes-No checkbox fields → ${mapPath}`);
