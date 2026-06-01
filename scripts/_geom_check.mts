/** Run the self-contained geometric validators on a field map (no pdfjs needed). */
import { readFileSync } from 'fs';
import { runGeometricValidators } from '@/lib/field-map-authoring/geometric';
import type { FieldMap, PageBox } from '@/lib/field-map-authoring/types';

const mapPath = process.argv[2];
const w = Number(process.argv[3] ?? 612);
const h = Number(process.argv[4] ?? 1008);
const nPages = Number(process.argv[5] ?? 5);

const map = JSON.parse(readFileSync(mapPath, 'utf8')) as FieldMap;
const pages: PageBox[] = Array.from({ length: nPages }, (_, i) => ({ page: i + 1, width: w, height: h }));
const findings = runGeometricValidators(map, pages);

console.log(`[geom] ${mapPath}: ${findings.length} finding(s)`);
for (const f of findings) console.log(`  [${f.kind}] ${f.field} :: ${f.reason}`);
