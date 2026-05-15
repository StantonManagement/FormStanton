CREATE TABLE IF NOT EXISTS public.tenant_idempotency_keys (
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  application_id UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  response_body JSONB NOT NULL,
  response_status INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours',
  PRIMARY KEY (key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_tenant_idempotency_keys_expires
  ON public.tenant_idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_tenant_idempotency_keys_app
  ON public.tenant_idempotency_keys (application_id);

ALTER TABLE public.tenant_idempotency_keys ENABLE ROW LEVEL SECURITY;
