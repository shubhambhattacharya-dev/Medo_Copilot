/**
 * Audit Metrics Database Operations
 * Stores cost and evaluation metrics without modifying existing audit table
 */

import { neon } from "@neondatabase/serverless";
import { getServerEnv } from "./env";

export interface AuditMetricRow {
  id: string;
  audit_id: string;
  user_id: string | null;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  issues_found: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  ai_vision_issues: number;
  ai_code_issues: number;
  lighthouse_issues: number;
  static_analyzer_issues: number;
  rule_based_issues: number;
  frontend_score: number | null;
  backend_score: number | null;
  launch_score: number;
  verdict: string;
  analysis_mode: string | null;
  has_screenshots: boolean;
  has_github_code: boolean;
  fetch_duration_ms: number;
  created_at: string;
}

export interface SaveMetricInput {
  auditId: string;
  userId?: string;
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  issuesFound: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  aiVisionIssues: number;
  aiCodeIssues: number;
  lighthouseIssues: number;
  staticAnalyzerIssues: number;
  ruleBasedIssues: number;
  frontendScore: number | null;
  backendScore: number | null;
  launchScore: number;
  verdict: string;
  analysisMode: string | null;
  hasScreenshots: boolean;
  hasGithubCode: boolean;
  fetchDurationMs: number;
}

export interface MetricsSummary {
  totalAudits: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  avgLaunchScore: number;
  totalTokens: number;
  providerBreakdown: Record<string, { count: number; cost: number }>;
  verdictBreakdown: { launchReady: number; needsFixes: number; broken: number };
}

let sql: ReturnType<typeof neon> | null = null;
let tableReady = false;

function getSql() {
  const env = getServerEnv();
  if (!env.DATABASE_URL) return null;
  sql ??= neon(env.DATABASE_URL);
  return sql;
}

async function ensureMetricsTable() {
  const db = getSql();
  if (!db || tableReady) return db;

  if (getServerEnv().NODE_ENV === "production") {
    tableReady = true;
    return db;
  }

  // Create table if it doesn't exist (dev only)
  await db`
    CREATE TABLE IF NOT EXISTS audit_metrics (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_id uuid NOT NULL,
      user_id text,
      provider text NOT NULL,
      model text,
      input_tokens integer DEFAULT 0,
      output_tokens integer DEFAULT 0,
      total_tokens integer DEFAULT 0,
      estimated_cost_usd numeric(10, 6) DEFAULT 0,
      latency_ms integer DEFAULT 0,
      issues_found integer DEFAULT 0,
      high_severity_count integer DEFAULT 0,
      medium_severity_count integer DEFAULT 0,
      low_severity_count integer DEFAULT 0,
      ai_vision_issues integer DEFAULT 0,
      ai_code_issues integer DEFAULT 0,
      lighthouse_issues integer DEFAULT 0,
      static_analyzer_issues integer DEFAULT 0,
      rule_based_issues integer DEFAULT 0,
      frontend_score integer,
      backend_score integer,
      launch_score integer,
      verdict text,
      analysis_mode text,
      has_screenshots boolean DEFAULT false,
      has_github_code boolean DEFAULT false,
      fetch_duration_ms integer DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_audit_metrics_audit_id ON audit_metrics(audit_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_audit_metrics_user_id ON audit_metrics(user_id, created_at DESC)`;

  tableReady = true;
  return db;
}

/**
 * Save audit metrics
 */
