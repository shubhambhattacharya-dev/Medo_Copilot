import { generateText } from "ai";
import { AiProvider } from "./ai-service";
import type { AuditResponse, LighthouseMetrics, BackendMetrics, PageSignals } from "@/types/audit";
import { StaticAnalyzer } from "@/lib/static-analyzer";
import { mergeIssues, parseJsonFromText } from "@/lib/audit-helpers";

export class AuditService {
  static getFrontendPrompt(validUrl: string, pageTitle: string, pageText: string, pageSignals: PageSignals, supportsVision: boolean) {
    return `
You are a panel of two senior experts conducting a launch-readiness audit:
1. A **Senior UX/UI Designer** (10+ years, conversion optimization specialist)
2. A **Senior QA Engineer** (testing, edge cases, robustness, accessibility)

You are auditing the FRONTEND of a web application before launch. Your job is to find REAL, ACTIONABLE issues.

═══════════════════════════════════════
PART A — FRONTEND AUDIT (UX / UI / Copy)
═══════════════════════════════════════
### A1. HERO & VALUE PROPOSITION
- Can a visitor understand WHO this is for, WHAT it does, and WHAT RESULT they get — within 3 seconds?
### A2. COPY & MESSAGING QUALITY
- Does the copy use specific numbers/data/proof or generic marketing language?
### A3. TRUST & CREDIBILITY SIGNALS
- Are there testimonials, reviews, case studies, or user stories?
### A4. CALL-TO-ACTION (CTA) DESIGN
- Is there ONE clear primary CTA above the fold?
### A5. VISUAL HIERARCHY & LAYOUT
- Is the most important content (hero, CTA) at the top?
### A6. MOBILE EXPERIENCE
- Is content easy to read on small screens (no horizontal scroll)?
### A7. MISSING SECTIONS
- Is there a clear How-It-Works / Features section?
### A8. EMPTY, LOADING & ERROR STATES
- Does the app handle loading states with skeleton/spinner?
### A9. ACCESSIBILITY
- Are images missing alt text?
### A10. PAGE PERFORMANCE SIGNALS
- Is the page content-rich (not thin/sparse)?

═══════════════════════════════════════
OUTPUT (JSON)
═══════════════════════════════════════
{"thoughtProcess": ["A1-Hero: checked headline..."], "launchScore": number, "verdict": "launch-ready|needs-fixes|broken", "summary": "2-3 sentences covering frontend assessment", "issues": [{"category": "copy|trust|cta|mobile|empty-state|error-state|accessibility|performance", "title": "specific issue name", "severity": "high|medium|low", "description": "why this matters", "fixPrompt": "exact actionable instruction to fix this", "evidence": "the exact text/element", "confidence": "high|medium|low"}], "improvementPrompt": "A complete, detailed prompt to fix ALL frontend issues."}

═══════════════════════════════════════
TARGET PAGE DATA
═══════════════════════════════════════
URL: ${validUrl}
Title: ${pageTitle}
Content: ${pageText.substring(0, 4000)}

${supportsVision
        ? `You have SCREENSHOTS attached. Use them to evaluate: visual hierarchy, CTA prominence, color scheme, mobile readability, layout quality, and empty states.`
        : `TEXT-ONLY mode. Focus on: copy quality, CTA phrasing, trust signal keywords.`
      }
Measured signals:
- Meta description: ${pageSignals.metaDescription || "MISSING"}
- CTA/link labels found: ${pageSignals.ctas?.join(", ") || "NONE DETECTED"}
- Total links: ${pageSignals.links?.length || 0}
`;
  }

