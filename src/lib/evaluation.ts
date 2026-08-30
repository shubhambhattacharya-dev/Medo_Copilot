/**
 * Evaluation Service
 * Tracks audit quality metrics and provider performance
 * 
 * This service provides:
 * 1. Per-audit quality metrics (issue distribution, confidence scores)
 * 2. Provider performance tracking (success rate, latency)
 * 3. Aggregate statistics for dashboard
 */

import type { AuditResponse, AuditVerdict } from "@/types/audit";

export interface AuditEvaluation {
  // Issue metrics
  issuesFound: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  
  // Source breakdown
  aiVisionIssues: number;
  aiCodeIssues: number;
  lighthouseIssues: number;
  staticAnalyzerIssues: number;
  ruleBasedIssues: number;
  
  // Confidence distribution
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  
  // Quality indicators
  hasToolVerifiedEvidence: boolean;
  hasScreenshotEvidence: boolean;
  hasAiInferenceEvidence: boolean;
  
  // Category distribution
  categoryDistribution: Record<string, number>;
}

export interface AuditMetrics {
  auditId: string;
  evaluation: AuditEvaluation;
  scores: {
    frontend: number | null;
    backend: number | null;
    launch: number;
  };
  verdict: AuditVerdict;
  analysisMode: string | null;
  provider: string | null;
  hasScreenshots: boolean;
  hasGithubCode: boolean;
  latencyMs: number;
}

/**
 * Evaluate audit quality from response data
 */
export function evaluateAudit(
  response: AuditResponse
): AuditEvaluation {
  const issues = response.issues || [];
  
  // Issue counts by severity
  const highSeverityCount = issues.filter(i => i.severity === "high").length;
  const mediumSeverityCount = issues.filter(i => i.severity === "medium").length;
  const lowSeverityCount = issues.filter(i => i.severity === "low").length;
  
  // Source breakdown
  const aiVisionIssues = issues.filter(i => i.source === "ai-vision").length;
  const aiCodeIssues = issues.filter(i => i.source === "ai-code").length;
  const lighthouseIssues = issues.filter(i => i.source === "lighthouse").length;
  const staticAnalyzerIssues = issues.filter(i => i.source === "static-analyzer").length;
  const ruleBasedIssues = issues.filter(i => i.source === "rule-based").length;
  
  // Confidence distribution
  const highConfidenceCount = issues.filter(i => i.confidence === "high").length;
  const mediumConfidenceCount = issues.filter(i => i.confidence === "medium").length;
  const lowConfidenceCount = issues.filter(i => i.confidence === "low").length;
  
  // Evidence types
  const hasToolVerifiedEvidence = issues.some(i => i.evidenceType === "tool-verified");
  const hasScreenshotEvidence = issues.some(i => i.evidenceType === "screenshot-or-text");
  const hasAiInferenceEvidence = issues.some(i => i.evidenceType === "ai-inference");
  
  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  for (const issue of issues) {
    categoryDistribution[issue.category] = (categoryDistribution[issue.category] || 0) + 1;
  }
  
  return {
    issuesFound: issues.length,
    highSeverityCount,
    mediumSeverityCount,
    lowSeverityCount,
    aiVisionIssues,
    aiCodeIssues,
    lighthouseIssues,
    staticAnalyzerIssues,
    ruleBasedIssues,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    hasToolVerifiedEvidence,
    hasScreenshotEvidence,
    hasAiInferenceEvidence,
    categoryDistribution,
  };
}

/**
 * Create full audit metrics record
 */
export function createAuditMetrics(
  auditId: string,
  response: AuditResponse,
  options: {
    hasScreenshots?: boolean;
    hasGithubCode?: boolean;
    latencyMs?: number;
  } = {}
): AuditMetrics {
  const evaluation = evaluateAudit(response);
  
  return {
    auditId,
    evaluation,
    scores: {
      frontend: response.frontendScore ?? null,
      backend: response.backendScore ?? null,
      launch: response.launchScore,
    },
    verdict: response.verdict,
    analysisMode: response.analysisMode ?? null,
    provider: response.provider ?? null,
    hasScreenshots: options.hasScreenshots ?? false,
    hasGithubCode: options.hasGithubCode ?? false,
    latencyMs: options.latencyMs ?? 0,
  };
}

/**
 * Calculate audit quality score (0-100)
 * Higher score = more reliable audit
 */
export function calculateQualityScore(evaluation: AuditEvaluation): number {
  let score = 50; // Base score
  
  // Bonus for evidence quality
  if (evaluation.hasToolVerifiedEvidence) score += 15;
  if (evaluation.hasScreenshotEvidence) score += 10;
  if (evaluation.hasAiInferenceEvidence) score += 5;
  
  // Bonus for high confidence findings
  const totalIssues = evaluation.issuesFound;
  if (totalIssues > 0) {
    const highConfidenceRatio = evaluation.highConfidenceCount / totalIssues;
    score += Math.round(highConfidenceRatio * 15);
  }
  
  // Bonus for source diversity (multiple verification methods)
  const sourceCount = [
    evaluation.aiVisionIssues > 0,
    evaluation.aiCodeIssues > 0,
    evaluation.lighthouseIssues > 0,
    evaluation.staticAnalyzerIssues > 0,
    evaluation.ruleBasedIssues > 0,
  ].filter(Boolean).length;
  
  if (sourceCount >= 3) score += 10;
  else if (sourceCount >= 2) score += 5;
  
  // Penalty for all low confidence
  if (totalIssues > 0 && evaluation.lowConfidenceCount === totalIssues) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Format evaluation for display
 */
export function formatEvaluation(eval_: AuditEvaluation) {
  return {
    summary: `${eval_.issuesFound} issues found (${eval_.highSeverityCount} high, ${eval_.mediumSeverityCount} medium, ${eval_.lowSeverityCount} low)`,
    sources: [
      eval_.aiVisionIssues > 0 && `AI Vision: ${eval_.aiVisionIssues}`,
      eval_.aiCodeIssues > 0 && `AI Code: ${eval_.aiCodeIssues}`,
      eval_.lighthouseIssues > 0 && `Lighthouse: ${eval_.lighthouseIssues}`,
      eval_.staticAnalyzerIssues > 0 && `Static: ${eval_.staticAnalyzerIssues}`,
      eval_.ruleBasedIssues > 0 && `Rules: ${eval_.ruleBasedIssues}`,
    ].filter(Boolean).join(", "),
    confidence: `${eval_.highConfidenceCount} high, ${eval_.mediumConfidenceCount} medium, ${eval_.lowConfidenceCount} low`,
    evidenceTypes: [
      eval_.hasToolVerifiedEvidence && "Tool-verified",
      eval_.hasScreenshotEvidence && "Screenshot",
      eval_.hasAiInferenceEvidence && "AI inference",
    ].filter(Boolean).join(", "),
  };
}
