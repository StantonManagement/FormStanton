-- Migration: Add file_hash column for PRD-41 F1 (Hash-based deduplication)
-- Date: 2026-05-17

-- Add file_hash column to application_documents
ALTER TABLE application_documents
  ADD COLUMN file_hash TEXT NULL;

-- Create index for efficient dedup lookups by anchor_id + hash
CREATE INDEX idx_application_documents_file_hash
  ON application_documents (anchor_id, file_hash)
  WHERE file_hash IS NOT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN application_documents.file_hash
  IS 'SHA-256 hex of uploaded file content. Used for dedup detection across slots on the same application.';