  static getBackendPrompt(githubCodeText: string) {
    return `
You are a **Senior Software Engineer** (10+ years, full-stack architecture, security, error handling).
You are auditing the BACKEND of a web application before launch.

═══════════════════════════════════════
PART B — BACKEND AUDIT (Code / Architecture)
═══════════════════════════════════════
### B1. SECURITY
- Are there hardcoded API keys, secrets, or passwords?
### B2. ERROR HANDLING & RESILIENCE
- Do API routes have proper try/catch blocks?
### B3. DATABASE & DATA LAYER
- Are database queries parameterized?
### B4. API DESIGN & ARCHITECTURE
- Are REST conventions followed?
### B5. CODE QUALITY
- Is there code duplication?
### B6. DEPLOYMENT READINESS
- Are there proper environment variable checks?

BACKEND CODE:
${githubCodeText}

═══════════════════════════════════════
OUTPUT (JSON)
═══════════════════════════════════════
{"thoughtProcess": ["B1-Security: scanned for keys..."], "launchScore": number, "verdict": "launch-ready|needs-fixes|broken", "summary": "2-3 sentences covering backend assessment", "issues": [{"category": "security|architecture|database|backend-error", "title": "specific issue name", "severity": "high|medium|low", "description": "why this matters", "fixPrompt": "exact actionable instruction to fix this", "evidence": "the exact code line", "confidence": "high|medium|low"}], "improvementPrompt": "A complete, detailed prompt to fix ALL backend issues."}
`;
  }

