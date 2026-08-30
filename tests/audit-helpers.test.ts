import { describe, expect, it } from "vitest";
import { buildMeasuredResult, buildRuleIssues } from "@/lib/audit-helpers";
import type { PageSignals } from "@/types/audit";

const baseSignals: PageSignals = {
  title: "A",
  metaDescription: "",
  text: "Thin",
  contentLength: 4,
  ctas: [],
  links: [],
  imageCount: 2,
  imagesMissingAlt: 1,
  hasViewport: false,
};

describe("audit helpers", () => {
  it("marks deterministic rule issues as tool verified", () => {
    const issues = buildRuleIssues(baseSignals);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.evidenceType === "tool-verified" || issue.evidenceType === "screenshot-or-text")).toBe(true);
    expect(issues.find((issue) => issue.title === "Missing Call-to-Action (CTA)")?.confidence).toBe("high");
  });

  it("builds a broken measured result when high severity findings exist", () => {
    const issues = buildRuleIssues(baseSignals);
    const result = buildMeasuredResult({
      url: "https://example.com",
      title: "Example",
      issues,
      lighthouse: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
    });

    expect(result.verdict).toBe("broken");
    expect(result.launchScore).toBeLessThan(90);
    expect(result.improvementPrompt).toContain("FRONTEND FIXES");
  });
});
