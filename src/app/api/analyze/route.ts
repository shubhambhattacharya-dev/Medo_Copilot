import { NextRequest, NextResponse } from "next/server";
import { generateObject, generateText, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { saveAudit } from "@/lib/audits";
import { fetchGithubRepoCode } from "@/lib/github";

const IssueCategorySchema = z.enum([
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

const ResultSchema = z.object({
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

type AuditIssue = {
  category: z.infer<typeof IssueCategorySchema>;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  fixPrompt: string;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
};

type AuditVerdict = "launch-ready" | "needs-fixes" | "broken";
type AuditResponse = z.infer<typeof ResultSchema> & {
  analysisMode?: string;
  provider?: string;
};

type AiProvider = {
  name: string;
  model: LanguageModel;
  structuredOutput: boolean;
  supportsVision?: boolean;
};

type PageSignals = {
  title: string;
  metaDescription: string;
  text: string;
  contentLength: number;
  ctas: string[];
  links: string[];
  imageCount: number;
  imagesMissingAlt: number;
};

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

const COPY_ANALYSIS_PROMPT = (url: string, title: string, text: string, ctas: string[], links: string[]) => `
Analyze the TEXT CONTENT of this website for UX/copy issues only.

URL: ${url}
Title: ${title}
CTA buttons found: ${ctas.join(", ") || "none"}
Links: ${links.join(", ").slice(0, 200)}

Text content to analyze:
${text.slice(0, 4000)}

Check ONLY these text-based elements:
1. COPY: Is headline specific? Is value prop clear? Any generic buzzwords?
2. TRUST: Are there testimonials, reviews, logos in the text? Any "worked with" or "trusted by"?
3. CTA PHRASING: Are CTA buttons action-oriented (Get, Start, Book) or vague?
4. METADATA: Is there a meta description? Is it descriptive?

Return ONLY this JSON (no extra text):
{"copyIssues": [{"title": "issue", "severity": "high|medium|low", "description": "why", "fixPrompt": "fix", "evidence": "exact text", "confidence": "high|medium|low"}], "trustIssues": [], "ctaIssues": [], "overallScore": 70-90}
`;

const VISUAL_ANALYSIS_PROMPT = (url: string, title: string) => `
You are a senior UX designer analyzing a website SCREENSHOT for visual/design issues.

URL: ${url}
Title: ${title}

Analyze the SCREENSHOT for:
1. VISUAL HIERARCHY: Is the most important content immediately visible? Is there a clear visual flow?
2. CTA VISIBILITY: Is the primary CTA button prominent (color, size, contrast)? Is it "above the fold"?
3. MOBILE LAYOUT: Is the layout readable on mobile? Are tap targets adequate size?
4. EMPTY STATES: Is there a loading state? Empty product state?
5. TRUST VISUALS: Are testimonials/reviews visible? Any logos/certificates shown?
6. COLOR CONTRAST: Is text readable? Are buttons clearly distinguishable?
7. SPACING: Is there enough white space? Or is it cramped?

Return ONLY this JSON (no extra text):
{"visualIssues": [{"title": "issue", "severity": "high|medium|low", "description": "why", "fixPrompt": "fix", "evidence": "what you see", "confidence": "high|medium|low"}], "designScore": number, "mobileScore": number, "ctaScore": number}
`;

async function multiStepAnalyze(
  model: LanguageModel,
  structuredOutput: boolean,
  url: string,
  title: string,
  text: string,
  ctas: string[],
  links: string[],
  screenshots?: string[]
) {
  const copyPrompt = COPY_ANALYSIS_PROMPT(url, title, text, ctas, links);
   
  const copyResultText = (
    await generateText({
      model,
      messages: [{ role: "user", content: copyPrompt }]
    })
  ).text;

  let copyIssues: AuditIssue[] = [];
  try {
    const copyData = JSON.parse(copyResultText.replace(/^```json\s*/, "").replace(/```$/, ""));
    copyIssues = [
      ...(copyData.copyIssues || []),
      ...(copyData.trustIssues || []),
      ...(copyData.ctaIssues || [])
    ].map((i: { title?: string; severity?: string; description?: string; fixPrompt?: string; evidence?: string; confidence?: string }) => ({
      category: i.title?.toLowerCase().includes("trust") ? "trust" as const : 
              i.title?.toLowerCase().includes("cta") ? "cta" as const : "copy" as const,
      title: i.title || "Unknown issue",
      severity: (i.severity as "high" | "medium" | "low") || "medium",
      description: i.description || "",
      fixPrompt: i.fixPrompt || "",
      evidence: i.evidence || "",
      confidence: (i.confidence as "high" | "medium" | "low") || "medium"
    }));
  } catch {
    console.warn("Copy analysis parse failed, using empty issues");
  }

  let visualIssues: AuditIssue[] = [];
  if (screenshots && screenshots.length > 0) {
    try {
      const visualResult = (
        await generateText({
          model,
          messages: [{
            role: "user",
            content: [{
              type: "text", text: VISUAL_ANALYSIS_PROMPT(url, title) },
              ...screenshots.map(s => ({ type: "image" as const, image: Buffer.from(s, "base64"), mediaType: "image/png" }))
            ]
          }]
        })
      ).text;
      
      const visualData = JSON.parse(visualResult.replace(/^```json\s*/, "").replace(/```$/, ""));
      visualIssues = (visualData.visualIssues || []).map((i: { title?: string; severity?: string; description?: string; fixPrompt?: string; evidence?: string; confidence?: string }) => ({
        category: i.title?.toLowerCase().includes("mobile") ? "mobile" as const :
                i.title?.toLowerCase().includes("cta") ? "cta" as const : "accessibility" as const,
        title: i.title || "Unknown issue",
        severity: (i.severity as "high" | "medium" | "low") || "medium",
        description: i.description || "",
        fixPrompt: i.fixPrompt || "",
        evidence: i.evidence || "",
        confidence: (i.confidence as "high" | "medium" | "low") || "medium"
      }));
    } catch {
      console.warn("Visual analysis failed or no screenshots");
    }
  }

  const allIssues = [...copyIssues, ...visualIssues];
  const baseScore = structuredOutput ? 85 : 80;
  const penalty = allIssues.reduce((total, issue) => {
    if (issue.severity === "high") return total + 10;
    if (issue.severity === "medium") return total + 5;
    return total + 2;
  }, 0);
  
  const launchScore = Math.max(30, Math.min(95, baseScore - penalty));
  const verdict = getVerdict(launchScore, allIssues);

  return {
    thoughtProcess: [`Step 1: Analyzed text content for ${copyIssues.length} copy/trust/CTA issues`, `Step 2: Analyzed ${screenshots?.length || 0} screenshots for ${visualIssues.length} visual issues`],
    launchScore,
    verdict,
    summary: `Found ${allIssues.length} issues. ${verdict === "launch-ready" ? "Ready for launch" : "Needs fixes before launch"}.`,
    issues: allIssues,
    improvementPrompt: `Improve: ${allIssues.slice(0, 3).map(i => `${i.title}: ${i.fixPrompt}`).join(". ")}`,
  };
}

async function attachSavedAuditId(url: string, result: AuditResponse) {
  try {
    const auditId = await saveAudit({
      url,
      launchScore: result.launchScore,
      verdict: result.verdict,
      summary: result.summary,
      issues: result.issues,
      improvementPrompt: result.improvementPrompt,
      analysisMode: result.analysisMode,
      provider: result.provider,
    });

    return auditId ? { ...result, auditId } : result;
  } catch (error) {
    console.warn(`Audit save failed: ${getErrorMessage(error)}`);
    return result;
  }
}

function isPrivateOrLocalUrl(targetUrl: URL) {
  const hostname = targetUrl.hostname.toLowerCase();

  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const [, firstRaw, secondRaw] = ipv4Match;
  const first = Number(firstRaw);
  const second = Number(secondRaw);

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function buildFallbackResult({
  url,
  title,
  content,
  ruleIssues,
  reason,
}: {
  url: string;
  title: string;
  content: string;
  ruleIssues?: AuditIssue[];
  reason?: string;
}) {
  const issues: AuditIssue[] = [...(ruleIssues ?? [])];
  const normalized = `${title} ${content}`.toLowerCase();

  const pushIssue = (
    category: AuditIssue["category"],
    title: string,
    severity: AuditIssue["severity"],
    description: string,
    fixPrompt: string,
    evidence: string,
    confidence: NonNullable<AuditIssue["confidence"]>
  ) => {
    if (!issues.some((issue) => issue.category === category && issue.title === title)) {
      issues.push(createIssue(category, title, severity, description, fixPrompt, evidence, confidence));
    }
  };

  if (reason?.includes("ENOTFOUND")) {
    pushIssue(
      "error-state",
      "Website is not reachable",
      "high",
      "The URL could not be resolved from this server, so the audit cannot inspect the page content.",
      "Use a public preview URL for the app, then add a clear error state that tells users when a page cannot be loaded and offers a retry action.",
      reason,
      "high"
    );
  } else if (reason) {
    pushIssue(
      "error-state",
      "Fetch failed",
      "high",
      "The page request failed before analysis could start.",
      "Surface a clear error state with the exact URL and a retry action instead of a generic failure message.",
      reason,
      "high"
    );
  }

  if (!title || title.length < 8) {
    pushIssue(
      "copy",
      "Weak page title",
      "medium",
      "The page title does not clearly communicate what the app does.",
      "Rewrite the hero headline to state the outcome, audience, and main value in one line.",
      `Title length: ${title.length}. Title: "${title || "missing"}"`,
      "high"
    );
  }

  if (!/(pricing|plan|trial|book|demo|get started|sign up|join waitlist)/i.test(normalized)) {
    pushIssue(
      "cta",
      "CTA is not obvious",
      "medium",
      "The content does not include a strong conversion action near the top of the page.",
      "Move one primary CTA above the fold, make it action-based, and make secondary actions visually quieter.",
      "No strong CTA words such as pricing, trial, demo, get started, sign up, or join waitlist were detected.",
      "medium"
    );
  }

  if (!/(testimonial|review|trusted|customers|users|case study|social proof|as seen)/i.test(normalized)) {
    pushIssue(
      "trust",
      "Missing trust signals",
      "medium",
      "There is little evidence of proof, credibility, or social validation in the visible content.",
      "Add testimonials, usage stats, recognizable logos, or a short proof section close to the CTA.",
      "No trust keywords such as testimonial, trusted, users, case study, or social proof were detected.",
      "medium"
    );
  }

  if (content.length < 300) {
    pushIssue(
      "copy",
      "Sparse above-the-fold copy",
      "low",
      "The visible content is thin, which usually makes the page feel under-explained.",
      "Add one sentence that clarifies the problem, one that explains the result, and one CTA line.",
      `Extracted body text length: ${content.length} characters.`,
      "high"
    );
  }

  if (!/(empty state|no results|nothing here|try again|error state|loading|retry)/i.test(normalized)) {
    pushIssue(
      "empty-state",
      "Missing empty and error states",
      "low",
      "The visible content does not describe what users see while loading, when data is empty, or when something fails.",
      "Add clear loading, empty, and error states with helpful text and one recovery action, such as retrying or going back.",
      "No loading, empty-state, error-state, retry, or no-results copy detected in the fetched text.",
      "medium"
    );
  }

  if (!/(mobile|responsive|tap|phone|small screen)/i.test(normalized)) {
    pushIssue(
      "mobile",
      "Mobile behavior is not explained",
      "low",
      "The text-only fallback audit cannot verify visual mobile layout, and the content gives no evidence that mobile users were considered.",
      "Review the page on mobile and improve spacing, tap target size, stacked sections, and above-the-fold CTA visibility.",
      "No mobile, responsive, tap, phone, or small-screen wording detected in the fetched text.",
      "low"
    );
  }

  const finalIssues = issues;
  const launchScore = clampScore(
    90 - finalIssues.reduce((total, issue) => total + scorePenalty(issue), 0)
  );
  const verdict = getVerdict(launchScore, finalIssues);

  return {
    launchScore,
    verdict,
    summary:
      verdict === "launch-ready"
        ? "This app looks close to launch-ready, with only minor polish needed."
        : verdict === "broken"
          ? "This app is not launch-ready because a blocking issue needs attention first."
          : "This app has a usable base, but key trust, CTA, or state issues should be fixed before launch.",
    issues: finalIssues,
    improvementPrompt: buildImprovementPrompt({ url, title, issues: finalIssues }),
    analysisMode: "fallback",
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const url = formData.get("url") as string | null;
    const userScreenshot = formData.get("screenshot") as string | null;
    const githubUrl = formData.get("githubUrl") as string | null;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let validUrl = url.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = `https://${validUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(validUrl);
    } catch {
      return NextResponse.json({ error: "URL is invalid" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS URLs can be audited" },
        { status: 400 }
      );
    }

    if (isPrivateOrLocalUrl(parsedUrl)) {
      return NextResponse.json(
        {
          error:
            "Use a public preview URL. Localhost and private network URLs cannot be audited safely.",
        },
        { status: 400 }
      );
    }

    console.log(`Fetching HTML from: ${validUrl}`);
    let pageTitle = "";
    let pageText = "";
    let pageSignals: PageSignals = {
      title: "",
      metaDescription: "",
      text: "",
      contentLength: 0,
      ctas: [],
      links: [],
      imageCount: 0,
      imagesMissingAlt: 0,
    };
    let fetchReason = "";
    const screenshots: string[] = [];

    let githubCodeText = "";
    if (githubUrl && typeof githubUrl === "string" && githubUrl.includes("github.com")) {
      console.log(`Fetching GitHub code from: ${githubUrl}`);
      try {
        const ghResult = await fetchGithubRepoCode(githubUrl);
        if (ghResult.text) {
          githubCodeText = ghResult.text;
        }
      } catch (err: any) {
        console.error("GitHub fetch failed:", err);
      }
    }

    // Collect all screenshots (limit to 7 to match UI)
    formData.forEach((value, key) => {
      if (key.startsWith("screenshot_") && typeof value === "string" && screenshots.length < 7) {
        screenshots.push(value);
      }
    });

    if (userScreenshot && typeof userScreenshot === "string" && userScreenshot.length > 100) {
      console.log("User provided screenshot - using for analysis...");
      screenshots.push(userScreenshot);
    } 
    
     if (screenshots.length === 0) {
       try {
         console.log(`Launching browser for ${validUrl}...`);
         const browser = await chromium.launch({ 
           headless: true,
           args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] 
         });
         const context = await browser.newContext({
           viewport: { width: 1280, height: 800 },
           userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
         });
         const page = await context.newPage();

         try {
           console.log(`Navigating to ${validUrl}...`);
           const navigationPromise = page.goto(validUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
           
           // Add timeout for navigation
           await Promise.race([
             navigationPromise,
             new Promise((_, reject) => 
               setTimeout(() => reject(new Error("Navigation timeout")), 25000)
             )
           ]);
           
           console.log("Waiting for 2 seconds for JS hydration...");
           await page.waitForTimeout(2000);

           console.log("Taking screenshot...");
           const screenshot = await page.screenshot({ type: "png" });
           screenshots.push(screenshot.toString("base64"));

           console.log("Extracting content...");
           const html = await page.content();
           const $ = cheerio.load(html);
           pageSignals = getPageSignals($);
           pageTitle = pageSignals.title;
           pageText = pageSignals.text.substring(0, 8000);
         } catch (navErr: unknown) {
           // More specific error handling for navigation issues
           if (navErr instanceof Error) {
             if (navErr.message.includes("timeout") || navErr.message.includes("Timeout")) {
               fetchReason = `Navigation timeout: The website took too long to load. Please check if the URL is correct and the server is responding.`;
             } else if (navErr.message.includes("net::ERR_NAME_NOT_RESOLVED") || 
                       navErr.message.includes("ENOTFOUND")) {
               fetchReason = `DNS resolution failed: Unable to resolve the domain name. Please check if the URL is correct and the domain exists.`;
             } else if (navErr.message.includes("net::ERR_CONNECTION_REFUSED")) {
               fetchReason = `Connection refused: The server is not accepting connections. Please check if the server is running and accessible.`;
             } else if (navErr.message.includes("net::ERR_CONNECTION_TIMED_OUT")) {
               fetchReason = `Connection timed out: Unable to establish a connection to the server. Please check network connectivity and server status.`;
             } else {
               fetchReason = `Navigation failed: ${navErr.message}`;
             }
           } else {
             fetchReason = "Navigation failed: Unknown error occurred while loading the page";
           }
         } finally {
           await browser.close().catch(closeErr => {
             console.warn("Error closing browser:", closeErr);
           });
         }
       } catch (browserError: unknown) {
         // More specific error handling for browser initialization
         if (browserError instanceof Error) {
           if (browserError.message.includes("Executable doesn't exist")) {
             fetchReason = "Browser initialization failed: Playwright browsers are not installed. Please run 'npx playwright install' to install required browsers.";
           } else {
             fetchReason = `Browser initialization failed: ${browserError.message}`;
           }
         } else {
           fetchReason = "Browser initialization failed: Unknown error occurred while initializing the browser";
         }
       }
     }

    const ruleIssues = buildRuleIssues(pageSignals, fetchReason || undefined);
    const measuredResult = buildMeasuredResult({
      url: validUrl,
      title: pageTitle,
      issues: ruleIssues,
    });

    const fallbackResult = buildFallbackResult({
      url: validUrl,
      title: pageTitle,
      content: pageText,
      ruleIssues,
      reason: fetchReason || undefined,
    });

    if (fetchReason && !pageText) {
      console.error(`Audit Failed: ${fetchReason}`);
      return NextResponse.json(await attachSavedAuditId(validUrl, fallbackResult));
    }

    const getPrompt = (supportsVision: boolean) => `
You are a panel of three senior experts conducting a launch-readiness audit:
1. A **Senior UX/UI Designer** (10+ years, conversion optimization specialist)
2. A **Senior Software Engineer** (10+ years, full-stack architecture, security, error handling)
3. A **Senior QA Engineer** (testing, edge cases, robustness, accessibility)

You are auditing a web application before launch. Your job is to find REAL, ACTIONABLE issues — not vague suggestions. Be specific with evidence.

═══════════════════════════════════════
PART A — FRONTEND AUDIT (UX / UI / Copy)
═══════════════════════════════════════

Systematically check EVERY principle below. For each, state whether you found an issue or not.

### A1. HERO & VALUE PROPOSITION
- Can a visitor understand WHO this is for, WHAT it does, and WHAT RESULT they get — within 3 seconds?
- Is the headline specific with concrete outcomes, or vague with buzzwords like "innovative" and "powerful"?
- Is there a subheadline that reinforces the headline with a different angle?

### A2. COPY & MESSAGING QUALITY
- Does the copy use specific numbers/data/proof or generic marketing language?
- Is there spelling, grammar, or awkward phrasing?
- Is the tone consistent throughout the page?
- Are paragraphs short and scannable, or wall-of-text?

### A3. TRUST & CREDIBILITY SIGNALS
- Are there testimonials, reviews, case studies, or user stories?
- Are there logos, badges, certifications, or "as seen in" sections?
- Is there social proof (user count, downloads, GitHub stars, ratings)?
- Is the creator/team visible with names, photos, or LinkedIn links?
- Is there a clear "why trust us" or credibility section near the CTA?

### A4. CALL-TO-ACTION (CTA) DESIGN
- Is there ONE clear primary CTA above the fold?
- Does the CTA use strong action verbs (Get, Start, Try, Book, Join)?
- Is the CTA visually prominent (contrast, size, whitespace)?
- Are secondary CTAs visually subordinate to the primary?
- Does the CTA tell the user what happens next?

### A5. VISUAL HIERARCHY & LAYOUT
- Is the most important content (hero, CTA) at the top?
- Is there clear visual separation between sections?
- Are there enough whitespace and breathing room?
- Does the layout guide the eye: headline → subtext → CTA → proof?
- Is the color palette consistent and professional?

### A6. MOBILE EXPERIENCE
- Is content easy to read on small screens (no horizontal scroll)?
- Are tap targets at least 44x44px?
- Does the CTA remain visible without excessive scrolling?
- Is the navigation mobile-friendly (hamburger menu or simple)?
- Are images and text properly sized for mobile?

### A7. MISSING SECTIONS
- Is there a clear How-It-Works / Features section?
- Is there an FAQ or objection-handling section?
- Is there a pricing or "what you get" section?
- Is there a footer with contact/social links?

### A8. EMPTY, LOADING & ERROR STATES
- Does the app handle loading states with skeleton/spinner?
- Is there a clear empty state when no data exists?
- Is there a user-friendly error state with retry option?
- Are form validation errors shown inline?

### A9. ACCESSIBILITY
- Are images missing alt text?
- Is color contrast sufficient (WCAG AA)?
- Are interactive elements keyboard-accessible?
- Are links/buttons clearly labeled (not just "click here")?

### A10. PAGE PERFORMANCE SIGNALS
- Is the page content-rich (not thin/sparse)?
- Are there too many competing links (>15)?
- Is there meaningful content vs. filler/placeholder text?
- Is there a proper page title and meta description?

═══════════════════════════════════════
PART B — BACKEND AUDIT (Code / Architecture)
═══════════════════════════════════════
${githubCodeText ? `
You have been provided backend source code from GitHub. Analyze it thoroughly:

### B1. SECURITY
- Are there hardcoded API keys, secrets, or passwords in the code?
- Is there proper authentication/authorization on protected routes?
- Are environment variables used correctly?
- Is input validation present on API endpoints?
- Is there CORS configuration?

### B2. ERROR HANDLING & RESILIENCE
- Do API routes have proper try/catch blocks?
- Are errors returned with appropriate HTTP status codes (not generic 500)?
- Is there graceful degradation when external services fail?
- Are async operations properly awaited?
- Are there timeout handling for external API calls?

### B3. DATABASE & DATA LAYER
- Are there N+1 query patterns?
- Is there proper connection pooling?
- Are database queries parameterized (SQL injection prevention)?
- Is there proper data validation before database operations?
- Are there missing indexes on frequently queried fields?

### B4. API DESIGN & ARCHITECTURE
- Are REST conventions followed (proper HTTP methods, status codes)?
- Is there consistent error response format?
- Are routes properly organized and modular?
- Is there rate limiting or abuse prevention?
- Are responses properly typed?

### B5. CODE QUALITY
- Is there code duplication that should be refactored?
- Are functions too long (>50 lines)?
- Is there proper separation of concerns?
- Are there unused imports or dead code?
- Is naming consistent and descriptive?

### B6. DEPLOYMENT READINESS
- Are there proper environment variable checks?
- Is there health check endpoint?
- Are there proper logging practices?
- Is the build configuration correct?

BACKEND CODE:
${githubCodeText}` : `
No backend code was provided (no GitHub URL). Skip Part B entirely. Only report frontend issues.`}

═══════════════════════════════════════
SCORING RULES
═══════════════════════════════════════
- Start at 85 points
- HIGH severity issue: -8 to -12 points
- MEDIUM severity issue: -3 to -5 points
- LOW severity issue: -1 to -2 points
- HIGH confidence = you SAW evidence in screenshot/text/code
- MEDIUM confidence = strongly inferred from context
- LOW confidence = educated guess
- Be FAIR: don't penalize for acceptable implementations
- If no backend code provided, score purely on frontend

═══════════════════════════════════════
OUTPUT (JSON)
═══════════════════════════════════════
{"thoughtProcess": ["A1-Hero: checked headline...", "A2-Copy: evaluated tone...", "B1-Security: scanned for hardcoded keys..."], "launchScore": number, "verdict": "launch-ready|needs-fixes|broken", "summary": "2-3 sentences covering both frontend and backend assessment", "issues": [{"category": "copy|trust|cta|mobile|empty-state|error-state|accessibility|performance|security|architecture|database|backend-error", "title": "specific issue name", "severity": "high|medium|low", "description": "why this matters for launch readiness", "fixPrompt": "exact actionable instruction to fix this - be specific, not vague", "evidence": "the exact text/element/code line that proves this issue", "confidence": "high|medium|low"}], "improvementPrompt": "A complete, detailed prompt the user can paste into an AI assistant to fix ALL frontend and backend issues at once. Include specific file paths and code changes where relevant."}

═══════════════════════════════════════
TARGET PAGE DATA
═══════════════════════════════════════
URL: ${validUrl}
Title: ${pageTitle}
Content: ${pageText.substring(0, 4000)}

${supportsVision 
  ? `You have SCREENSHOTS attached. Use them to evaluate: visual hierarchy, CTA prominence, color scheme, mobile readability, layout quality, and empty states. Reference specific visual elements in your evidence.`
  : `TEXT-ONLY mode. You cannot see the page visually. Focus on: copy quality, CTA phrasing, trust signal keywords, content depth, meta tags. Do NOT make claims about visual elements you cannot verify.`
}

Measured signals:
- Meta description: ${pageSignals.metaDescription || "MISSING"}
- CTA/link labels found: ${pageSignals.ctas.join(", ") || "NONE DETECTED"}
- Total links: ${pageSignals.links.length}
- Image alt coverage: ${pageSignals.imageCount - pageSignals.imagesMissingAlt}/${pageSignals.imageCount} images have alt text
- Extracted text length: ${pageSignals.contentLength} characters
`;

     const aiModels: AiProvider[] = [];

     // Helper function to create a standardized AI provider
     const createAIProvider = (name: string, model: LanguageModel, structuredOutput: boolean, supportsVision: boolean = true): AiProvider => ({
       name,
       model,
       structuredOutput,
       supportsVision,
     });

     // 1. Google (Gemini) - Most reliable for complex vision tasks
     if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
       aiModels.push(
         createAIProvider(
           "gemini",
           google(process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.0-flash"),
           true,
           true
         )
       );
     }

      // 2. Groq (Llama Vision) - Best for speed
      if (process.env.GROQ_API_KEY) {
        aiModels.push(
          createAIProvider(
            "groq",
            groq(process.env.GROQ_MODEL || "llama-3.2-90b-vision-preview"),
            false,
            true
          )
        );
      }

     // 3. SiliconFlow - Reliable alternative with generous quota
     if (process.env.SILICONFLOW_API_KEY) {
       aiModels.push(
         createAIProvider(
           "siliconflow",
           createOpenAI({
             baseURL: "https://api.siliconflow.cn/v1",
             apiKey: process.env.SILICONFLOW_API_KEY,
           })("Qwen/Qwen2.5-VL-72B-Instruct"),
           false,
           true
         )
       );
     }

    if (!aiModels.length) {
      console.error("No AI models configured! Check your .env.local keys.");
      return NextResponse.json(await attachSavedAuditId(validUrl, measuredResult));
    }

    console.log(`Using AI models: ${aiModels.map(m => m.name).join(", ")}`);

    for (const ai of aiModels) {
      try {
        console.log(`Attempting analysis with ${ai.name}...`);
        
        const currentPrompt = getPrompt(ai.supportsVision !== false && screenshots.length > 0);
        const imageContents = screenshots.map(s => ({ type: "image" as const, image: Buffer.from(s, "base64"), mediaType: "image/png" }));
        
        const object = ai.structuredOutput
          ? (
              await generateObject({
                model: ai.model,
                schema: ResultSchema,
                messages: [
                  {
                    role: "user",
                    content: (ai.supportsVision !== false && screenshots.length > 0)
                      ? [
                          { type: "text", text: currentPrompt },
                          ...imageContents
                        ]
                      : currentPrompt
                  }
                ]
              })
            ).object
          : parseJsonFromText(
              (
                await generateText({
                  model: ai.model,
                  messages: [
                    {
                      role: "user",
                      content: (ai.supportsVision !== false && screenshots.length > 0)
                        ? [
                            { type: "text", text: currentPrompt + "\n\nReturn only valid JSON with this exact shape: {\"thoughtProcess\": [\"I am checking the copy...\"], \"launchScore\": number, \"verdict\": \"launch-ready\" | \"needs-fixes\" | \"broken\", \"summary\": string, \"issues\": [{\"category\": \"copy\" | \"trust\" | \"mobile\" | \"cta\" | \"empty-state\" | \"error-state\" | \"accessibility\" | \"performance\" | \"security\" | \"architecture\" | \"database\" | \"backend-error\", \"title\": string, \"severity\": \"high\" | \"medium\" | \"low\", \"description\": string, \"fixPrompt\": string, \"evidence\": string, \"confidence\": \"high\" | \"medium\" | \"low\"}], \"improvementPrompt\": string}." },
                            ...imageContents
                          ]
                        : currentPrompt + "\n\nReturn only valid JSON with this exact shape: {\"thoughtProcess\": [\"I am checking the copy...\"], \"launchScore\": number, \"verdict\": \"launch-ready\" | \"needs-fixes\" | \"broken\", \"summary\": string, \"issues\": [{\"category\": \"copy\" | \"trust\" | \"mobile\" | \"cta\" | \"empty-state\" | \"error-state\" | \"accessibility\" | \"performance\" | \"security\" | \"architecture\" | \"database\" | \"backend-error\", \"title\": string, \"severity\": \"high\" | \"medium\" | \"low\", \"description\": string, \"fixPrompt\": string, \"evidence\": string, \"confidence\": \"high\" | \"medium\" | \"low\"}], \"improvementPrompt\": string}."
                    }
                  ]
                })
              ).text
            );

        const mergedIssues = mergeIssues(object.issues, ruleIssues);
        const measuredScore = clampScore(
          Math.min(
            object.launchScore,
            90 - mergedIssues.reduce((total, issue) => total + scorePenalty(issue), 0)
          )
        );
        const auditResult = {
          ...object,
          issues: mergedIssues,
          launchScore: measuredScore,
          verdict: getVerdict(measuredScore, mergedIssues),
          improvementPrompt: buildImprovementPrompt({
            url: validUrl,
            title: pageTitle,
            issues: mergedIssues,
          }),
          analysisMode: "ai",
          provider: ai.name,
        };

        return NextResponse.json(await attachSavedAuditId(validUrl, auditResult));
      } catch (llmError: unknown) {
        console.error(`[Analysis Error] Provider: ${ai.name}`, llmError);
        console.warn(`${ai.name} analysis failed: ${getErrorMessage(llmError)}`);
      }
    }

    const allErrors = aiModels.map(ai => `${ai.name} failed`).join(", ");
    return NextResponse.json(
      { error: `AI analysis failed: ${allErrors}. Please check API keys and quota.` },
      { status: 503 }
    );
  } catch (error) {
    console.error("Audit API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to analyze the app.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
