/**
 * Observability Service
 *
 * Integrates Langfuse for LLM tracing, cost tracking, and evaluation.
 * Falls back gracefully when Langfuse is not configured.
 *
 * Follows Langfuse best practices:
 * - Descriptive trace/observation names
 * - Nested spans for multi-step operations
 * - Model name + token usage on generations
 * - Metadata for filtering, tags for business dimensions
 * - PII-safe inputs (URLs only, no secrets)
 */

import Langfuse, {
  type LangfuseTraceClient,
  type LangfuseGenerationClient,
  type LangfuseSpanClient,
} from "langfuse";

let langfuseInstance: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (langfuseInstance) return langfuseInstance;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return null;
  }

  try {
    langfuseInstance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
      flushAt: 1,
      flushInterval: 1000,
    });

    console.log("[Observability] Langfuse initialized");
    return langfuseInstance;
  } catch (err) {
    console.error("[Observability] Failed to initialize Langfuse:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuditTraceData {
  auditId: string;
  url: string;
  userId?: string | null;
  provider: string;
  modelId?: string;
  visionModelId?: string;
  codeModelId?: string;
  hasScreenshots: boolean;
  hasGithubCode: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  frontendScore?: number;
  backendScore?: number;
  launchScore: number;
  verdict: string;
  issuesFound: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  analysisMode?: string;
  warning?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/* ------------------------------------------------------------------ */
/*  Trace creation                                                     */
/* ------------------------------------------------------------------ */

export function createFullAuditTrace(data: AuditTraceData): LangfuseTraceClient | null {
  const langfuse = getLangfuse();
  if (!langfuse) return null;

  try {
    const trace = langfuse.trace({
      id: data.auditId,
      name: "launch-audit",
      userId: data.userId || undefined,
      sessionId: data.userId ? `user-${data.userId}` : undefined,
      metadata: {
        source: "medo-copilot",
        url: data.url,
        provider: data.provider,
        modelId: data.modelId,
        visionModelId: data.visionModelId,
        codeModelId: data.codeModelId,
        hasScreenshots: data.hasScreenshots,
        hasGithubCode: data.hasGithubCode,
        analysisMode: data.analysisMode,
        warning: data.warning,
      },
      tags: [
        data.verdict,
        data.provider,
        data.hasScreenshots ? "screenshots" : "no-screenshots",
        data.hasGithubCode ? "github-code" : "no-github-code",
      ],
    });

    // Root generation spans the full audit run
    trace.generation({
      name: "audit-analysis",
      model: data.modelId || "unknown",
      modelParameters: {
        provider: data.provider,
        ...(data.visionModelId ? { visionModelId: data.visionModelId } : {}),
        ...(data.codeModelId ? { codeModelId: data.codeModelId } : {}),
      },
      input: { url: data.url },
      output: {
        launchScore: data.launchScore,
        verdict: data.verdict,
        issuesFound: data.issuesFound,
      },
      usage: {
        input: data.inputTokens,
        output: data.outputTokens,
        total: data.totalTokens,
        unit: "TOKENS",
      },
      metadata: {
        costUsd: data.estimatedCostUsd,
        latencyMs: data.latencyMs,
        frontendScore: data.frontendScore,
        backendScore: data.backendScore,
      },
    });

    trace.score({ name: "launch-score", value: data.launchScore / 100 });
    trace.score({ name: "quality", value: data.launchScore / 100 });

    if (data.verdict === "launch-ready") {
      trace.score({ name: "launch-ready", value: 1 });
    } else if (data.verdict === "broken") {
      trace.score({ name: "broken", value: 1 });
    }

    console.log(`[Observability] Trace created: ${data.auditId}`);
    return trace;
  } catch (err) {
    console.error("[Observability] Failed to create trace:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Span helpers (nested steps)                                        */
/* ------------------------------------------------------------------ */

export function createAuditPhaseSpan(
  trace: LangfuseTraceClient | null,
  name: string,
  input?: Record<string, unknown>,
): LangfuseSpanClient | null {
  if (!trace) return null;
  try {
    return trace.span({
      name,
      input: input || {},
    });
  } catch {
    return null;
  }
}

export function endSpan(span: LangfuseSpanClient | null, output?: Record<string, unknown>): void {
  if (!span) return;
  try {
    if (output) {
      span.update({
        output,
      });
    }
    span.end();
  } catch {
    // swallow
  }
}

export function createGenerationSpan(
  parent: LangfuseTraceClient | LangfuseSpanClient | null,
  name: string,
  modelId: string,
  provider: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  usage: TokenUsage,
  metadata?: Record<string, unknown>,
): LangfuseGenerationClient | null {
  if (!parent) return null;
  try {
    return parent.generation({
      name,
      model: modelId,
      modelParameters: { provider },
      input,
      output,
      usage: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
        unit: "TOKENS",
      },
      metadata: metadata || {},
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Flush / shutdown                                                   */
/* ------------------------------------------------------------------ */

export async function flushAuditTrace(trace: LangfuseTraceClient | null): Promise<void> {
  if (!trace) return;

  try {
    const langfuse = getLangfuse();
    if (langfuse) {
      await langfuse.flushAsync();
      console.log("[Observability] Trace flushed");
    }
  } catch (err) {
    console.error("[Observability] Failed to flush:", err);
  }
}

export function isObservabilityEnabled(): boolean {
  return getLangfuse() !== null;
}

export async function shutdownObservability() {
  if (langfuseInstance) {
    await langfuseInstance.shutdownAsync();
    langfuseInstance = null;
  }
}
