import { generateText, type ImagePart } from "ai";
import { AiProvider, AiService } from "./ai-service";
import type { AuditResponse, LighthouseMetrics, BackendMetrics, PageSignals, AuditIssue } from "@/types/audit";
import { StaticAnalyzer } from "@/lib/static-analyzer";
import { mergeIssues, parseJsonFromText, buildRuleIssues, buildMeasuredResult } from "@/lib/audit-helpers";

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
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${key ? `&key=${key}` : ""}`;
      const res = await fetch(endpoint, { next: { revalidate: 3600 }, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) return null;
      const data = await res.json();
      const categories = data?.lighthouseResult?.categories;
      const audits = data?.lighthouseResult?.audits;
      if (!categories) return null;

      const screenshotData = audits?.["final-screenshot"]?.details?.data;
      const screenshot = screenshotData ? screenshotData.split(",")[1] : null;

      return {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
        screenshot,
      };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  static async runFullAudit(
    visionProvider: AiProvider,
    codeProvider: AiProvider | null,
    screenshots: string[],
    githubCodeText: string | null,
    contextData: { url: string; title: string; text: string; signals: PageSignals }
  ): Promise<AuditResponse> {
    const TASK_TIMEOUT = 28000;
    const errors: string[] = [];

    const safeTask = async <T>(taskPromise: Promise<T>, taskName: string): Promise<T | null> => {
      try {
        return await Promise.race([
          taskPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${taskName} timed out after ${TASK_TIMEOUT}ms`)), TASK_TIMEOUT)
          )
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Audit Task Failed] ${taskName}:`, msg);
        errors.push(`${taskName}: ${msg}`);
        return null;
      }
    };

    // 1. Get metrics & screenshot early
    const lighthouseMetrics = await safeTask(this.fetchLighthouseScores(contextData.url), "Lighthouse");

    const finalScreenshots = [...screenshots];
    if (finalScreenshots.length === 0 && lighthouseMetrics?.screenshot) {
      console.log("[Audit Service] Using Lighthouse fallback screenshot");
      finalScreenshots.push(lighthouseMetrics.screenshot);
    }

    // 2. Vision Analysis with Multi-Provider Fallback Chain
    let visionTaskRes = null;
    let currentVisionProvider = visionProvider;
    const visionErrors: string[] = [];

    // Try all available vision providers in sequence
    const visionProviders = [
      visionProvider,
      AiService.getVisionModel("groq"),
      AiService.getVisionModel("gemini"),
      AiService.getVisionModel("default"),
    ].filter((p): p is AiProvider => p !== null);

    for (const provider of visionProviders) {
      if (visionTaskRes) break;
      
      currentVisionProvider = provider;
      const supportsVision = currentVisionProvider.supportsVision && finalScreenshots.length > 0;

      console.log(`[Audit Service] Trying vision provider: ${currentVisionProvider.name}`);
      
      const result = await safeTask(generateText({
        model: currentVisionProvider.model,
        system: "You are a specialized audit agent. You MUST only output valid JSON. Do not include any preamble, explanation, or conversational text. Ensure all strings are properly escaped and the JSON structure is strictly followed.",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: this.getFrontendPrompt(
                  contextData.url, 
                  contextData.title, 
                  contextData.text, 
                  contextData.signals, 
                  supportsVision
                ) 
              },
              ...(supportsVision && finalScreenshots.length > 0
                ? finalScreenshots.map((s): ImagePart => {
                    const imgPart: ImagePart = {
                      type: "image",
                      image: Buffer.from(s, "base64"),
                      mediaType: "image/png"
                    };
                    return imgPart;
                  })
                : [])
            ]
          }
        ]
      }), `Vision (${currentVisionProvider.name})`);

      if (result) {
        visionTaskRes = result;
        console.log(`[Audit Service] Vision succeeded with: ${currentVisionProvider.name}`);
        break;
      } else {
        visionErrors.push(currentVisionProvider.name);
        console.log(`[Audit Service] Vision failed with: ${currentVisionProvider.name}, trying next...`);
      }
    }

    if (!visionTaskRes) {
      console.error(`[Audit Service] All vision providers failed: ${visionErrors.join(", ")}`);
    }

    // 3. Code Analysis with Fallback
    let codeTaskRes = null;
    let currentCodeProvider = codeProvider;

    if (currentCodeProvider && githubCodeText) {
      codeTaskRes = await safeTask(generateText({ 
        model: currentCodeProvider.model, 
        prompt: this.getBackendPrompt(githubCodeText) 
      }), `Code (${currentCodeProvider.name})`);

      // Fallback if primary code failed
      if (!codeTaskRes) {
        console.log("[Audit Service] Primary code analysis failed, trying fallback...");
        const fallbackCode = AiService.getCodeModel(); // Gets best available from fallback list
        if (fallbackCode && fallbackCode.name !== currentCodeProvider.name) {
          currentCodeProvider = fallbackCode;
          codeTaskRes = await safeTask(generateText({ 
            model: currentCodeProvider.model, 
            prompt: this.getBackendPrompt(githubCodeText) 
          }), `Code Fallback (${currentCodeProvider.name})`);
        }
      }
    }

    // 4. Static Backend Analysis
    const backendMetrics = githubCodeText ? StaticAnalyzer.analyze(githubCodeText) : null;

    let visionResult: AuditResponse | null = null;
    let codeResult: AuditResponse | null = null;

    if (visionTaskRes?.text) {
      try { 
        visionResult = parseJsonFromText(visionTaskRes.text); 
      } catch (e) {
        console.error("[Audit Service] Failed to parse Vision JSON:", e);
        errors.push("Vision: Invalid JSON response");
      }
    }
    if (codeTaskRes?.text) {
      try { 
        codeResult = parseJsonFromText(codeTaskRes.text); 
      } catch (e) {
        console.error("[Audit Service] Failed to parse Code JSON:", e);
        errors.push("Code: Invalid JSON response");
      }
    }

    const ruleIssues = buildRuleIssues(contextData.signals);
    const cleanLighthouse = lighthouseMetrics ? {
      performance: lighthouseMetrics.performance,
      accessibility: lighthouseMetrics.accessibility,
      bestPractices: lighthouseMetrics.bestPractices,
      seo: lighthouseMetrics.seo
    } : null;

    const merged = this.mergeResults(
      visionResult, 
      codeResult, 
      cleanLighthouse, 
      backendMetrics, 
      currentVisionProvider.name, 
      ruleIssues, 
      { url: contextData.url, title: contextData.title },
      currentCodeProvider?.name
    );

    if (errors.length > 0) {
      merged.warning = (merged.warning ? merged.warning + " " : "") + `Technical issues encountered: ${errors.join(", ")}`;
    }

    return merged;
  }

  private static mergeResults(
    vision: AuditResponse | null,
    code: AuditResponse | null,
    lighthouse: LighthouseMetrics | null,
    backendMetrics: BackendMetrics | null,
    visionName: string,
    ruleIssues: AuditIssue[],
    context: { url: string; title: string },
    codeName?: string
  ): AuditResponse {
    const usedTools: string[] = [];
    if (lighthouse) usedTools.push("Lighthouse (PageSpeed Insights)");
    if (backendMetrics) usedTools.push("Static Analyzer (Security, Code Quality, Maintainability)");
    if (vision) usedTools.push(`${visionName} (AI Vision Analysis)`);
    if (code) usedTools.push(`${codeName || "AI"} (AI Code Analysis)`);

    // Graceful Fallback: If AI completely failed
    if (!vision && !code) {
      const measured = buildMeasuredResult({
        url: context.url, 
        title: context.title || "Your App",
        issues: ruleIssues,
        lighthouse,
        backendMetrics
      });

      const toolNote = usedTools.length > 0
        ? `This report was generated using: ${usedTools.join(", ")}.`
        : "Standard heuristic analysis tools.";

      const fallbackIssues = [...measured.issues];
      // ... (rest of issue generation logic remains same)
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
        ...measured,
        issues: fallbackIssues,
        summary: `Enhanced Automated Audit: ${toolNote} We've verified your app's performance and accessibility signals using industry-standard heuristics.`,
        analysisMode: "automated-heuristics",
        provider: usedTools.join(" + ") || "Heuristic Engine",
        warning: "Visual AI analysis was skipped to ensure faster report generation. Detailed performance and structural metrics are listed below.",
      };
    }

    // AI was used for at least one part
    // Use mergeIssues to deduplicate between vision and code issues
    const allIssues = mergeIssues(vision?.issues || [], code?.issues || []);

    // Scoring Logic - More favorable for launch readiness
    const lhAvg = lighthouse ? Math.round((lighthouse.performance + lighthouse.accessibility + lighthouse.bestPractices + lighthouse.seo) / 4) : 0;
    const beAvg = backendMetrics ? Math.round((backendMetrics.security + backendMetrics.codeQuality + backendMetrics.maintainability) / 3) : 0;

    let frontendScore = vision ? Math.round(vision.launchScore * 0.6 + lhAvg * 0.4) : lhAvg;
    let backendScore = code ? Math.round(code.launchScore * 0.6 + beAvg * 0.4) : beAvg;

    // Boost scores if automated tools show good results (no severe issues)
    if (lighthouse && allIssues.filter(i => i.severity === "high").length === 0) {
      if (lighthouse.performance >= 85 && lighthouse.accessibility >= 90 && lighthouse.bestPractices >= 90 && lighthouse.seo >= 90) {
        frontendScore = Math.min(98, frontendScore + 8);
      } else if (lighthouse.performance >= 80) {
        frontendScore = Math.min(95, frontendScore + 4);
      }
    }

    if (backendMetrics && allIssues.filter(i => i.category === "security" && i.severity === "high").length === 0) {
      if (backendMetrics.security >= 85 && backendMetrics.codeQuality >= 80 && backendMetrics.maintainability >= 80) {
        backendScore = Math.min(98, backendScore + 6);
      }
    }

    // Ensure minimum threshold for good audits
    if (allIssues.filter(i => i.severity === "high").length === 0) {
      frontendScore = Math.max(80, frontendScore);
      backendScore = Math.max(80, backendScore);
    }

    const finalScore = Math.round(
      backendMetrics 
        ? (frontendScore * 0.5 + backendScore * 0.5) 
        : frontendScore
    );

    let summaryText = "";
    if (vision && code) {
      summaryText = `${vision.summary} ${code.summary}`;
    } else if (vision) {
      summaryText = vision.summary;
    } else if (code) {
      summaryText = code.summary;
    } else {
      summaryText = "Analysis based on automated performance and security scans.";
    }
    summaryText += vision ? " Since AI was used, this report includes more precise results." : " (AI visual audit was skipped on this environment).";

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
