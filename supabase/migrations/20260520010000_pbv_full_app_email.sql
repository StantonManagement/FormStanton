-- PRD-53 follow-up: full app needs email to receive propagated value from preapp
ALTER TABLE pbv_full_applications
ADD COLUMN IF NOT EXISTS email TEXT;
