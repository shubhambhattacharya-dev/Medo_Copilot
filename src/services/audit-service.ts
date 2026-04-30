import { generateText } from "ai";
import { AiProvider } from "./ai-service";
import type { AuditIssue } from "@/types/audit";
import type { PageSignals } from "@/lib/audit-helpers";

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

  /**
   * Orchestrates the dual-analysis process
   */
  static async runFullAudit(
    visionProvider: AiProvider,
    codeProvider: AiProvider | null,
    screenshots: string[],
    githubCodeText: string | null,
    contextData: { url: string; title: string; text: string; signals: PageSignals }
  ): Promise<any> {
    const tasks: Promise<any>[] = [];

    // Task 1: Vision Analysis
    const frontendPrompt = this.getFrontendPrompt(
      contextData.url, 
      contextData.title, 
      contextData.text, 
      contextData.signals, 
      visionProvider.supportsVision !== false
    );

    tasks.push(generateText({
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
    }));

    // Task 2: Code Analysis (Optional)
    if (codeProvider && githubCodeText) {
      tasks.push(generateText({
        model: codeProvider.model,
        prompt: this.getBackendPrompt(githubCodeText)
      }));
    }

    const results = await Promise.allSettled(tasks);
    
    const visionTaskRes = results[0].status === 'fulfilled' ? results[0].value : null;
    const codeTaskRes = results[1]?.status === 'fulfilled' ? results[1].value : null;

    if (!visionTaskRes) throw new Error("Vision analysis failed to return a result.");

    let visionResult: any;
    let codeResult: any;

    try {
      const visionMatch = visionTaskRes.text.match(/\{[\s\S]*\}/);
      if (!visionMatch?.[0]) throw new Error("No JSON found in vision response");
      visionResult = JSON.parse(visionMatch[0]);
    } catch {
      throw new Error(`Failed to parse vision result: ${visionTaskRes.text.slice(0, 200)}`);
    }

    if (codeTaskRes) {
      try {
        const codeMatch = codeTaskRes.text.match(/\{[\s\S]*\}/);
        if (codeMatch?.[0]) {
          codeResult = JSON.parse(codeMatch[0]);
        }
      } catch {
        codeResult = null;
      }
    }

    return this.mergeResults(visionResult, codeResult, visionProvider.name, codeProvider?.name);
  }

  private static mergeResults(vision: any, code: any, visionName: string, codeName?: string): any {
    const allIssues = [...(vision.issues || [])];
    if (code && code.issues) allIssues.push(...code.issues);

    const finalScore = Math.round((vision.launchScore + (code?.launchScore || vision.launchScore)) / 2);

    return {
      thoughtProcess: [...(vision.thoughtProcess || []), ...(code?.thoughtProcess || [])],
      summary: code ? `${vision.summary} ${code.summary}` : vision.summary,
      issues: allIssues,
      launchScore: finalScore,
      verdict: vision.verdict, // Use frontend verdict as base
      improvementPrompt: code 
        ? `Frontend:\n${vision.improvementPrompt}\n\nBackend:\n${code.improvementPrompt}`
        : vision.improvementPrompt,
      analysisMode: "ai-split",
      provider: code ? `${visionName} + ${codeName}` : visionName,
    };
  }
}
