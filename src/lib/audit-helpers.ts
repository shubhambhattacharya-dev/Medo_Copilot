import * as cheerio from "cheerio";
import {
  ResultSchema,
  IssueCategorySchema,
  type AuditIssue,
  type AuditVerdict,
  type AuditResponse,
  type BackendMetrics,
  type LighthouseMetrics,
  FRONTEND_CATEGORIES,
  type PageSignals,
} from "@/types/audit";

// ============================================
// PURE HELPER FUNCTIONS
// ============================================

export function normalizeAuditUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getVerdict(score: number, issues: AuditIssue[]): AuditVerdict {
  if (issues.some((issue) => issue.severity === "high") || score < 55) {
    return "broken";
  }

  if (score >= 85 && issues.length <= 1) {
    return "launch-ready";
  }

  return "needs-fixes";
}

function buildImprovementPrompt({
  url,
  title,
  issues,
}: {
  url: string;
  title: string;
  issues: AuditIssue[];
}) {
  const frontendCats = new Set(["copy", "trust", "cta", "mobile", "empty-state", "error-state", "accessibility", "performance"]);
  const feIssues = issues.filter(i => frontendCats.has(i.category));
  const beIssues = issues.filter(i => !frontendCats.has(i.category));

  const formatIssues = (list: AuditIssue[]) =>
    list.length
      ? list.map((issue, i) => `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.fixPrompt}`).join("\n")
      : "No major issues detected.";

  let prompt = `# Launch Readiness Fix Prompt\nApp: ${url}\nTitle: ${title || "Unknown"}\n\n`;

  prompt += `## FRONTEND FIXES\n${formatIssues(feIssues)}\n\n`;
  prompt += `## GENERAL FRONTEND GUIDELINES\n- Make the hero headline specific (WHO + WHAT + RESULT)\n- Keep ONE primary CTA above the fold with strong action verbs\n- Add trust signals (testimonials, stats, logos) near the CTA\n- Ensure mobile layout is scannable with 44px+ tap targets\n- Add clear loading, empty, and error states with retry actions\n- Use descriptive alt text on all meaningful images\n\n`;

  if (beIssues.length > 0) {
    prompt += `## BACKEND FIXES\n${formatIssues(beIssues)}\n\n`;
    prompt += `## GENERAL BACKEND GUIDELINES\n- Wrap all API handlers in try/catch with proper HTTP status codes\n- Use environment variables for all secrets (never hardcode)\n- Add input validation on every API endpoint\n- Handle timeouts and external service failures gracefully\n- Use parameterized queries to prevent SQL injection\n\n`;
  }

  prompt += `## RULES\n- Preserve the current product idea and visual style\n- Fix issues in order of severity (HIGH first)\n- Test each fix on mobile and desktop\n- Add error boundaries around critical UI sections`;

  return prompt;
}

function createIssue(
  category: AuditIssue["category"],
  title: string,
  severity: AuditIssue["severity"],
  description: string,
  fixPrompt: string,
  evidence: string,
  confidence: NonNullable<AuditIssue["confidence"]>
): AuditIssue {
  return {
    category,
    title,
    severity,
    description,
    fixPrompt,
    evidence,
    confidence,
  };
}

function getPageSignals($: cheerio.CheerioAPI): PageSignals {
  const ctas = $("a, button")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 20);

  const links = $("a[href]")
    .map((_, element) => String($(element).attr("href") || "").trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const imageCount = $("img").length;
  const imagesMissingAlt = $("img")
    .filter((_, element) => !String($(element).attr("alt") || "").trim())
    .length;

  const hasViewport = $("meta[name='viewport']").length > 0;

  $("script, style, svg, img, iframe, noscript").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    title: $("title").text().trim(),
    metaDescription: String($("meta[name='description']").attr("content") || "").trim(),
    text,
    contentLength: text.length,
    ctas,
    links,
    imageCount,
    imagesMissingAlt,
    hasViewport,
  };
}

