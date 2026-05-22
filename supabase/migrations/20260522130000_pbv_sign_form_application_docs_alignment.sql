-- 20260522130000_pbv_sign_form_application_docs_alignment.sql
--
-- Repairs the federal-form signing path on the PBV full application:
--
-- 1. Backfills `pbv_form_documents.required_signer_member_ids` for in-flight
--    rows that landed with [] under the bug where the array stayed empty.
--    Reads pbv_form_templates.per_person_scope to pick the right signer set:
--
--      submission_level / head_of_household_only  -> [HOH (slot=1)]
--      each_adult / individual                    -> all adults (age >= 18)
--      each_member                                -> all members
--
--    Skips rows already signed (status='signed'/'finalized').
--
-- 2. Backfills `application_documents.status='submitted'` for signed_forms
--    category rows where the matching pbv_form_documents row is already
--    fully signed. This is the dual-write that PRP-023 introduces in
--    completeForm.ts going forward; this migration retro-applies it so
--    existing signed forms unblock finalize.
--
--    NB: PRD-55 renamed `briefing_docs_certification` → `briefing_cert` in
--    pbv_form_templates / pbv_form_documents only; form_document_templates +
--    application_documents.doc_type still use the original. The form_id
--    aliasing is handled in lib/pbv/signing/completeForm.ts (see
--    formIdToDocTypes), not in this migration.
--
-- The fix in generate-forms / completeForm itself is in the application code;
-- this migration handles the data, not the logic.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill pbv_form_documents.required_signer_member_ids where empty.
--    Only touches rows where the array IS empty/NULL and the form is not yet
--    signed. Uses pbv_form_templates.per_person_scope to choose the signers.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. submission_level + head_of_household_only -> HOH (slot=1)
UPDATE public.pbv_form_documents fd
SET required_signer_member_ids = sub.ids
FROM (
  SELECT
    fd2.id AS form_doc_id,
    ARRAY_AGG(m.id ORDER BY m.slot) AS ids
  FROM public.pbv_form_documents fd2
  JOIN public.pbv_form_templates  ft  ON ft.form_id = fd2.form_id
  JOIN public.pbv_household_members m
    ON m.full_application_id = fd2.full_application_id
   AND m.slot = 1
  WHERE ft.per_person_scope IN ('submission_level', 'head_of_household_only')
    AND (fd2.required_signer_member_ids IS NULL
         OR cardinality(fd2.required_signer_member_ids) = 0)
    AND fd2.status NOT IN ('signed', 'finalized', 'skipped')
  GROUP BY fd2.id
) sub
WHERE fd.id = sub.form_doc_id;

-- 1b. each_adult + individual -> all adults (age >= 18)
UPDATE public.pbv_form_documents fd
SET required_signer_member_ids = sub.ids
FROM (
  SELECT
    fd2.id AS form_doc_id,
    ARRAY_AGG(m.id ORDER BY m.slot) AS ids
  FROM public.pbv_form_documents fd2
  JOIN public.pbv_form_templates  ft  ON ft.form_id = fd2.form_id
  JOIN public.pbv_household_members m
    ON m.full_application_id = fd2.full_application_id
   AND COALESCE(m.age, 0) >= 18
  WHERE ft.per_person_scope IN ('each_adult', 'individual')
    AND (fd2.required_signer_member_ids IS NULL
         OR cardinality(fd2.required_signer_member_ids) = 0)
    AND fd2.status NOT IN ('signed', 'finalized', 'skipped')
  GROUP BY fd2.id
) sub
WHERE fd.id = sub.form_doc_id;

