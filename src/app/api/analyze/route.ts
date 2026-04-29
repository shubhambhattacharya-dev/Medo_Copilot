import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import * as cheerio from "cheerio";

// Define the exact JSON structure we want from the LLM
const ResultSchema = z.object({
  launchScore: z.number().describe("A score from 0 to 100 based on the app's readiness"),
  issues: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      description: z.string().describe("Why this matters and how it hurts conversion"),
      fixPrompt: z.string().describe("The exact prompt the user should copy-paste into MeDo to fix this"),
    })
  ).max(5).describe("List of top 5 UX/UI/Trust issues found on the page"),
});

type FallbackIssue = {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  fixPrompt: string;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildFallbackResult({
  title,
  content,
  reason,
}: {
  title: string;
  content: string;
  reason?: string;
}) {
  const issues: FallbackIssue[] = [];
  let score = 84;
  const normalized = `${title} ${content}`.toLowerCase();

  const pushIssue = (
    title: string,
    severity: FallbackIssue["severity"],
    description: string,
    fixPrompt: string,
    penalty: number
  ) => {
    issues.push({ title, severity, description, fixPrompt });
    score -= penalty;
  };

  if (reason?.includes("ENOTFOUND")) {
    pushIssue(
      "Website is not reachable",
      "high",
      "The URL could not be resolved from this server, so the audit cannot inspect the page content.",
      "Tell the user the domain must be public or available through a reachable preview URL. If this is a local app, use localhost or a tunnel URL.",
      18
    );
  } else if (reason) {
    pushIssue(
      "Fetch failed",
      "high",
      "The page request failed before analysis could start.",
      "Surface a clear error state with the exact URL and a retry action instead of a generic 500.",
      16
    );
  }

  if (!title || title.length < 8) {
    pushIssue(
      "Weak page title",
      "medium",
      "The page title does not clearly communicate what the app does.",
      "Rewrite the hero headline to state the outcome, audience, and main value in one line.",
      10
    );
  }

  if (!/(pricing|plan|trial|book|demo|get started|sign up|join waitlist)/i.test(normalized)) {
    pushIssue(
      "CTA is not obvious",
      "medium",
      "The content does not include a strong conversion action near the top of the page.",
      "Move a single primary CTA above the fold and make secondary actions visually quieter.",
      10
    );
  }

  if (!/(testimonial|review|trusted|customers|users|case study|social proof|as seen)/i.test(normalized)) {
    pushIssue(
      "Missing trust signals",
      "medium",
      "There is little evidence of proof, credibility, or social validation in the visible content.",
      "Add testimonials, usage stats, recognizable logos, or a short proof section close to the CTA.",
      9
    );
  }

  if (content.length < 300) {
    pushIssue(
      "Sparse above-the-fold copy",
      "low",
      "The visible content is thin, which usually makes the page feel under-explained.",
      "Add one sentence that clarifies the problem, one that explains the result, and one CTA line.",
      6
    );
  }

  return {
    launchScore: clampScore(score),
    issues: issues.slice(0, 5),
    analysisMode: "fallback",
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let validUrl = url;
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = "https://" + validUrl;
    }

    try {
      new URL(validUrl);
    } catch {
      return NextResponse.json({ error: "URL is invalid" }, { status: 400 });
    }

    // STEP 1: Fetch and Scrape the URL
    console.log(`Fetching HTML from: ${validUrl}`);
    let pageTitle = "";
    let pageText = "";
    let fetchReason = "";

    try {
      const response = await fetch(validUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });
      if (!response.ok) {
        fetchReason = `Failed to fetch URL: ${response.status} ${response.statusText}`;
      } else {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, svg, img, iframe, noscript").remove();
        pageTitle = $("title").text() || "";
        pageText = $("body").text().replace(/\s+/g, " ").trim().substring(0, 8000);
      }
    } catch (fetchError: unknown) {
      const message = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
      fetchReason = `Cannot reach the website. Make sure the URL is correct and public. (${message})`;
    }

    const fallbackResult = buildFallbackResult({
      title: pageTitle,
      content: pageText,
      reason: fetchReason || undefined,
    });

    if (fetchReason || !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(fallbackResult);
    }

    // STEP 2: Pass data to Gemini to analyze
    const prompt = `
      You are an expert UX/UI Product Manager. 
      Analyze the following content extracted from a MeDo app:
      
      URL: ${validUrl}
      Title: ${pageTitle}
      Content: ${pageText}
      
      Evaluate this page for:
      1. Trust signals (missing proof, unclear pricing)
      2. Mobile clarity (cramped layouts, tap targets)
      3. Conversion friction (weak CTA, distracting copy)
      
      Provide a launch score out of 100, and list the top issues with exact MeDo prompts to fix them.
    `;

    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: ResultSchema,
        prompt,
      });

      return NextResponse.json({ ...object, analysisMode: "ai" });
    } catch (llmError: unknown) {
      console.warn("Falling back to heuristic audit:", llmError);
      return NextResponse.json(fallbackResult);
    }

  } catch (error) {
    console.error("Audit API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze the app.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
