/**
 * PRP-019 — Data-lifecycle endpoint + policy presence tests.
 *
 * The DELETE route is full of supabase round-trips; testing the runtime
 * here requires an entire mock harness. We pin the contract via
 * source-grep and assert the policy doc exists with the required
 * sections.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const routePath = join(
  process.cwd(),
  'app',
  'api',
  'admin',
  'pbv',
  'full-applications',
  '[id]',
  'data',
  'route.ts'
);

describe('PRP-019 / G3 — anonymize route source contract', () => {
  const src = readFileSync(routePath, 'utf8');

  it('exports DELETE (no GET / POST escape hatches that could read PII)', () => {
    expect(src).toMatch(/export\s+async\s+function\s+DELETE/);
    expect(src).not.toMatch(/export\s+async\s+function\s+GET/);
    expect(src).not.toMatch(/export\s+async\s+function\s+POST/);
  });

  it("calls requirePermission(RESOURCES.PBV_FULL_APPLICATIONS, 'delete')", () => {
    expect(src).toMatch(/requirePermission\(\s*RESOURCES\.PBV_FULL_APPLICATIONS\s*,\s*['"]delete['"]\s*\)/);
  });

  it('requires { confirm: "ANONYMIZE" } in body', () => {
    expect(src).toMatch(/confirm\s*!==\s*['"]ANONYMIZE['"]/);
    expect(src).toMatch(/confirm_required/);
  });

  it('scrubs head_of_household_name + nulls phone / email / mailing_address / intake_data', () => {
    expect(src).toMatch(/head_of_household_name:\s*ANONYMIZED_NAME/);
    expect(src).toMatch(/phone:\s*null/);
    expect(src).toMatch(/email:\s*null/);
    expect(src).toMatch(/mailing_address:\s*null/);
    expect(src).toMatch(/intake_data:\s*null/);
  });

  it('scrubs household-member rows', () => {
    expect(src).toMatch(/from\(['"]pbv_household_members['"]\)/);
    expect(src).toMatch(/name:\s*ANONYMIZED_NAME/);
    expect(src).toMatch(/dob:\s*null/);
    expect(src).toMatch(/ssn_last_four:\s*null/);
  });

  it('tombstones signature_image_path but preserves the event rows', () => {
    expect(src).toMatch(/signature_image_path:\s*ANONYMIZED_TS/);
    // We do not delete pbv_signature_events rows.
    expect(src).not.toMatch(/\.delete\(\)[\s\S]{0,200}from\(['"]pbv_signature_events['"]\)/);
  });

  it('emits a pbv_application_data_anonymized application-event', () => {
    expect(src).toMatch(/pbv_application_data_anonymized/);
  });

  it('is idempotent: short-circuits when head_of_household_name is already [ANONYMIZED]', () => {
    expect(src).toMatch(/head_of_household_name === ANONYMIZED_NAME/);
    expect(src).toMatch(/already_anonymized:\s*true/);
  });
});

describe('PRP-019 / G5 — data-retention policy doc', () => {
  const policyPath = join(process.cwd(), 'docs', 'data-retention-policy.md');

  it('exists', () => {
    expect(existsSync(policyPath)).toBe(true);
  });

  const doc = readFileSync(policyPath, 'utf8');
  it('states the TBD retention period decision is pending HACH', () => {
    expect(doc).toMatch(/TBD.+confirm with HACH/i);
  });
  it('documents the Layer-1 anonymization endpoint', () => {
    expect(doc).toMatch(/DELETE\s+\/api\/admin\/pbv\/full-applications\/\[id\]\/data/);
  });
  it('documents the Storage-lifecycle cron follow-up', () => {
    expect(doc).toMatch(/Storage-lifecycle/);
  });
});

describe('PRP-019 / G4 — audit hash chain documented as v1.1 gap', () => {
  const doc = readFileSync(join(process.cwd(), 'docs', 'data-retention-policy.md'), 'utf8');
  it('documents the event_hash chain design', () => {
    expect(doc).toMatch(/event_hash/);
    expect(doc).toMatch(/prev_event_hash/);
    expect(doc).toMatch(/sha256/);
  });
  it('marks G4 as a known v1.1 gap (deferred per scope call)', () => {
    expect(doc).toMatch(/known v1\.1 gap/i);
  });
});
