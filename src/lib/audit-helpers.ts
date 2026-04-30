import * as cheerio from "cheerio";
import {
  ResultSchema,
  IssueCategorySchema,
  type AuditIssue,
  type AuditVerdict,
  type AuditResponse,
  type PageSignals,
} from "@/types/audit";

// ============================================
// PURE HELPER FUNCTIONS
// ============================================

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

  if (!signals.title || signals.title.length < 8) {
    issues.push(
      createIssue(
        "copy",
        "Weak page title",
        "medium",
        "The page title does not clearly communicate what the app does.",
        "Rewrite the page title and hero headline to state the outcome, audience, and main value in one line.",
        `Title length: ${signals.title.length}. Title: "${signals.title || "missing"}"`,
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
        "The page has no meta description, so search previews and shared links may not explain the product clearly.",
        "Add a short meta description that explains who the app is for, what it does, and the main result users get.",
        "No meta[name='description'] content found in the fetched HTML.",
        "high"
      )
    );
  }

  if (signals.ctas.length === 0) {
    issues.push(
      createIssue(
        "cta",
        "No visible CTA found",
        "high",
        "The fetched HTML did not expose a clear link or button action for visitors to take next.",
        "Add one primary CTA above the fold and make secondary actions visually quieter.",
        "Found 0 button/link text labels in the fetched HTML.",
        "high"
      )
    );
  } else if (!/(pricing|plan|trial|book|demo|get started|sign up|join waitlist|contact|download|hire|start|try)/i.test(ctaText)) {
    issues.push(
      createIssue(
        "cta",
        "CTA is not obvious",
        "medium",
        "The detected link/button labels do not include a strong conversion action.",
        "Use one action-based primary CTA above the fold, such as 'Book a demo', 'Start free', 'Hire me', or 'View project'.",
        `Detected CTA/link labels: ${ctaText.slice(0, 220)}`,
        "high"
      )
    );
  }

  if (!/(testimonial|review|trusted|customers|users|case study|social proof|as seen|github|linkedin|client|worked with)/i.test(normalized)) {
    issues.push(
      createIssue(
        "trust",
        "Missing trust signals",
        "medium",
        "The visible content has little proof, credibility, or social validation.",
        "Add testimonials, usage stats, recognizable logos, project links, GitHub/LinkedIn proof, or a short proof section close to the CTA.",
        "No trust keywords such as testimonial, trusted, users, case study, GitHub, or LinkedIn were detected.",
        "medium"
      )
    );
  }

  if (signals.contentLength < 300) {
    issues.push(
      createIssue(
        "copy",
        "Sparse page copy",
        "low",
        "The fetched page text is thin, which can make the product feel under-explained.",
        "Add one sentence for the problem, one for the outcome, one for credibility, and one clear CTA line.",
        `Extracted body text length: ${signals.contentLength} characters.`,
        "high"
      )
    );
  }

  if (!/(empty state|no results|nothing here|try again|error state|loading|retry)/i.test(normalized)) {
    issues.push(
      createIssue(
        "empty-state",
        "Missing empty and error states",
        "low",
        "The visible content does not describe what users see while loading, when data is empty, or when something fails.",
        "Add clear loading, empty, and error states with helpful text and one recovery action, such as retrying or going back.",
        "No loading, empty-state, error-state, retry, or no-results copy detected in the fetched text.",
        "medium"
      )
    );
  }

  if (signals.imageCount > 0 && signals.imagesMissingAlt > 0) {
    issues.push(
      createIssue(
        "accessibility",
        "Images missing alt text",
        "medium",
        "Some images do not expose alternative text, which can hurt accessibility and context for assistive technology.",
        "Add descriptive alt text for meaningful images and empty alt text for decorative images.",
        `${signals.imagesMissingAlt} of ${signals.imageCount} image(s) are missing alt text.`,
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
}: {
  url: string;
  title: string;
  issues: AuditIssue[];
}) {
  const launchScore = clampScore(
    90 - issues.reduce((total, issue) => total + scorePenalty(issue), 0)
  );
  const verdict = getVerdict(launchScore, issues);

  return {
    launchScore,
    verdict,
    summary:
      verdict === "launch-ready"
        ? "This app looks close to launch-ready based on the measured page signals."
        : verdict === "broken"
          ? "This app has high-priority issues backed by measurable page signals."
          : "This app has a usable base, but measurable copy, trust, CTA, or accessibility issues should be fixed before launch.",
    issues,
    improvementPrompt: buildImprovementPrompt({ url, title, issues }),
    analysisMode: "measured",
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