export async function saveAuditMetric(input: SaveMetricInput): Promise<string | null> {
  const db = await ensureMetricsTable();
  if (!db) return null;

  try {
    const rows = (await db`
      INSERT INTO audit_metrics (
        audit_id, user_id, provider, model,
        input_tokens, output_tokens, total_tokens, estimated_cost_usd,
        latency_ms, issues_found,
        high_severity_count, medium_severity_count, low_severity_count,
        ai_vision_issues, ai_code_issues, lighthouse_issues,
        static_analyzer_issues, rule_based_issues,
        frontend_score, backend_score, launch_score, verdict,
        analysis_mode, has_screenshots, has_github_code, fetch_duration_ms
      ) VALUES (
        ${input.auditId}, ${input.userId ?? null}, ${input.provider}, ${input.model ?? null},
        ${input.inputTokens}, ${input.outputTokens}, ${input.totalTokens}, ${input.estimatedCostUsd},
        ${input.latencyMs}, ${input.issuesFound},
        ${input.highSeverityCount}, ${input.mediumSeverityCount}, ${input.lowSeverityCount},
        ${input.aiVisionIssues}, ${input.aiCodeIssues}, ${input.lighthouseIssues},
        ${input.staticAnalyzerIssues}, ${input.ruleBasedIssues},
        ${input.frontendScore}, ${input.backendScore}, ${input.launchScore}, ${input.verdict},
        ${input.analysisMode}, ${input.hasScreenshots}, ${input.hasGithubCode}, ${input.fetchDurationMs}
      )
      RETURNING id
    `) as { id: string }[];

    return rows[0]?.id ?? null;
  } catch (err) {
    console.warn("[Metrics DB] Failed to save metric:", err);
    return null;
  }
}

/**
 * Get metrics summary for a user
 */
export async function getUserMetricsSummary(
  userId: string,
  days: number = 30
): Promise<MetricsSummary | null> {
  const db = await ensureMetricsTable();
  if (!db) return null;

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const rows = (await db`
      SELECT 
        COUNT(*) as total_audits,
        COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(AVG(launch_score), 0) as avg_launch_score,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        provider,
        COUNT(*) as provider_count,
        COALESCE(SUM(estimated_cost_usd), 0) as provider_cost,
        verdict,
        COUNT(CASE WHEN verdict = 'launch-ready' THEN 1 END) as launch_ready,
        COUNT(CASE WHEN verdict = 'needs-fixes' THEN 1 END) as needs_fixes,
        COUNT(CASE WHEN verdict = 'broken' THEN 1 END) as broken
      FROM audit_metrics
      WHERE user_id = ${userId}
        AND created_at >= ${since.toISOString()}
      GROUP BY provider, verdict
    `) as Array<{
      total_audits: number;
      total_cost: number;
      avg_latency: number;
      avg_launch_score: number;
      total_tokens: number;
      provider: string;
      provider_count: number;
      provider_cost: number;
      verdict: string;
      launch_ready: number;
      needs_fixes: number;
      broken: number;
    }>;

    if (rows.length === 0) {
      return {
        totalAudits: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        avgLaunchScore: 0,
        totalTokens: 0,
        providerBreakdown: {},
        verdictBreakdown: { launchReady: 0, needsFixes: 0, broken: 0 },
      };
    }

    // Aggregate results
    const providerBreakdown: Record<string, { count: number; cost: number }> = {};
    let totalAudits = 0;
    let totalCost = 0;
    let totalTokens = 0;
    const verdictBreakdown = { launchReady: 0, needsFixes: 0, broken: 0 };

    for (const row of rows) {
      totalAudits += row.provider_count;
      totalCost += row.provider_cost;
      totalTokens += row.total_tokens;
      
      if (!providerBreakdown[row.provider]) {
        providerBreakdown[row.provider] = { count: 0, cost: 0 };
      }
      providerBreakdown[row.provider].count += row.provider_count;
      providerBreakdown[row.provider].cost += row.provider_cost;

      if (row.verdict === "launch-ready") verdictBreakdown.launchReady += row.launch_ready;
      else if (row.verdict === "needs-fixes") verdictBreakdown.needsFixes += row.needs_fixes;
      else if (row.verdict === "broken") verdictBreakdown.broken += row.broken;
    }

    return {
      totalAudits,
      totalCostUsd: totalCost,
      avgLatencyMs: 0,
      avgLaunchScore: 0,
      totalTokens,
      providerBreakdown,
      verdictBreakdown,
    };
  } catch (err) {
    console.warn("[Metrics DB] Failed to get summary:", err);
    return null;
  }
}

/**
 * Get recent metrics for a user
 */
export async function getUserRecentMetrics(
  userId: string,
  limit: number = 10
): Promise<AuditMetricRow[]> {
  const db = await ensureMetricsTable();
  if (!db) return [];

  try {
    const rows = (await db`
      SELECT * FROM audit_metrics
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as AuditMetricRow[];

    return rows;
  } catch (err) {
    console.warn("[Metrics DB] Failed to get recent metrics:", err);
    return [];
  }
}
