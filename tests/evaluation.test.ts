import { describe, expect, it } from "vitest";
import {
  evaluateAudit,
  createAuditMetrics,
  calculateQualityScore,
  formatEvaluation,
} from "@/lib/evaluation";
import type { AuditResponse } from "@/types/audit";

const mockAuditResponse: AuditResponse = {
  launchScore: 75,
  frontendScore: 80,
  backendScore: 70,
  verdict: "needs-fixes",
  summary: "Test audit",
  issues: [
    {
      category: "cta",
      title: "Missing CTA",
      severity: "high",
      description: "No clear CTA found",
      fixPrompt: "Add a CTA",
      evidence: "No buttons found",
      confidence: "high",
      evidenceType: "tool-verified",
      source: "rule-based",
    },
    {
      category: "accessibility",
      title: "Missing alt text",
      severity: "medium",
      description: "Images missing alt text",
      fixPrompt: "Add alt text",
      confidence: "medium",
      evidenceType: "screenshot-or-text",
      source: "ai-vision",
    },
    {
      category: "performance",
      title: "Slow loading",
      severity: "low",
      description: "Page loads slowly",
      fixPrompt: "Optimize images",
      confidence: "low",
      evidenceType: "ai-inference",
      source: "lighthouse",
    },
  ],
  improvementPrompt: "Fix all issues",
  analysisMode: "ai-split",
  provider: "gemini",
};

describe("evaluation", () => {
  describe("evaluateAudit", () => {
    it("counts issues by severity", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      
      expect(evaluation.issuesFound).toBe(3);
      expect(evaluation.highSeverityCount).toBe(1);
      expect(evaluation.mediumSeverityCount).toBe(1);
      expect(evaluation.lowSeverityCount).toBe(1);
    });

    it("counts issues by source", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      
      expect(evaluation.aiVisionIssues).toBe(1);
      expect(evaluation.lighthouseIssues).toBe(1);
      expect(evaluation.ruleBasedIssues).toBe(1);
      expect(evaluation.aiCodeIssues).toBe(0);
      expect(evaluation.staticAnalyzerIssues).toBe(0);
    });

    it("counts confidence levels", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      
      expect(evaluation.highConfidenceCount).toBe(1);
      expect(evaluation.mediumConfidenceCount).toBe(1);
      expect(evaluation.lowConfidenceCount).toBe(1);
    });

    it("detects evidence types", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      
      expect(evaluation.hasToolVerifiedEvidence).toBe(true);
      expect(evaluation.hasScreenshotEvidence).toBe(true);
      expect(evaluation.hasAiInferenceEvidence).toBe(true);
    });

    it("builds category distribution", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      
      expect(evaluation.categoryDistribution.cta).toBe(1);
      expect(evaluation.categoryDistribution.accessibility).toBe(1);
      expect(evaluation.categoryDistribution.performance).toBe(1);
    });

    it("handles empty issues", () => {
      const response: AuditResponse = {
        ...mockAuditResponse,
        issues: [],
      };
      
      const evaluation = evaluateAudit(response);
      expect(evaluation.issuesFound).toBe(0);
      expect(evaluation.highSeverityCount).toBe(0);
    });
  });

  describe("createAuditMetrics", () => {
    it("creates full metrics record", () => {
      const metrics = createAuditMetrics("test-audit-id", mockAuditResponse, {
        hasScreenshots: true,
        hasGithubCode: false,
        latencyMs: 5000,
      });
      
      expect(metrics.auditId).toBe("test-audit-id");
      expect(metrics.scores.launch).toBe(75);
      expect(metrics.scores.frontend).toBe(80);
      expect(metrics.scores.backend).toBe(70);
      expect(metrics.verdict).toBe("needs-fixes");
      expect(metrics.hasScreenshots).toBe(true);
      expect(metrics.hasGithubCode).toBe(false);
      expect(metrics.latencyMs).toBe(5000);
    });
  });

  describe("calculateQualityScore", () => {
    it("returns base score for minimal audit", () => {
      const evaluation = evaluateAudit({
        ...mockAuditResponse,
        issues: [],
      });
      
      const score = calculateQualityScore(evaluation);
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("increases score for tool-verified evidence", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      const score = calculateQualityScore(evaluation);
      
      // Should be higher than base 50 due to tool-verified evidence
      expect(score).toBeGreaterThan(50);
    });

    it("caps score at 100", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      const score = calculateQualityScore(evaluation);
      
      expect(score).toBeLessThanOrEqual(100);
    });

    it("never goes below 0", () => {
      const evaluation = {
        issuesFound: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        aiVisionIssues: 0,
        aiCodeIssues: 0,
        lighthouseIssues: 0,
        staticAnalyzerIssues: 0,
        ruleBasedIssues: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
        hasToolVerifiedEvidence: false,
        hasScreenshotEvidence: false,
        hasAiInferenceEvidence: false,
        categoryDistribution: {},
      };
      
      const score = calculateQualityScore(evaluation);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatEvaluation", () => {
    it("formats summary correctly", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      const formatted = formatEvaluation(evaluation);
      
      expect(formatted.summary).toContain("3 issues");
      expect(formatted.summary).toContain("1 high");
      expect(formatted.summary).toContain("1 medium");
      expect(formatted.summary).toContain("1 low");
    });

    it("formats sources correctly", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      const formatted = formatEvaluation(evaluation);
      
      expect(formatted.sources).toContain("AI Vision: 1");
      expect(formatted.sources).toContain("Lighthouse: 1");
      expect(formatted.sources).toContain("Rules: 1");
    });

    it("formats confidence correctly", () => {
      const evaluation = evaluateAudit(mockAuditResponse);
      const formatted = formatEvaluation(evaluation);
      
      expect(formatted.confidence).toContain("1 high");
      expect(formatted.confidence).toContain("1 medium");
      expect(formatted.confidence).toContain("1 low");
    });
  });
});