-- 1c. each_member -> all members
UPDATE public.pbv_form_documents fd
SET required_signer_member_ids = sub.ids
FROM (
  SELECT
    fd2.id AS form_doc_id,
    ARRAY_AGG(m.id ORDER BY m.slot) AS ids
  FROM public.pbv_form_documents fd2
  JOIN public.pbv_form_templates  ft  ON ft.form_id = fd2.form_id
  JOIN public.pbv_household_members m
    ON m.full_application_id = fd2.full_application_id
  WHERE ft.per_person_scope = 'each_member'
    AND (fd2.required_signer_member_ids IS NULL
         OR cardinality(fd2.required_signer_member_ids) = 0)
    AND fd2.status NOT IN ('signed', 'finalized', 'skipped')
  GROUP BY fd2.id
) sub
WHERE fd.id = sub.form_doc_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Dual-write retro: where a pbv_form_documents row is already fully signed,
--    mark the matching signed_forms-category application_documents row(s) as
--    submitted so finalize Check 4 stops blocking those tenants.
--
--    Mapping rules:
--      - Match by doc_type = pbv_form_documents.form_id (PRD-55 briefing_cert
--        alias also handled, since briefing_cert form_id maps to BOTH
--        briefing_cert and briefing_docs_certification doc_types).
--      - HOH-scope forms (submission_level / head_of_household_only):
--          mark every matching signed_forms application_documents row
--          (any person_slot), since the HOH signs for the family.
--      - Per-person forms (each_adult / individual / each_member):
--          mark only rows whose person_slot is in the collected signer set.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. HOH-scope: any matching signed_forms row gets submitted.
--     The OR-clause picks up PRD-55's briefing_cert ↔ briefing_docs_certification
--     rename (pbv_form_documents.form_id='briefing_cert' vs
--     application_documents.doc_type='briefing_docs_certification').
UPDATE public.application_documents ad
SET status = 'submitted',
    updated_at = NOW()
FROM public.pbv_form_documents fd
JOIN public.pbv_form_templates  ft ON ft.form_id = fd.form_id
WHERE ad.anchor_type = 'pbv_full_application'
  AND ad.anchor_id   = fd.full_application_id
  AND (
        ad.doc_type = fd.form_id
        OR (fd.form_id = 'briefing_cert' AND ad.doc_type = 'briefing_docs_certification')
      )
  AND ad.category    = 'signed_forms'
  AND ad.status      = 'missing'
  AND ft.per_person_scope IN ('submission_level', 'head_of_household_only')
  AND fd.status      IN ('signed', 'finalized');

-- 2b. Per-person scope: match on (doc_type, person_slot)
UPDATE public.application_documents ad
SET status = 'submitted',
    updated_at = NOW()
FROM public.pbv_form_documents fd
JOIN public.pbv_form_templates  ft ON ft.form_id = fd.form_id
JOIN public.pbv_household_members m
  ON m.full_application_id = fd.full_application_id
 AND m.id = ANY(fd.collected_signer_member_ids)
WHERE ad.anchor_type = 'pbv_full_application'
  AND ad.anchor_id   = fd.full_application_id
  AND (
        ad.doc_type = fd.form_id
        OR (fd.form_id = 'briefing_cert' AND ad.doc_type = 'briefing_docs_certification')
      )
  AND ad.category    = 'signed_forms'
  AND ad.status      = 'missing'
  AND ad.person_slot = m.slot
  AND ft.per_person_scope IN ('each_adult', 'individual', 'each_member')
  AND fd.status      IN ('signed', 'finalized');

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after applying):
--
--   -- expect 0 rows for unsigned, non-skipped, in-flight applications
--   SELECT fd.full_application_id, fd.form_id, fd.status,
--          cardinality(fd.required_signer_member_ids) AS req_count
--   FROM public.pbv_form_documents fd
--   WHERE fd.status NOT IN ('signed', 'finalized', 'skipped')
--     AND (fd.required_signer_member_ids IS NULL
--          OR cardinality(fd.required_signer_member_ids) = 0);
--
--   -- expect 0 stragglers: signed pbv_form_documents whose application_documents
--   -- signed_forms rows are still 'missing'
--   SELECT fd.full_application_id, fd.form_id,
--          COUNT(ad.id) AS missing_app_docs
--   FROM public.pbv_form_documents fd
--   JOIN public.application_documents ad
--     ON ad.anchor_type = 'pbv_full_application'
--    AND ad.anchor_id   = fd.full_application_id
--    AND ad.doc_type    = fd.form_id
--    AND ad.category    = 'signed_forms'
--    AND ad.status      = 'missing'
--   WHERE fd.status IN ('signed', 'finalized')
--   GROUP BY fd.full_application_id, fd.form_id;
-- ─────────────────────────────────────────────────────────────────────────────
