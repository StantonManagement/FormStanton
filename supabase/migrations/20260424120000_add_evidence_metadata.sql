ALTER TABLE task_completions
ADD COLUMN IF NOT EXISTS evidence_metadata JSONB;
