/**
 * Add the page-4 itemized household-expenses table placements (22 categories ×
 * {amount, who-pays} = 44 flat fields) to the main_application map, EN or ES.
 * Resolver emits exp_<key>_amount / exp_<key>_who. Non-uniform row pitch → flat
 * fields, not a row_pattern. Coords verified against the source PDF.
 *
 *   node scripts/_gen_expenses.mjs <map.json> <en|es>
 */
import { readFileSync, writeFileSync } from 'fs';

const mapPath = process.argv[2];
const lang = process.argv[3] ?? 'en';

// Category keys in form-row order (top→bottom), left column then right column.
const LEFT = ['rent', 'light', 'gas_oil', 'water', 'vehicle_payment', 'vehicle_insurance', 'cable_internet', 'phone_home', 'phone_cell', 'child_care', 'furniture_rental'];
const RIGHT = ['groceries_cash', 'takeout', 'paper_products', 'grooming', 'cleaning_laundry', 'gas_vehicle', 'clothing', 'entertainment', 'public_transit', 'jewelry', 'household_items'];

const GEO = {
  en: {
    baselines: [814.4, 795.4, 776.6, 755.4, 734.2, 714.8, 693.2, 669.8, 648.2, 624.8, 601.4],
    left: { amount: 207, who: 261 }, right: { amount: 470, who: 524 },
  },
  es: {
    baselines: [812.7, 793.8, 774.9, 753.7, 732.4, 711.3, 689.7, 666.3, 644.7, 621.3, 597.9],
    left: { amount: 205, who: 258 }, right: { amount: 468, who: 525 },
  },
};
const g = GEO[lang];

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const fields = [];
const addRow = (key, y, col) => {
  fields.push({ name: `exp_${key}_amount`, type: 'text', page: 4, x: col.amount, y, width: 45, font_size: 7, label: `${key} amount` });
  fields.push({ name: `exp_${key}_who`, type: 'text', page: 4, x: col.who, y, width: 50, font_size: 7, label: `${key} who pays` });
};
LEFT.forEach((key, i) => addRow(key, g.baselines[i], g.left));
RIGHT.forEach((key, i) => addRow(key, g.baselines[i], g.right));

const have = new Set(map.fields.map((f) => f.name));
let added = 0;
for (const f of fields) if (!have.has(f.name)) { map.fields.push(f); added++; }

writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n');
console.log(`[${lang}] added ${added} expense fields → ${mapPath}`);
