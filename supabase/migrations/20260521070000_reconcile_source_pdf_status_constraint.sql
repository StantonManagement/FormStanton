-- Reconcile pbv_form_templates.source_pdf_status to canonical vocabulary
-- Date: 2026-05-21
--
-- Context: PRD-55b patched 'ready' in-place due to a live constraint that had
-- drifted to ('ready','pending','deprecated') by hand (no migration). The
-- table-defining migration (20260515040000) and the TS type both use the
-- original design: ('pending','sourced','verified').
--
-- This migration:
-- 1. Drops the drifted constraint
-- 2. Normalizes 'ready' rows to 'sourced' (the PRD-55b patch values)
-- 3. Re-asserts the canonical CHECK constraint
--
-- Safe on existing rows: the UPDATE runs while the constraint is dropped.
-- On a fresh env: the constraint from 20260515040000 is already canonical,
-- but this migration is idempotent (DROP IF EXISTS + re-ADD).

-- 1. Drop the drifted constraint
ALTER TABLE public.pbv_form_templates
  DROP CONSTRAINT IF EXISTS pbv_form_templates_source_pdf_status_check;

-- 2. Normalize 'ready' (from PRD-55b patch) to 'sourced' (canonical)
UPDATE public.pbv_form_templates
  SET source_pdf_status = 'sourced'
  WHERE source_pdf_status = 'ready';

-- 3. Re-assert the canonical constraint
ALTER TABLE public.pbv_form_templates
  ADD CONSTRAINT pbv_form_templates_source_pdf_status_check
  CHECK (source_pdf_status IN ('pending','sourced','verified'));
