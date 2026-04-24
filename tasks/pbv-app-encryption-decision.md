# PBV Application Layer — SSN Encryption Decision

**Date:** April 23, 2026  
**Phase:** 2 — Data Layer  
**Decision:** Application-level AES-256-GCM

---

## The Question

The PRD offers two options for encrypting Social Security Numbers stored in `pbv_household_members.ssn_encrypted`:

1. **Supabase pgsodium** — Transparent Column Encryption (TCE) or manual `crypto_secretbox`
2. **Application-level AES-GCM** — encrypt before insert, decrypt after fetch, key in environment

---

## Options Evaluated

### Option A: Supabase pgsodium / TCE

pgsodium provides column-level encryption managed entirely inside Postgres. With TCE, a "key ID" is stored in the column definition, and Supabase Vault manages the root key. The column value is automatically encrypted/decrypted at the Postgres layer.

**Why not chosen:**

- **Plan requirement.** TCE is a Supabase Pro feature. The project is on Free tier as of this writing; upgrading would need Alex's decision before Phase 2 can ship.
- **Tooling maturity.** pgsodium TCE is available but sparsely documented for Next.js + service_role patterns. The read-back pattern (`supabase.rpc('pgsodium.crypto_aead_det_decrypt', ...)`) is non-standard and error-prone.
- **Decryption at DB boundary.** If the Supabase service_role key leaks, decrypted SSNs are exposed in the raw query results. There is no additional application-layer guard. With application-level encryption, a service_role leak alone is not sufficient — the attacker would also need the `PBV_SSN_ENCRYPTION_KEY`.
- **Key rotation complexity.** Rotating a pgsodium key requires re-encryption of all rows inside Postgres with no easy rollback path.
- **Local testing.** pgsodium is unavailable in the local Supabase docker stack for most setups, making test scripts difficult without a live project.

### Option B: Application-level AES-256-GCM ✅ Chosen

Encryption happens in `lib/ssnEncryption.ts` before the row is inserted. Decryption happens after the row is fetched. The key lives in `process.env.PBV_SSN_ENCRYPTION_KEY`. The column stores an opaque string.

**Why chosen:**

- **Works on any Supabase plan.** No infrastructure changes.
- **Defense in depth.** A service_role key leak alone does not expose SSNs — the attacker also needs the app-server key. The two secrets are in different environments (Supabase Vault vs. Vercel env).
- **Testable locally.** Node.js `crypto` is available everywhere; test scripts run without a live DB.
- **Standard and auditable.** AES-256-GCM is NIST-approved. IV + AuthTag + Ciphertext pattern is well-understood and peer-reviewable.
- **No external dependency.** Uses Node.js built-in `crypto` only — no new package.
- **Simple key rotation.** Re-encrypt affected rows in a migration script with the new key; no Postgres involvement.
- **Search requirement is satisfied.** `ssn_last_four` (plaintext) handles the only search/display use case. Full SSN is never searched.

---

## Implementation

**File:** `lib/ssnEncryption.ts`

**Algorithm:** AES-256-GCM  
**Key size:** 256 bits (32 bytes) — stored as 64 hex characters in `PBV_SSN_ENCRYPTION_KEY`  
**IV:** 96 bits (12 bytes) — randomly generated per encryption call  
**Auth tag:** 128 bits (16 bytes) — GCM default  

**Ciphertext storage format:** `{iv_hex}:{authTag_hex}:{ciphertext_hex}` — colon-separated hex strings in a single TEXT column.

**Key env var:** `PBV_SSN_ENCRYPTION_KEY`  
Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Sensitive Data Rules Satisfied

- Full SSN is never stored in plaintext anywhere.
- `ssn_last_four` is derived at intake and stored plaintext — safe for display; cannot reconstruct full SSN.
- Every server-side call to `decryptSsn()` must also write a row to `pbv_access_log` identifying the reader. This is enforced by convention in Phase 7's role-gated access layer; Phase 2 only provides the primitive.
- The ciphertext column is never logged, never included in error messages, never exported in audit reports.
- Test scripts in `scripts/test-ssn-encryption.ts` use fake SSNs (`XXX-XX-1234` format) only.

---

## Key Rotation Procedure (for reference)

If `PBV_SSN_ENCRYPTION_KEY` needs to be rotated:

1. Generate a new key.
2. Write a one-time migration script:
   - Fetch all `pbv_household_members` rows where `ssn_encrypted IS NOT NULL`.
   - Decrypt each with the old key.
   - Re-encrypt with the new key.
   - Batch-update rows.
3. Deploy the script and new env var together in a single deployment.
4. Verify round-trip on a sample row before discarding the old key.
5. Retain the old key in a secrets manager for the retention window in case of rollback.
