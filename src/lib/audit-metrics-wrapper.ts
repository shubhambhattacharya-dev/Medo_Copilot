/**
 * Audit Metrics Wrapper
 * Captures cost and evaluation metrics from audit runs
 * 
 * This wrapper intercepts the audit process to collect:
 * 1. Token usage and cost estimates
 * 2. Audit quality evaluation
 * 3. Latency and performance metrics
 * 
 * It does NOT modify the original AuditService - it wraps it.
 */

import type { AuditResponse } from "@/types/audit";
import { estimateCost, parseTokenUsage, formatCost, formatTokens } from "./cost-tracker";
import { createAuditMetrics, calculateQualityScore, formatEvaluation } from "./evaluation";
import { saveAuditMetric } from "./audit-metrics-db";

export interface MetricsCapture {
  startTime: number;
  endTime: number;
  latencyMs: number;
  provider: string;
  model?: string;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costEstimate: ReturnType<typeof estimateCost>;
  evaluation: ReturnType<typeof createAuditMetrics>;
  qualityScore: number;
}

export interface MetricsContext {
  userId?: string;
  hasScreenshots: boolean;
  hasGithubCode: boolean;
  fetchDurationMs: number;
}

/**
 * Start metrics capture for an audit
 */
export function startMetricsCapture(provider: string, model?: string) {
  return {
    startTime: Date.now(),
    provider,
    model,
  };
}

/**
 * End metrics capture and create full metrics record
 */
export function endMetricsCapture(
  capture: ReturnType<typeof startMetricsCapture>,
  response: AuditResponse,
  context: MetricsContext,
  aiResponse?: unknown
): MetricsCapture {
  const endTime = Date.now();
  const latencyMs = endTime - capture.startTime;
  
  // Parse token usage from AI response
  const tokenUsage = aiResponse ? parseTokenUsage(aiResponse) : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  
  // Estimate cost
  const costEstimate = estimateCost(capture.provider, {
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
  });
  
  // Create evaluation
  const evaluation = createAuditMetrics(
    "", // auditId will be filled in later
    response,
    {
      hasScreenshots: context.hasScreenshots,
      hasGithubCode: context.hasGithubCode,
      latencyMs,
    }
  );
  
  // Calculate quality score
  const qualityScore = calculateQualityScore(evaluation.evaluation);
  
  return {
    startTime: capture.startTime,
    endTime,
    latencyMs,
    provider: capture.provider,
    model: capture.model,
    tokenUsage: {
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      totalTokens: tokenUsage.inputTokens + tokenUsage.outputTokens,
    },
    costEstimate,
    evaluation,
    qualityScore,
  };
}

/**
 * Save captured metrics to database
 */
export async function saveMetrics(
  metrics: MetricsCapture,
  auditId: string,
  userId?: string
): Promise<string | null> {
  return saveAuditMetric({
    auditId,
    userId,
    provider: metrics.provider,
    model: metrics.model,
    inputTokens: metrics.tokenUsage.inputTokens,
    outputTokens: metrics.tokenUsage.outputTokens,
    totalTokens: metrics.tokenUsage.totalTokens,
    estimatedCostUsd: metrics.costEstimate.estimatedCostUsd,
    latencyMs: metrics.latencyMs,
    issuesFound: metrics.evaluation.evaluation.issuesFound,
    highSeverityCount: metrics.evaluation.evaluation.highSeverityCount,
    mediumSeverityCount: metrics.evaluation.evaluation.mediumSeverityCount,
    lowSeverityCount: metrics.evaluation.evaluation.lowSeverityCount,
    aiVisionIssues: metrics.evaluation.evaluation.aiVisionIssues,
    aiCodeIssues: metrics.evaluation.evaluation.aiCodeIssues,
    lighthouseIssues: metrics.evaluation.evaluation.lighthouseIssues,
    staticAnalyzerIssues: metrics.evaluation.evaluation.staticAnalyzerIssues,
    ruleBasedIssues: metrics.evaluation.evaluation.ruleBasedIssues,
    frontendScore: metrics.evaluation.scores.frontend,
    backendScore: metrics.evaluation.scores.backend,
    launchScore: metrics.evaluation.scores.launch,
    verdict: metrics.evaluation.verdict,
    analysisMode: metrics.evaluation.analysisMode,
    hasScreenshots: metrics.evaluation.hasScreenshots,
    hasGithubCode: metrics.evaluation.hasGithubCode,
    fetchDurationMs: 0, // Will be passed separately if needed
  });
}

/**
 * Format metrics for display
 */
export function formatMetricsForDisplay(metrics: MetricsCapture) {
  const evaluation = formatEvaluation(metrics.evaluation.evaluation);
  
  return {
    latency: `${(metrics.latencyMs / 1000).toFixed(1)}s`,
    cost: formatCost(metrics.costEstimate.estimatedCostUsd),
    tokens: formatTokens(metrics.tokenUsage.totalTokens),
    quality: `${metrics.qualityScore}/100`,
    evaluation,
  };
}
