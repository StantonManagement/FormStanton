-- Migration: PBV Application Reminder Schedule Columns
-- Adds columns for tracking deferred document reminder scheduling
-- Part of PRD-43: Tenant Outbound Comms

-- Add reminder scheduling columns to pbv_full_applications
ALTER TABLE pbv_full_applications 
ADD COLUMN next_reminder_scheduled_at TIMESTAMPTZ NULL,
ADD COLUMN reminders_sent_count INTEGER NOT NULL DEFAULT 0;

-- Add index for efficient cron queries
CREATE INDEX idx_pbv_applications_next_reminder_scheduled_at 
ON pbv_full_applications (next_reminder_scheduled_at) 
WHERE next_reminder_scheduled_at IS NOT NULL;
