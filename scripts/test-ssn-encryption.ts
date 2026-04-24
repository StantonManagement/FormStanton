/**
 * Test: SSN encryption round-trip and edge cases.
 * Run with: npx ts-node scripts/test-ssn-encryption.ts
 *
 * All SSNs in this file are fake (XXX-XX-XXXX format).
 * Never use real SSNs in test fixtures.
 */

import { encryptSsn, decryptSsn, ssnLastFour } from '../lib/ssnEncryption';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    failed++;
  }
}

function assertThrows(description: string, fn: () => unknown): void {
  try {
    fn();
    console.error(`  ✗ FAIL: ${description} — expected throw but did not throw`);
    failed++;
  } catch {
    console.log(`  ✓ ${description}`);
    passed++;
  }
}

// ── Setup: inject a test key ──────────────────────────────────────────────────
const TEST_KEY = 'a'.repeat(64); // valid 64-char hex string (all 0xaa bytes)
const WRONG_KEY = 'b'.repeat(64);

process.env.PBV_SSN_ENCRYPTION_KEY = TEST_KEY;

// ── Suite 1: Round-trip ───────────────────────────────────────────────────────
console.log('\nSuite 1: Round-trip encrypt/decrypt');

const fakeSsn1 = '123-45-6789';
const ct1 = encryptSsn(fakeSsn1);
assert('Ciphertext is a string', typeof ct1 === 'string');
assert('Ciphertext has three colon-separated segments', ct1.split(':').length === 3);
assert('Ciphertext does not contain the plaintext SSN', !ct1.includes('123456789') && !ct1.includes('123-45-6789'));
assert('Decrypted value matches original', decryptSsn(ct1) === fakeSsn1);

const fakeSsn2 = '987654321'; // raw digits, no dashes
const ct2 = encryptSsn(fakeSsn2);
assert('Round-trip works for raw-digit SSN', decryptSsn(ct2) === fakeSsn2);

// ── Suite 2: Each encryption produces a unique ciphertext ─────────────────────
console.log('\nSuite 2: IV uniqueness');

const ct3 = encryptSsn(fakeSsn1);
const ct4 = encryptSsn(fakeSsn1);
assert('Two encryptions of the same SSN produce different ciphertexts (random IV)', ct3 !== ct4);
assert('Both can be decrypted to the same plaintext', decryptSsn(ct3) === decryptSsn(ct4));

// ── Suite 3: Auth tag rejects wrong key ───────────────────────────────────────
console.log('\nSuite 3: Wrong-key rejection');

const ctGood = encryptSsn('555-12-3456');
process.env.PBV_SSN_ENCRYPTION_KEY = WRONG_KEY;
assertThrows('Decrypting with wrong key throws', () => decryptSsn(ctGood));
process.env.PBV_SSN_ENCRYPTION_KEY = TEST_KEY; // restore

// ── Suite 4: Tampered ciphertext rejected ─────────────────────────────────────
console.log('\nSuite 4: Tampered ciphertext');

const ctValid = encryptSsn('111-22-3333');
const tampered = ctValid.slice(0, -4) + 'ffff'; // flip last 4 hex chars
assertThrows('Tampered ciphertext throws on decrypt', () => decryptSsn(tampered));
assertThrows('Malformed ciphertext (no colons) throws', () => decryptSsn('notvalidatall'));

// ── Suite 5: ssnLastFour ──────────────────────────────────────────────────────
console.log('\nSuite 5: ssnLastFour');

assert('Extracts last 4 from formatted SSN', ssnLastFour('123-45-6789') === '6789');
assert('Extracts last 4 from raw digits', ssnLastFour('123456789') === '6789');
assert('Works on exactly 4 digits', ssnLastFour('1234') === '1234');
assertThrows('Throws on fewer than 4 digits', () => ssnLastFour('123'));

// ── Suite 6: Key validation ───────────────────────────────────────────────────
console.log('\nSuite 6: Key validation');

const savedKey = process.env.PBV_SSN_ENCRYPTION_KEY;
process.env.PBV_SSN_ENCRYPTION_KEY = '';
assertThrows('Empty key throws', () => encryptSsn('000-00-0000'));
process.env.PBV_SSN_ENCRYPTION_KEY = 'tooshort';
assertThrows('Short key throws', () => encryptSsn('000-00-0000'));
process.env.PBV_SSN_ENCRYPTION_KEY = savedKey;

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
