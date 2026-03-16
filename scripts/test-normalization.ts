import { normalizeAddress } from '../lib/addressNormalizer';

console.log('=== ADDRESS NORMALIZATION TESTS ===\n');

const addressTests = [
  // First-pass fixes
  { addr1: '93-95 Maple Ave', addr2: '93 Maple Avenue Hartford, CT 06114', label: 'adger - Maple range + city strip' },
  { addr1: '178 Affleck St', addr2: '178 Affleck Hartford, CT 06106', label: 'aguilar - missing St suffix' },
  { addr1: '213-217 Buckingham St', addr2: '213-217 Buckingham St Hartford, CT 06106', label: 'alberto - city strip' },
  { addr1: '36 Whitmore Street', addr2: '36 Whitmore Street Hartford, CT 06114', label: 'allen - Street abbrev + city strip' },
  { addr1: '152-154 Wooster St', addr2: '152-154 Wooster St Hartford, CT 06120', label: 'schuler - city strip' },
  // Second-pass fixes
  { addr1: '1721-1739 Main St', addr2: '1721 - 1739 Main St Hartford, CT 06120', label: 'harris - dash spacing + city strip' },
  { addr1: '228 Maple Ave', addr2: '228-230 Maple Avenue Hartford, CT 06114', label: 'outlaw - building alias 228-230' },
  // Building variations
  { addr1: '97-103 Maple Ave', addr2: '99 Maple Ave', label: 'Maple 99 -> 97-103' },
  { addr1: '97-103 Maple Ave', addr2: '101 Maple Ave', label: 'Maple 101 -> 97-103' },
];

let allPass = true;
for (const { addr1, addr2, label } of addressTests) {
  const norm1 = normalizeAddress(addr1).toLowerCase();
  const norm2 = normalizeAddress(addr2).toLowerCase();
  const match = norm1 === norm2;
  if (!match) allPass = false;
  console.log(`${match ? '✅' : '❌'} ${label}: "${norm1}" vs "${norm2}"`);
}

console.log('\n=== NAME NORMALIZATION TESTS ===\n');

function normalizeNameForKey(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[,.']/g, '').split(/\s+/).filter(p => p.length > 0).sort().join(' ');
}

const nameTests = [
  { name1: 'Harris, Lawanne', name2: 'Lawanne harris', label: 'last-first vs first-last' },
  { name1: 'Allen , Shaneequa S.', name2: 'Allen , Shaneequa S.', label: 'same name (self-match)' },
  { name1: 'Schuler, Leondard', name2: 'Schuler, Leondard', label: 'exact same (no change)' },
];

for (const { name1, name2, label } of nameTests) {
  const norm1 = normalizeNameForKey(name1);
  const norm2 = normalizeNameForKey(name2);
  const match = norm1 === norm2;
  if (!match) allPass = false;
  console.log(`${match ? '✅' : '❌'} ${label}: "${norm1}" vs "${norm2}"`);
}

console.log(`\n=== ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`);

