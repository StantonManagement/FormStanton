/**
 * Regenerate the main_application income table as per-income-type row_patterns,
 * for EN or ES. Replaces the single sequential "income" row_pattern with one small
 * row_pattern per labeled form row group. Baselines verified against the matching
 * assets/pbv-source-pdfs/main-application-<lang>.pdf (see field-audit).
 *
 *   node scripts/_gen_income_rows.mjs <map.json> <en|es>
 */
import { readFileSync, writeFileSync } from 'fs';

const mapPath = process.argv[2];
const lang = process.argv[3] ?? 'en';

// [data_key, first-row baseline (pdf-lib y), row count]. Multi-row groups are ~23.4-23.5pt apart.
const BASELINES = {
  en: [
    ['income_employment', 872.8, 3], ['income_pension', 802.3, 1], ['income_ssi', 776.5, 2],
    ['income_ss', 731.5, 2], ['income_child_support', 663.1, 1], ['income_tanf', 628.1, 1],
    ['income_snap', 608.8, 1], ['income_self_employment', 587.6, 1], ['income_unemployment', 564.1, 2],
    ['income_workers_comp', 518.3, 1], ['income_rental', 495.7, 1], ['income_gifts', 469.9, 1],
    ['income_digital_wallet', 373.1, 1], ['income_other', 347.3, 1],
  ],
  es: [
    ['income_employment', 853.3, 3], ['income_pension', 782.8, 1], ['income_ssi', 756.7, 2],
    ['income_ss', 709.7, 2], ['income_child_support', 637.0, 1], ['income_tanf', 598.4, 1],
    ['income_snap', 574.9, 1], ['income_self_employment', 549.3, 1], ['income_unemployment', 514.2, 2],
    ['income_workers_comp', 468.3, 1], ['income_rental', 442.4, 1], ['income_gifts', 404.1, 1],
    ['income_digital_wallet', 319.8, 1], ['income_other', 294.0, 1],
  ],
};
// Income-table column x. Columns align within ~3pt across EN/ES; Yes cell is identical.
const COLS = {
  en: { member: 191.87, source: 320.39, amount: 397.8 },
  es: { member: 193, source: 320.4, amount: 399 },
};
const PITCH = lang === 'es' ? 23.5 : 23.4;

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const cx = COLS[lang];
const columns = () => [
  { field_prefix: 'yes', type: 'checkbox', x: 131, y_offset: 2, check_value: 'X', font_size: 9, label: 'Yes' },
  { field_prefix: 'member', type: 'text', x: cx.member, y_offset: 5, width: 120, font_size: 7, label: 'Family Member' },
  { field_prefix: 'source', type: 'text', x: cx.source, y_offset: 5, width: 70, font_size: 7, label: 'Source' },
  { field_prefix: 'amount', type: 'text', x: cx.amount, y_offset: 5, width: 65, font_size: 7, label: 'Amount per Month' },
];

const incomePatterns = BASELINES[lang].map(([key, y, n]) => ({
  id: key, page: 2, data_key: key, max_rows: n, row_start_y: y, row_pitch: PITCH, columns: columns(),
}));

const kept = map.row_patterns.filter((rp) => rp.id !== 'income' && !rp.id.startsWith('income_'));
const minorsIdx = kept.findIndex((rp) => rp.id === 'minors');
const insertAt = minorsIdx >= 0 ? minorsIdx + 1 : kept.length;
map.row_patterns = [...kept.slice(0, insertAt), ...incomePatterns, ...kept.slice(insertAt)];

writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
console.log(`[${lang}] Wrote ${incomePatterns.length} income row_patterns into ${mapPath}`);
