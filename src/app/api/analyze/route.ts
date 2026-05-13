import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { chromium, type Browser } from "playwright";
import { saveAudit, getUserSettings, getCachedAudit } from "@/lib/audits";
import { fetchGithubRepoCode } from "@/lib/github";
import { auth } from "@clerk/nextjs/server";
import { AiService } from "@/services/ai-service";
import { AuditService } from "@/services/audit-service";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { StaticAnalyzer } from "@/lib/static-analyzer";
import {
  getPageSignals,
  buildRuleIssues,
  buildMeasuredResult,
  getErrorMessage,
} from "@/lib/audit-helpers";
import {
  type AuditResponse,
  type PageSignals,
  type ApiResponse,
} from "@/types/audit";
import {
  AuditError,
  ValidationError,
  RateLimitError,
  BrowserError,
  AIProviderError,
} from "@/lib/custom-errors";

// ... rest of imports ...

function createErrorResponse(error: unknown): NextResponse<ApiResponse<any>> {
  if (error instanceof AuditError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code, retryAfter: error.status === 429 ? 60 : undefined },
      { status: error.status }
    );
  }
  const message = error instanceof Error ? error.message : "An unexpected error occurred during analysis.";
  return NextResponse.json(
    { success: false, error: message, code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

// Browser pooling
let browserInstance: Browser | null = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
  }
  return browserInstance;
}

