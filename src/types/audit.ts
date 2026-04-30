import { z } from "zod";

// ============================================
// CANONICAL TYPE DEFINITIONS
// All audit-related types live here — single source of truth
// ============================================

export const IssueCategorySchema = z.enum([
  "copy",
  "trust",
  "mobile",
  "cta",
  "empty-state",
  "error-state",
  "accessibility",
  "performance",
  "security",
  "architecture",
  "database",
  "backend-error",
]);

export type IssueCategory = z.infer<typeof IssueCategorySchema>;

export type AuditIssue = {
  category: IssueCategory;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  fixPrompt: string;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
};

export type AuditVerdict = "launch-ready" | "needs-fixes" | "broken";

export const ResultSchema = z.object({
  thoughtProcess: z
    .array(z.string())
    .optional()
    .describe("Step-by-step reasoning on what portions and features of the app you are checking before generating the final report. Be detailed."),
  launchScore: z
    .number()
    .min(0)
    .max(100)
    .describe("A score from 0 to 100 based on the app's readiness"),
  verdict: z.enum(["launch-ready", "needs-fixes", "broken"]),
  summary: z
    .string()
    .describe("One short sentence explaining whether the app is launch-ready"),
  issues: z
    .array(
      z.object({
        category: IssueCategorySchema,
        title: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        description: z
          .string()
          .describe("Why this matters and how it hurts conversion"),
        fixPrompt: z
          .string()
          .describe("The exact prompt the user should copy-paste into MeDo to fix this"),
        evidence: z
          .string()
          .optional()
          .describe("The exact page signal, text snippet, or measurable check that supports this issue"),
        confidence: z
          .enum(["high", "medium", "low"])
          .optional()
          .describe("How strongly the available page evidence supports this issue"),
      })
    )
    .describe("List of every important UX/UI/trust issue found on the page"),
  improvementPrompt: z
    .string()
    .describe("One complete prompt the user can paste into MeDo to improve the whole app"),
});

export type LighthouseMetrics = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

export type BackendMetrics = {
  security: number;
  codeQuality: number;
  maintainability: number;
};

export type AuditResponse = z.infer<typeof ResultSchema> & {
  analysisMode?: string;
  provider?: string;
  lighthouse?: LighthouseMetrics;
  backendMetrics?: BackendMetrics;
};

export type PageSignals = {
  title: string;
  metaDescription: string;
  text: string;
  contentLength: number;
  ctas: string[];
  links: string[];
  imageCount: number;
  imagesMissingAlt: number;
};

/** Frontend issue categories for filtering */
export const FRONTEND_CATEGORIES = new Set<IssueCategory>([
  "copy", "trust", "cta", "mobile", "empty-state",
  "error-state", "accessibility", "performance",
]);