function buildRuleIssues(signals: PageSignals, reason?: string) {
  const issues: AuditIssue[] = [];
  const normalized = `${signals.title} ${signals.metaDescription} ${signals.text}`.toLowerCase();
  const ctaText = signals.ctas.join(", ");

  if (reason?.includes("ENOTFOUND")) {
    issues.push(
      createIssue(
        "error-state",
        "Website is not reachable",
        "high",
        "The URL could not be resolved from this server, so the audit cannot inspect the page content.",
        "Use a public preview URL for the app, then add a clear error state that tells users when a page cannot be loaded and offers a retry action.",
        reason,
        "high"
      )
    );
  } else if (reason) {
    issues.push(
      createIssue(
        "error-state",
        "Fetch failed",
        "high",
        "The page request failed before analysis could start.",
        "Surface a clear error state with the exact URL and a retry action instead of a generic failure message.",
        reason,
        "high"
      )
    );
  }

  // 1. Accessibility Checks
  if (signals.imageCount > 0 && signals.imagesMissingAlt > 0) {
    issues.push(
      createIssue(
        "accessibility",
        "Images missing alt text",
        "medium",
        "Some images do not expose alternative text, which can hurt accessibility and context for assistive technology.",
        "Add descriptive alt text for all meaningful images. Decorative images should have empty alt='' tags.",
        `${signals.imagesMissingAlt} of ${signals.imageCount} image(s) are missing alt text.`,
        "high"
      )
    );
  }

  // 2. Performance / Content Density
  if (signals.contentLength < 300) {
    issues.push(
      createIssue(
        "performance",
        "Sparse page content",
        "low",
        "The page text is very thin, which can make the product feel under-explained and hurt SEO.",
        "Add a clear 'How it Works' section and expand on the features of your application.",
        `Extracted body text length: ${signals.contentLength} characters.`,
        "high"
      )
    );
  }

  // 3. CTA & Conversion
  if (signals.ctas.length === 0) {
    issues.push(
      createIssue(
        "cta",
        "Missing Call-to-Action (CTA)",
        "high",
        "No buttons or action links were detected above the fold.",
        "Add a primary 'Get Started' or 'Demo' button clearly visible at the top of the page.",
        "Found 0 button/link text labels in the initial HTML scan.",
        "high"
      )
    );
  } else if (!/(get started|sign up|join|try|demo|book|pricing|download|hire|start)/i.test(ctaText)) {
    issues.push(
      createIssue(
        "cta",
        "CTA phrasing is not actionable",
        "medium",
        "The detected links do not use strong conversion verbs.",
        "Update your main buttons to use active verbs like 'Start for free', 'Book a demo', or 'Join the waitlist'.",
        `Found CTAs: ${signals.ctas.slice(0, 3).join(", ")}`,
        "medium"
      )
    );
  }

  // 4. Trust & Social Proof
  if (!/(testimonial|review|trusted by|customers|users|clients|case study|proof|social proof)/i.test(normalized)) {
    issues.push(
      createIssue(
        "trust",
        "Missing social proof",
        "medium",
        "The page lacks testimonials, user counts, or brand logos that build credibility.",
        "Add a 'Trusted By' logo strip or 2-3 customer testimonials near your primary CTA.",
        "No keywords related to social proof (testimonials, reviews) detected in the page text.",
        "medium"
      )
    );
  }

  // 5. Meta & SEO
  if (!signals.title || signals.title.length < 5) {
    issues.push(
      createIssue(
        "copy",
        "Missing or weak page title",
        "medium",
        "The page title is too short or missing, which hurts click-through rates from search and social shares.",
        "Update the <title> tag to clearly state the product name and its primary value proposition.",
        `Title: "${signals.title || "Empty"}"`,
        "high"
      )
    );
  }

  if (!signals.metaDescription) {
    issues.push(
      createIssue(
        "copy",
        "Missing meta description",
        "low",
        "No meta description found. Search engines will show generic snippets which might not entice users.",
        "Add a <meta name='description'> tag with a 150-160 character summary of your app's value.",
        "Meta description tag is absent from the HTML.",
        "high"
      )
    );
  }

  // 6. Mobile Readiness
  if (!signals.hasViewport) {
    issues.push(
      createIssue(
        "mobile",
        "Non-responsive viewport detected",
        "high",
        "The page may not scale correctly on mobile devices.",
        "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to your HTML <head>.",
        "Missing standard mobile-responsive meta tag.",
        "high"
      )
    );
  }

  return issues;
}