async function attachSavedAuditId(url: string, result: AuditResponse, userId?: string | null) {
  try {
    // Don't save failed audits to cache, so users can retry immediately
    if (result.analysisMode === "failed" || result.launchScore === 0) {
      return result;
    }

    const auditId = await saveAudit({
      url,
      launchScore: result.launchScore,
      verdict: result.verdict,
      summary: result.summary,
      issues: result.issues,
      improvementPrompt: result.improvementPrompt,
      analysisMode: result.analysisMode,
      provider: result.provider,
      lighthouse: result.lighthouse,
      backendMetrics: result.backendMetrics,
      warning: result.warning,
      userId: userId ?? undefined,
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

export const maxDuration = 60; // Max duration for Vercel (if on Pro)

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AuditResponse>>> {
  const startTime = Date.now();
  console.log("[Audit API] Request started");
  try {
    const rateLimit = await checkRateLimitAsync(req, { windowMs: 60 * 1000, maxRequests: 5 });
    if (!rateLimit.success) {
      throw new RateLimitError(rateLimit.resetIn);
    }

    const formData = await req.formData();
    const url = formData.get("url") as string | null;
    const force = formData.get("force") === "true";
    const userScreenshot = formData.get("screenshot") as string | null;
    const githubUrl = formData.get("githubUrl") as string | null;

    if (!url || typeof url !== "string") {
      throw new ValidationError("URL is required");
    }

    let validUrl = url.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = `https://${validUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(validUrl);
    } catch {
      throw new ValidationError("URL is invalid");
    }

    // Check for cached audit (within last 1 hour) - early exit if not forced
    if (!force) {
      const cachedAudit = await getCachedAudit(validUrl);
      if (cachedAudit) {
        console.log(`[Audit API] Returning cached audit for ${validUrl}`);
        return NextResponse.json({ success: true, data: cachedAudit as unknown as AuditResponse });
      }
    }

    // Strip fragment for the actual fetch/analysis as it's client-side only
    const fetchUrl = parsedUrl.origin + parsedUrl.pathname + parsedUrl.search;

    // Extract BYOK settings from form
    const formVisionProvider = formData.get("visionProvider") as string | null;
    const formVisionKey = formData.get("visionKey") as string | null;
    const formCodeProvider = formData.get("codeProvider") as string | null;
    const formCodeKey = formData.get("codeKey") as string | null;

    // Fetch user API keys from database (if authenticated)
    let userSettings: Awaited<ReturnType<typeof getUserSettings>> | null = null;
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId || null;
      if (userId) {
        userSettings = await getUserSettings(userId);
      }
    } catch (e) {
      console.warn("Could not fetch user API keys:", e);
    }

    // Determine effective models to use (form input > db > default server keys)
    const effectiveVisionProvider = formVisionProvider && formVisionProvider !== "default"
      ? formVisionProvider
      : (userSettings?.visionProvider && userSettings.visionProvider !== "default" ? userSettings.visionProvider : null);

    const effectiveVisionKey = formVisionKey || userSettings?.visionKey || null;

    const effectiveCodeProvider = formCodeProvider && formCodeProvider !== "default"
      ? formCodeProvider
      : (userSettings?.codeProvider && userSettings.codeProvider !== "default" ? userSettings.codeProvider : null);

    const effectiveCodeKey = formCodeKey || userSettings?.codeKey || null;

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new ValidationError("Only HTTP and HTTPS URLs can be audited");
    }

    if (isPrivateOrLocalUrl(parsedUrl)) {
      throw new ValidationError("Use a public preview URL. Localhost and private network URLs cannot be audited safely.");
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
      hasViewport: false,
    };
    let fetchReason = "";
    let screenshots: string[] = [];

    let githubCodeText = "";
    if (githubUrl && typeof githubUrl === "string") {
      const githubPattern = /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+(\/tree\/[\w.-]+)?\/?$/;
      if (!githubPattern.test(githubUrl)) {
        throw new ValidationError("Invalid GitHub URL. Must match pattern like github.com/owner/repo or github.com/owner/repo/tree/branch");
      }
      console.log(`Fetching GitHub code from: ${githubUrl}`);
      try {
        const ghResult = await fetchGithubRepoCode(githubUrl);
        if (ghResult.text) {
          githubCodeText = ghResult.text;
        }
      } catch (err: unknown) {
        console.error("GitHub fetch failed:", err);
      }
    }

    // Collect all screenshots (limit to 7)
    formData.forEach((value, key) => {
      if (key.startsWith("screenshot_") && typeof value === "string" && screenshots.length < 7) {
        screenshots.push(value);
      }
    });

    // Also check for single userScreenshot field
    if (userScreenshot && typeof userScreenshot === "string" && screenshots.length < 7 && userScreenshot.length > 100) {
      screenshots.push(userScreenshot);
    }

    // Enforce final limit
    screenshots = screenshots.slice(0, 7);

    for (const screenshot of screenshots) {
      let decoded: Buffer;
      try {
        decoded = Buffer.from(screenshot, "base64");
      } catch {
        throw new ValidationError("Invalid screenshot format. Must be valid base64.");
      }
      if (decoded.length > 5 * 1024 * 1024) {
        throw new ValidationError("Screenshot too large. Must be under 5MB.");
      }
    }

    if (userScreenshot && typeof userScreenshot === "string" && userScreenshot.length > 100) {
      console.log("User provided screenshot - using for analysis...");
      screenshots.push(userScreenshot);
    }

    if (screenshots.length === 0) {
      try {
        console.log(`Launching browser for ${validUrl}...`);
        const browser = await getBrowser();
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        });
        const page = await context.newPage();

        try {
          console.log(`Navigating to ${validUrl}...`);
          const navigationPromise = page.goto(validUrl, { waitUntil: "load", timeout: 15000 });

          await Promise.race([
            navigationPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Navigation timeout")), 12000)
            )
          ]);

          await page.waitForTimeout(1000);
          const screenshot = await page.screenshot({ type: "png" });
          screenshots.push(screenshot.toString("base64"));

          const html = await page.content();
          const $ = cheerio.load(html);
          pageSignals = getPageSignals($);
          pageTitle = pageSignals.title || parsedUrl.hostname;
          pageText = pageSignals.text.substring(0, 8000);
        } catch (navErr: unknown) {
          console.warn("Browser navigation failed, attempting static fetch fallback:", navErr);
          throw navErr; // Trigger static fetch below
        } finally {
          await context.close().catch(() => {});
        }
      } catch (browserError: unknown) {
        console.log("Browser unavailable or failed, using static fetch fallback...");
        try {
          const res = await fetch(fetchUrl, {
            headers: { 
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            next: { revalidate: 0 }
          });
          
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          const html = await res.text();
          if (!html || html.length < 100) throw new Error("Empty or thin content received");

          const $ = cheerio.load(html);
          pageSignals = getPageSignals($);
          pageTitle = pageSignals.title || parsedUrl.hostname;
          pageText = pageSignals.text.substring(0, 8000);
          
          // CRITICAL: Clear reason because we successfully got content!
          fetchReason = ""; 
          console.log(`Static fetch succeeded for ${fetchUrl} (${html.length} bytes)`);
        } catch (staticErr: unknown) {
          const errMsg = getErrorMessage(staticErr);
          fetchReason = `Fetch failed: Browser unavailable and Static Fallback failed (${errMsg}).`;
          console.error(`[Audit API] All fetch methods failed for ${fetchUrl}: ${errMsg}`);
        }
      }
    }

    // Build rule-based issues and measured result (used as fallback)
    const ruleIssues = buildRuleIssues(pageSignals, fetchReason || undefined);
    
    // Early fetch of deterministic metrics to ensure fallback richness
    const [lighthouse, backendMetrics] = await Promise.all([
      AuditService.fetchLighthouseScores(validUrl),
      githubCodeText ? StaticAnalyzer.analyze(githubCodeText) : Promise.resolve(null)
    ]);

    const fallbackResult = buildMeasuredResult({
      url: validUrl,
      title: pageTitle,
      issues: ruleIssues,
      lighthouse,
      backendMetrics,
    });

    if (fetchReason && !pageText) {
      console.error(`Audit Failed: ${fetchReason}`);
      const finalized = await attachSavedAuditId(validUrl, fallbackResult, userId);
      return NextResponse.json({ success: true, data: finalized });
    }

    // Check for cached audit (within last 1 hour)
    const cachedAudit = await getCachedAudit(validUrl);
    if (cachedAudit) {
      console.log(`[Audit API] Returning cached audit for ${validUrl}`);
      return NextResponse.json({ success: true, data: cachedAudit as unknown as AuditResponse });
    }

    // Resolve AI Models
    const visionModel = AiService.getVisionModel(effectiveVisionProvider || undefined, effectiveVisionKey);
    const codeModel = effectiveCodeProvider ? AiService.getCodeModel(effectiveCodeProvider, effectiveCodeKey) : null;

    if (!visionModel) {
      console.error("No AI models configured! Check your keys.");
      const finalized = await attachSavedAuditId(validUrl, fallbackResult, userId);
      return NextResponse.json({ success: true, data: finalized });
    }

    // Run Analysis via AuditService
    try {
      const auditResult = await AuditService.runFullAudit(
        visionModel,
        codeModel,
        screenshots,
        githubCodeText,
        {
          url: validUrl,
          title: pageTitle,
          text: pageText,
          signals: pageSignals
        }
      );

      // Save and Return
      const finalized = await attachSavedAuditId(validUrl, auditResult, userId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Audit API] Analysis complete in ${duration}s`);
      
      return NextResponse.json({ success: true, data: finalized });

    } catch (llmError: unknown) {
      console.error("[Analysis Error]", llmError);
      
      // Even if AI completely fails (throws), we still return the deterministic results
      const errorResult: AuditResponse = {
        ...fallbackResult,
        warning: `AI Analysis failed: ${getErrorMessage(llmError)}. Showing deterministic metrics only.`
      };
      
      const finalized = await attachSavedAuditId(validUrl, errorResult, userId);
      return NextResponse.json({ success: true, data: finalized });
    }
  } catch (error) {
    console.error("Audit API Error:", error);
    return createErrorResponse(error);
  }
}
