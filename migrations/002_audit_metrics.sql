-- Migration 002: Audit Metrics (Cost Tracking + Evaluation)
-- This table tracks per-audit cost and quality metrics without modifying existing tables

CREATE TABLE IF NOT EXISTS audit_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id text,
  
  -- Cost tracking
  provider text NOT NULL,
  model text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric(10, 6) DEFAULT 0,
  
  -- Latency tracking
  latency_ms integer DEFAULT 0,
  
  -- Evaluation metrics
  issues_found integer DEFAULT 0,
  high_severity_count integer DEFAULT 0,
  medium_severity_count integer DEFAULT 0,
  low_severity_count integer DEFAULT 0,
  
  -- Source breakdown
  ai_vision_issues integer DEFAULT 0,
  ai_code_issues integer DEFAULT 0,
  lighthouse_issues integer DEFAULT 0,
  static_analyzer_issues integer DEFAULT 0,
  rule_based_issues integer DEFAULT 0,
  
  -- Audit quality
  frontend_score integer,
  backend_score integer,
  launch_score integer,
  verdict text,
  
  -- Metadata
  analysis_mode text,
  has_screenshots boolean DEFAULT false,
  has_github_code boolean DEFAULT false,
  fetch_duration_ms integer DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_metrics_audit_id ON audit_metrics(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_metrics_user_id ON audit_metrics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_metrics_provider ON audit_metrics(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_metrics_created_at ON audit_metrics(created_at DESC);

-- Aggregate view for dashboard
CREATE OR REPLACE VIEW audit_metrics_summary AS
SELECT
  user_id,
  provider,
  DATE(created_at) as audit_date,
  COUNT(*) as total_audits,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost_usd) as total_cost_usd,
  AVG(latency_ms) as avg_latency_ms,
  AVG(launch_score) as avg_launch_score,
  AVG(frontend_score) as avg_frontend_score,
  AVG(backend_score) as avg_backend_score,
  SUM(issues_found) as total_issues,
  SUM(high_severity_count) as total_high_severity,
  SUM(medium_severity_count) as total_medium_severity,
  SUM(low_severity_count) as total_low_severity,
  COUNT(CASE WHEN verdict = 'launch-ready' THEN 1 END) as launch_ready_count,
  COUNT(CASE WHEN verdict = 'needs-fixes' THEN 1 END) as needs_fixes_count,
  COUNT(CASE WHEN verdict = 'broken' THEN 1 END) as broken_count
FROM audit_metrics
GROUP BY user_id, provider, DATE(created_at);
