CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  launch_score integer NOT NULL,
  verdict text,
  summary text,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvement_prompt text,
  analysis_mode text,
  provider text,
  lighthouse jsonb,
  backend_metrics jsonb,
  warning text,
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_url_created_at ON audits(url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_user_id_created_at ON audits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY,
  vision_provider text DEFAULT 'default',
  vision_api_key_encrypted text,
  code_provider text DEFAULT 'default',
  code_api_key_encrypted text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_time bigint NOT NULL
);
