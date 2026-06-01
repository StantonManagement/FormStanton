-- Allow a PBV pre-application to be deleted even after it has spawned a full
-- application. Previously pbv_full_applications.preapp_id was ON DELETE NO
-- ACTION, so deleting a pre-app that had progressed to a full application
-- failed with a foreign-key violation ("delete doesn't work" in the admin UI).
--
-- Per product decision (2026-06-01): deleting a pre-app should cascade-delete
-- its full application and ALL downstream data. Most of the full-application
-- subtree already cascades; this migration converts the remaining links that
-- would otherwise block the cascade.
--
-- Links converted to ON DELETE CASCADE:
--   1. pbv_full_applications.preapp_id            (was NO ACTION) -- the top-level blocker
--   2. pbv_document_requirements.full_application_id (was NO ACTION)
--   3. pbv_signature_audit_log.application_id     (was NO ACTION)
--   4. tenant_notifications.application_id        (was RESTRICT)
--   5. pbv_signature_audit_log.member_id          (was NO ACTION; column is NOT NULL so cannot SET NULL)
--   6. signature_capture_audit.packet_signature_id (was RESTRICT)
-- Converted to ON DELETE SET NULL (secondary audit cross-link, column nullable):
--   7. document_review_actions.notification_id    (was NO ACTION)

BEGIN;

-- 1. pbv_full_applications -> pbv_preapplications
ALTER TABLE public.pbv_full_applications
  DROP CONSTRAINT pbv_full_applications_preapp_id_fkey,
  ADD CONSTRAINT pbv_full_applications_preapp_id_fkey
    FOREIGN KEY (preapp_id) REFERENCES public.pbv_preapplications(id) ON DELETE CASCADE;

-- 2. pbv_document_requirements -> pbv_full_applications
ALTER TABLE public.pbv_document_requirements
  DROP CONSTRAINT pbv_document_requirements_full_application_id_fkey,
  ADD CONSTRAINT pbv_document_requirements_full_application_id_fkey
    FOREIGN KEY (full_application_id) REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE;

-- 3. pbv_signature_audit_log.application_id -> pbv_full_applications
ALTER TABLE public.pbv_signature_audit_log
  DROP CONSTRAINT pbv_signature_audit_log_application_id_fkey,
  ADD CONSTRAINT pbv_signature_audit_log_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE;

-- 4. tenant_notifications.application_id -> pbv_full_applications
ALTER TABLE public.tenant_notifications
  DROP CONSTRAINT tenant_notifications_application_id_fkey,
  ADD CONSTRAINT tenant_notifications_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE;

-- 5. pbv_signature_audit_log.member_id -> pbv_household_members (NOT NULL: cascade)
ALTER TABLE public.pbv_signature_audit_log
  DROP CONSTRAINT pbv_signature_audit_log_member_id_fkey,
  ADD CONSTRAINT pbv_signature_audit_log_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES public.pbv_household_members(id) ON DELETE CASCADE;

-- 6. signature_capture_audit.packet_signature_id -> packet_signatures
ALTER TABLE public.signature_capture_audit
  DROP CONSTRAINT signature_capture_audit_packet_signature_id_fkey,
  ADD CONSTRAINT signature_capture_audit_packet_signature_id_fkey
    FOREIGN KEY (packet_signature_id) REFERENCES public.packet_signatures(id) ON DELETE CASCADE;

-- 7. document_review_actions.notification_id -> tenant_notifications (nullable: set null)
ALTER TABLE public.document_review_actions
  DROP CONSTRAINT document_review_actions_notification_id_fkey,
  ADD CONSTRAINT document_review_actions_notification_id_fkey
    FOREIGN KEY (notification_id) REFERENCES public.tenant_notifications(id) ON DELETE SET NULL;

COMMIT;
