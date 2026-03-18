-- Create storage bucket for project evidence uploads (tenant task completions)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-evidence', 'project-evidence', true)
ON CONFLICT (id) DO NOTHING;
