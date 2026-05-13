-- Drop FK constraints that incorrectly bind HACH and shared message author_user_id to admin_users.
-- HACH users do not exist in admin_users. author_display_name is the identity snapshot at write time.
-- workspace_read_receipts.user_id also drops its admin_users FK so HACH users can upsert read receipts.
--
-- Rollback (not recommended — FK target would still be wrong for HACH users):
--   ALTER TABLE public.hach_workspace_messages
--     ADD CONSTRAINT hach_workspace_messages_author_user_id_fkey
--     FOREIGN KEY (author_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;
--   ALTER TABLE public.shared_workspace_messages
--     ADD CONSTRAINT shared_workspace_messages_author_user_id_fkey
--     FOREIGN KEY (author_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;
--   ALTER TABLE public.workspace_read_receipts
--     ADD CONSTRAINT workspace_read_receipts_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;

ALTER TABLE public.hach_workspace_messages
  DROP CONSTRAINT IF EXISTS hach_workspace_messages_author_user_id_fkey;

ALTER TABLE public.shared_workspace_messages
  DROP CONSTRAINT IF EXISTS shared_workspace_messages_author_user_id_fkey;

ALTER TABLE public.workspace_read_receipts
  DROP CONSTRAINT IF EXISTS workspace_read_receipts_user_id_fkey;

COMMENT ON COLUMN public.hach_workspace_messages.author_user_id IS
  'UUID of the authoring user. No FK — may be an admin_users.id (Stanton) or a HACH auth user id. '
  'author_display_name is the identity snapshot for display purposes.';

COMMENT ON COLUMN public.shared_workspace_messages.author_user_id IS
  'UUID of the authoring user. No FK — may be admin_users.id or HACH auth user id. '
  'author_display_name is the identity snapshot.';

COMMENT ON COLUMN public.workspace_read_receipts.user_id IS
  'UUID of the user. No FK — accommodates both Stanton (admin_users) and HACH auth user ids.';