function mergeIssues(aiIssues: AuditIssue[], ruleIssues: AuditIssue[]) {
  const merged = [...ruleIssues];

  for (const issue of aiIssues) {
    const isDuplicate = merged.some(
      (existing) =>
        existing.category === issue.category &&
        existing.title.toLowerCase() === issue.title.toLowerCase()
    );

    if (!isDuplicate) {
      merged.push({
        ...issue,
        evidence: issue.evidence || "AI finding based on extracted page content.",
        confidence: issue.confidence || "medium",
      });
    }
  }

  return merged;
}

function scorePenalty(issue: AuditIssue) {
  if (issue.severity === "high") return 10;
  if (issue.severity === "medium") return 5;
  return 2;
}

function buildMeasuredResult({
  url,
  title,
  issues,
  backendMetrics,
  lighthouse,
}: {
  url: string;
  title: string;
  issues: AuditIssue[];
  backendMetrics?: BackendMetrics | null;
  lighthouse?: LighthouseMetrics | null;
}) {
  const issuePenalty = issues
    .filter(i => FRONTEND_CATEGORIES.has(i.category))
    .reduce((total, issue) => total + scorePenalty(issue), 0);

  const lighthouseAvg = (lighthouse && typeof lighthouse.performance === 'number') 
    ? Math.round((lighthouse.performance + lighthouse.accessibility + lighthouse.bestPractices + lighthouse.seo) / 4)
    : null;

  let frontendScore: number;
  if (lighthouseAvg !== null) {
    // If we have Lighthouse, it's the primary score, but penalized slightly by our custom rules (30% weight)
    frontendScore = Math.max(0, lighthouseAvg - Math.round(issuePenalty * 0.3));
  } else {
    // Without Lighthouse, start at 85 (more conservative) and subtract full penalties
    frontendScore = clampScore(85 - issuePenalty);
  }

  const backendScore = backendMetrics
    ? Math.round((backendMetrics.security + backendMetrics.codeQuality + backendMetrics.maintainability) / 3)
    : (issues.some(i => !FRONTEND_CATEGORIES.has(i.category)) ? 70 : 100);

  const launchScore = backendMetrics 
    ? Math.round((frontendScore + backendScore) / 2)
    : frontendScore;
  const verdict = getVerdict(launchScore, issues);

  return {
    launchScore,
    frontendScore,
    backendScore: backendMetrics ? backendScore : undefined,
    verdict,
    summary:
      verdict === "launch-ready"
        ? "This app looks close to launch-ready based on deterministic page signals."
        : verdict === "broken"
          ? "This app has critical issues detected by our automated rule-engine."
          : "This app has a solid base, but key UX/UI and trust signals need improvement before launch.",
    issues,
    improvementPrompt: buildImprovementPrompt({ url, title, issues }),
    analysisMode: "measured",
    lighthouse: lighthouse || undefined,
    backendMetrics: backendMetrics || undefined,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown AI provider error";
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  try {
    return ResultSchema.parse(JSON.parse(trimmed));
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI response did not contain a JSON object");
    }

    return ResultSchema.parse(JSON.parse(trimmed.slice(start, end + 1)));
  }
}

export {
  IssueCategorySchema,
  ResultSchema,
  clampScore,
  getVerdict,
  buildImprovementPrompt,
  createIssue,
  getPageSignals,
  buildRuleIssues,
  mergeIssues,
  scorePenalty,
  buildMeasuredResult,
  getErrorMessage,
  parseJsonFromText,
  type AuditIssue,
  type AuditVerdict,
  type AuditResponse,
  type PageSignals,
};