  static async fetchLighthouseScores(url: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds max

    try {
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;
      const res = await fetch(endpoint, { 
        next: { revalidate: 3600 },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) return null;
      
      const data = await res.json();
      const categories = data?.lighthouseResult?.categories;
      if (!categories) return null;

      return {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("Lighthouse fetch failed or timed out:", err);
      return null;
    }
  }

  /**
   * Orchestrates the dual-analysis process + Lighthouse with strict per-task timeouts
   */
  static async runFullAudit(
    visionProvider: AiProvider,
    codeProvider: AiProvider | null,
    screenshots: string[],
    githubCodeText: string | null,
    contextData: { url: string; title: string; text: string; signals: PageSignals }
  ): Promise<AuditResponse> {
    const TASK_TIMEOUT = 25000; // 25s timeout per sub-task

    const safeTask = async <T>(taskPromise: Promise<T>, taskName: string): Promise<T | null> => {
      try {
        return await Promise.race([
          taskPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${taskName} timed out after ${TASK_TIMEOUT}ms`)), TASK_TIMEOUT)
          )
        ]);
      } catch (err) {
        console.error(`[Audit Task Failed] ${taskName}:`, err instanceof Error ? err.message : String(err));
        return null;
      }
    };

    // Task 1: Vision Analysis
    const frontendPrompt = this.getFrontendPrompt(
      contextData.url,
      contextData.title,
      contextData.text,
      contextData.signals,
      visionProvider.supportsVision !== false
    );

    const visionTask = safeTask(generateText({
      model: visionProvider.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: frontendPrompt },
            ...screenshots.map(s => ({ type: "image" as const, image: Buffer.from(s, "base64"), mediaType: "image/png" as const }))
          ]
        }
      ]
    }), `Vision (${visionProvider.name})`);

    // Task 2: Code Analysis (Optional)
    const codeTask = codeProvider && githubCodeText
      ? safeTask(generateText({
          model: codeProvider.model,
          prompt: this.getBackendPrompt(githubCodeText)
        }), `Code (${codeProvider.name})`)
      : Promise.resolve(null);

    // Task 3: Lighthouse PSI Analysis
    const lighthouseTask = safeTask(this.fetchLighthouseScores(contextData.url), "Lighthouse");

    // Task 4: Backend Static Analysis (Synchronous/Instant)
    let backendMetrics = null;
    if (githubCodeText) {
      try {
        backendMetrics = StaticAnalyzer.analyze(githubCodeText);
      } catch (e) {
        console.error("Static Analysis failed:", e);
      }
    }

    // Run all tasks in parallel
    const [visionTaskRes, codeTaskRes, lighthouseMetrics] = await Promise.all([
      visionTask,
      codeTask,
      lighthouseTask
    ]);

    if (!visionTaskRes && !lighthouseMetrics && !backendMetrics) {
      return {
        issues: [],
        launchScore: 0,
        verdict: "broken",
        summary: "All analysis engines failed or timed out. This can happen if the AI provider is overloaded or the URL is not publicly accessible.",
        improvementPrompt: "N/A",
        analysisMode: "failed",
        provider: "None",
        warning: "CRITICAL FAILURE: No analysis data could be generated. Please check your API keys and network connectivity."
      };
    }

    let visionResult: AuditResponse | null = null;
    let codeResult: AuditResponse | null = null;

    if (visionTaskRes && visionTaskRes.text) {
      try {
        visionResult = parseJsonFromText(visionTaskRes.text);
      } catch (e) {
        console.warn("Failed to parse vision result", e);
      }
    }

    if (codeTaskRes && codeTaskRes.text) {
      try {
        codeResult = parseJsonFromText(codeTaskRes.text);
      } catch {
        codeResult = null;
      }
    }

    return this.mergeResults(visionResult, codeResult, lighthouseMetrics, backendMetrics, visionProvider.name, codeProvider?.name);
  }

  private static mergeResults(
    vision: AuditResponse | null,
    code: AuditResponse | null,
    lighthouse: LighthouseMetrics | null,
    backendMetrics: BackendMetrics | null,
    visionName: string,
    codeName?: string
  ): AuditResponse {
    const usedTools: string[] = [];
    if (lighthouse) usedTools.push("Lighthouse (PageSpeed Insights)");
    if (backendMetrics) usedTools.push("Static Analyzer (Security, Code Quality, Maintainability)");
    if (vision) usedTools.push(`${visionName} (AI Vision Analysis)`);
    if (code) usedTools.push(`${codeName || "AI"} (AI Code Analysis)`);

    // Graceful Fallback: If AI completely failed
    if (!vision && !code) {
      const fallbackFrontendScore = lighthouse
        ? Math.round((lighthouse.performance + lighthouse.accessibility + lighthouse.bestPractices + lighthouse.seo) / 4)
        : 0;
      const fallbackBackendScore = backendMetrics
        ? Math.round((backendMetrics.security + backendMetrics.codeQuality + backendMetrics.maintainability) / 3)
        : 0;
      const fallbackLaunchScore = Math.round((fallbackFrontendScore + fallbackBackendScore) / 2);

      const toolNote = usedTools.length > 0
        ? `This report was generated using: ${usedTools.join(", ")}.`
        : "No analysis tools were available.";

      // Generate issues from Lighthouse if AI failed
      const fallbackIssues: any[] = [];
      if (lighthouse) {
        if (lighthouse.performance < 70) {
          fallbackIssues.push({
            category: "performance",
            title: "Low Performance Score",
            severity: lighthouse.performance < 40 ? "high" : "medium",
            description: `The page performance is ${lighthouse.performance}/100, which can hurt user retention.`,
            fixPrompt: "Optimize image sizes, enable compression, and reduce unused JavaScript.",
            evidence: `Lighthouse Performance Score: ${lighthouse.performance}`,
            confidence: "high"
          });
        }
        if (lighthouse.accessibility < 90) {
          fallbackIssues.push({
            category: "accessibility",
            title: "Accessibility Improvements Needed",
            severity: "medium",
            description: `Accessibility score is ${lighthouse.accessibility}/100. Some users may face difficulty navigating.`,
            fixPrompt: "Check for color contrast, add missing labels to form elements, and ensure keyboard navigability.",
            evidence: `Lighthouse Accessibility Score: ${lighthouse.accessibility}`,
            confidence: "high"
          });
        }
      }

      // Generate issues from Static Analysis if AI failed
      if (backendMetrics) {
        if (backendMetrics.security < 80) {
          fallbackIssues.push({
            category: "security",
            title: "Security Risks Detected",
            severity: "high",
            description: `Static analysis detected potential security vulnerabilities (Score: ${backendMetrics.security}/100).`,
            fixPrompt: "Review code for hardcoded secrets, dangerous functions like eval(), and ensure all inputs are validated.",
            evidence: "Deterministic regex scan of repository code.",
            confidence: "high"
          });
        }
        if (backendMetrics.codeQuality < 70) {
          fallbackIssues.push({
            category: "architecture",
            title: "Code Quality & Patterns",
            severity: "medium",
            description: `Backend code quality is rated at ${backendMetrics.codeQuality}/100.`,
            fixPrompt: "Remove excessive console logs, use proper TypeScript types (avoid 'any'), and add try/catch blocks to async operations.",
            evidence: "Pattern-based analysis of codebase structure.",
            confidence: "medium"
          });
        }
      }

      return {
        issues: fallbackIssues,
        launchScore: fallbackLaunchScore,
        frontendScore: fallbackFrontendScore,
        backendScore: fallbackBackendScore,
        verdict: fallbackLaunchScore >= 70 ? "needs-fixes" : "broken",
        summary: `AI Analysis unavailable (quota limit reached). ${toolNote} We've generated a report based on Lighthouse and Static Code Analysis.`,
        improvementPrompt: `Frontend Improvements (based on Lighthouse):\n${
          lighthouse
            ? `Improve performance (current: ${lighthouse.performance}/100), accessibility (${lighthouse.accessibility}/100), best practices (${lighthouse.bestPractices}/100), and SEO (${lighthouse.seo}/100).`
            : "No frontend metrics available."
        }\n\nBackend Improvements (based on Static Analyzer):\n${
          backendMetrics
            ? `Address security issues (score: ${backendMetrics.security}/100), code quality (${backendMetrics.codeQuality}/100), and maintainability (${backendMetrics.maintainability}/100).`
            : "No backend metrics available."
        }`,
        analysisMode: "fallback-deterministic",
        provider: usedTools.join(" + ") || "None",
        lighthouse: lighthouse || undefined,
        backendMetrics: backendMetrics || undefined,
        warning: "AI Analysis unavailable. Showing findings from Lighthouse and Static Analysis tools.",
      };
    }

    // AI was used for at least one part
    // Use mergeIssues to deduplicate between vision and code issues
    const allIssues = mergeIssues(vision?.issues || [], code?.issues || []);

    const frontendScore = vision?.launchScore ?? (lighthouse ? Math.round((lighthouse.performance + lighthouse.accessibility + lighthouse.bestPractices + lighthouse.seo) / 4) : 0);
    const backendScore = code?.launchScore ?? (backendMetrics ? Math.round((backendMetrics.security + backendMetrics.codeQuality + backendMetrics.maintainability) / 3) : 0);
    const finalScore = Math.round((frontendScore + backendScore) / 2);

    let summaryText = "";
    if (vision && code) {
      summaryText = `${vision.summary} ${code.summary}`;
    } else if (vision) {
      summaryText = vision.summary;
    } else if (code) {
      summaryText = code.summary;
    }
    summaryText += " Since AI was used, this report includes more precise and contextual results.";

    const toolNote = `Analysis performed using: ${usedTools.join(", ")}.`;

    return {
      thoughtProcess: [...(vision?.thoughtProcess || []), ...(code?.thoughtProcess || [])],
      summary: `${summaryText} ${toolNote}`,
      issues: allIssues,
      launchScore: finalScore,
      frontendScore,
      backendScore,
      verdict: (vision?.verdict || code?.verdict || "needs-fixes") as AuditResponse["verdict"],
      improvementPrompt: `Frontend:\n${vision?.improvementPrompt || "N/A (Lighthouse metrics: " + (lighthouse ? `Performance ${lighthouse.performance}, Accessibility ${lighthouse.accessibility}, Best Practices ${lighthouse.bestPractices}, SEO ${lighthouse.seo}` : "N/A") + ")"}\n\nBackend:\n${code?.improvementPrompt || "N/A (Static Analyzer scores: " + (backendMetrics ? `Security ${backendMetrics.security}, Code Quality ${backendMetrics.codeQuality}, Maintainability ${backendMetrics.maintainability}` : "N/A") + ")"}`,
      analysisMode: vision && code ? "ai-split" : "ai-partial",
      provider: usedTools.join(" + "),
      lighthouse: lighthouse || undefined,
      backendMetrics: backendMetrics || undefined,
    };
  }
}
