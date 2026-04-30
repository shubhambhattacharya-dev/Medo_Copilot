import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { saveAudit, getUserSettings } from "@/lib/audits";
import { fetchGithubRepoCode } from "@/lib/github";
import { auth } from "@clerk/nextjs/server";
import { AiService } from "@/services/ai-service";
import { AuditService } from "@/services/audit-service";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import {
  getPageSignals,
  buildRuleIssues,
  buildMeasuredResult,
  getErrorMessage,
  type AuditResponse,
  type PageSignals,
} from "@/lib/audit-helpers";

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
      lighthouse: result.lighthouse,
      backendMetrics: result.backendMetrics,
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

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await checkRateLimitAsync(req, { windowMs: 60 * 1000, maxRequests: 5 });
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit.resetIn);
    }

    const formData = await req.formData();
    const url = formData.get("url") as string | null;
    const userScreenshot = formData.get("screenshot") as string | null;
    const githubUrl = formData.get("githubUrl") as string | null;

    // Extract BYOK settings from form
    const formVisionProvider = formData.get("visionProvider") as string | null;
    const formVisionKey = formData.get("visionKey") as string | null;
    const formCodeProvider = formData.get("codeProvider") as string | null;
    const formCodeKey = formData.get("codeKey") as string | null;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch user API keys from database (if authenticated)
    let userSettings = null;
    try {
      const { userId } = await auth();
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
      } catch (err: unknown) {
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

    // Build rule-based issues and measured result (used as fallback)
    const ruleIssues = buildRuleIssues(pageSignals, fetchReason || undefined);
    const fallbackResult = buildMeasuredResult({
      url: validUrl,
      title: pageTitle,
      issues: ruleIssues,
    });

    if (fetchReason && !pageText) {
      console.error(`Audit Failed: ${fetchReason}`);
      return NextResponse.json(await attachSavedAuditId(validUrl, fallbackResult));
    }

    // Resolve AI Models
    const visionModel = AiService.getVisionModel(effectiveVisionProvider || undefined, effectiveVisionKey);
    const codeModel = effectiveCodeProvider ? AiService.getCodeModel(effectiveCodeProvider, effectiveCodeKey) : null;

    if (!visionModel) {
      console.error("No AI models configured! Check your keys.");
      return NextResponse.json(await attachSavedAuditId(validUrl, fallbackResult));
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
      return NextResponse.json(await attachSavedAuditId(validUrl, auditResult));

    } catch (llmError: unknown) {
      console.error("[Analysis Error]", llmError);
      return NextResponse.json(
        { error: `AI analysis failed: ${getErrorMessage(llmError)}. Please check your API keys and quota.` },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Audit API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to analyze the app.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
