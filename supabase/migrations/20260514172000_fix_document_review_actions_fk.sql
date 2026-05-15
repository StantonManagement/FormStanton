-- Fix foreign key reference in document_review_actions
-- References form_submission_documents which was renamed to application_documents

-- Drop existing FK if it references the wrong table
ALTER TABLE public.document_review_actions 
DROP CONSTRAINT IF EXISTS document_review_actions_document_id_fkey;

-- Add correct FK reference to application_documents
ALTER TABLE public.document_review_actions 
ADD CONSTRAINT document_review_actions_document_id_fkey 
FOREIGN KEY (document_id) REFERENCES public.application_documents(id) ON DELETE CASCADE;
