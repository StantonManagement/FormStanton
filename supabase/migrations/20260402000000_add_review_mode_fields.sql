-- Add failure_reasons to task_types for predefined fail options
ALTER TABLE task_types ADD COLUMN failure_reasons TEXT[] DEFAULT '{}';

-- Add reviewer_notes to task_completions for internal staff notes
ALTER TABLE task_completions ADD COLUMN reviewer_notes TEXT;

-- Add comment for clarity
COMMENT ON COLUMN task_types.failure_reasons IS 'Array of predefined failure reason strings for staff to select when failing a task. "Other" is always implicitly available.';
COMMENT ON COLUMN task_completions.reviewer_notes IS 'Internal-only staff notes, never shown to tenant. Separate from failure_reason which is tenant-facing.';
