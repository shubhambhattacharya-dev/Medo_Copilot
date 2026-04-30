"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreGauge } from "@/components/score-gauge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Construction,
  Copy,
  ExternalLink,
  Info,
  Lightbulb,
  Shield,
  ShieldAlert,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";

type AuditIssue = {
  category?: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  fixPrompt: string;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
};

type AuditResult = {
  launchScore: number;
  issues: AuditIssue[];
  error?: string;
  analysisMode?: string;
  verdict?: "launch-ready" | "broken" | "needs-fixes";
  provider?: string;
  summary?: string;
  improvementPrompt?: string;
  thoughtProcess?: string[];
  auditedUrl?: string;
};

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (verdict === "launch-ready")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
        <CheckCircle2 className="h-4 w-4" /> Launch Ready
      </span>
    );
  if (verdict === "broken")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-4 py-1.5 text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
        <XCircle className="h-4 w-4" /> Broken
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-400 ring-1 ring-amber-500/20">
      <AlertTriangle className="h-4 w-4" /> Needs Fixes
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "high"
      ? "bg-red-500"
      : severity === "medium"
        ? "bg-amber-500"
        : "bg-blue-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function CategoryIcon({ category }: { category?: string }) {
  switch (category) {
    case "security":
    case "trust":
      return <Shield className="h-4 w-4" />;
    case "performance":
      return <Zap className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
}

// Loading skeleton
function AuditSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse space-y-8 px-4 py-12">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-muted/50" />
        <div className="h-5 w-40 rounded bg-muted/50" />
      </div>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="h-48 w-48 rounded-full border-8 border-muted/30 bg-muted/20" />
        <div className="h-6 w-56 rounded bg-muted/40" />
        <div className="h-4 w-80 rounded bg-muted/30" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl border border-border/40 bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

// Empty state — user navigated here directly
function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
        <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/60" />
      </div>
      <h2 className="text-2xl font-semibold">No audit data found</h2>
      <p className="max-w-md text-muted-foreground">
        Run an audit from the home page first. Paste your app URL and hit
        &quot;Analyze app&quot; — your full report will appear here.
      </p>
      <Button onClick={() => router.push("/")} className="mt-2 rounded-2xl px-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Go to Home
      </Button>
    </div>
  );
}

// Error state
function ErrorState({ error }: { error: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <XCircle className="mx-auto h-12 w-12 text-red-400" />
      </div>
      <h2 className="text-2xl font-semibold">Audit Error</h2>
      <p className="max-w-md text-muted-foreground">{error}</p>
      <Button onClick={() => router.push("/")} variant="outline" className="mt-2 rounded-2xl px-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Try Again
      </Button>
    </div>
  );
}

export default function AuditPage() {
  const router = useRouter();
  const [result, setResult] = useState<AuditResult | null>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("medo_audit_result");
      if (!raw) {
        setStatus("empty");
        return;
      }
      const parsed: AuditResult = JSON.parse(raw);
      if (parsed.error && !parsed.issues?.length) {
        setErrorMsg(parsed.error);
        setStatus("error");
        return;
      }
      setResult(parsed);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to parse audit data:", err);
      setErrorMsg("Could not load audit data. The stored result may be corrupted.");
      setStatus("error");
    }
  }, []);

  if (status === "loading") return <AuditSkeleton />;
  if (status === "empty") return <EmptyState />;
  if (status === "error") return <ErrorState error={errorMsg} />;
  if (!result) return <EmptyState />;

  const highCount = result.issues.filter((i) => i.severity === "high").length;
  const medCount = result.issues.filter((i) => i.severity === "medium").length;
  const lowCount = result.issues.filter((i) => i.severity === "low").length;

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -left-40 top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-slate-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Medo Copilot</span>
          </div>
        </div>

        {/* WIP Banner */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur">
          <Construction className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium text-cyan-300">Work in Progress</p>
            <p className="mt-1 text-xs leading-5 text-cyan-300/70">
              This tool is actively being improved. New checks, better accuracy,
              and smarter suggestions are being added regularly. Your feedback
              helps us get better.
            </p>
          </div>
        </div>

        {/* Score Hero */}
        <section className="mt-10 flex flex-col items-center gap-6 text-center">
          <ScoreGauge score={result.launchScore} size={210} strokeWidth={14} />

          <VerdictBadge verdict={result.verdict} />

          {result.summary && (
            <p className="max-w-xl text-base text-muted-foreground">{result.summary}</p>
          )}

          {/* Meta pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {result.provider && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                Provider: <strong className="text-foreground">{result.provider}</strong>
              </span>
            )}
            {result.analysisMode && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                Mode: <strong className="text-foreground">{result.analysisMode}</strong>
              </span>
            )}
            {result.auditedUrl && (
              <a
                href={result.auditedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                {result.auditedUrl.replace(/^https?:\/\//, "").slice(0, 40)}
              </a>
            )}
          </div>

          {/* Severity summary */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {highCount > 0 && (
              <span className="flex items-center gap-1.5">
                <SeverityDot severity="high" /> {highCount} High
              </span>
            )}
            {medCount > 0 && (
              <span className="flex items-center gap-1.5">
                <SeverityDot severity="medium" /> {medCount} Medium
              </span>
            )}
            {lowCount > 0 && (
              <span className="flex items-center gap-1.5">
                <SeverityDot severity="low" /> {lowCount} Low
              </span>
            )}
            {result.issues.length === 0 && <span>No issues found 🎉</span>}
          </div>
        </section>

        {/* Accuracy Warning */}
        <section className="mt-10">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 backdrop-blur">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  AI-Powered Analysis — Not 100% Accurate
                </p>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-200/70">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
                    This audit uses AI (LLM) to analyze page content and screenshots. AI can misinterpret visual elements or miss context-specific nuances.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
                    Rule-based checks (meta tags, CTA keywords, alt text) are deterministic and highly reliable. AI-generated findings carry medium confidence.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
                    {result.analysisMode === "fallback"
                      ? "This report used text-only fallback mode — visual layout, colors, and spacing could not be verified."
                      : "Screenshot-based analysis improves accuracy to ~85-90%, but edge cases may still be missed."}
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-amber-400/60" />
                    For production decisions, always combine this report with manual QA testing.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Issues Grid */}
        {result.issues.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="h-5 w-5 text-cyan-400" />
              Issues Found ({result.issues.length})
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {result.issues.map((issue, idx) => {
                const isExpanded = expandedIssue === idx;
                return (
                  <div
                    key={`${issue.title}-${idx}`}
                    className="group rounded-2xl border border-border/60 bg-background/70 p-5 backdrop-blur transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-border/50 bg-muted/40 p-1.5">
                          <CategoryIcon category={issue.category} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{issue.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                issue.severity === "high"
                                  ? "bg-red-500/10 text-red-400"
                                  : issue.severity === "medium"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-blue-500/10 text-blue-400"
                              }`}
                            >
                              {issue.severity}
                            </span>
                            {issue.category && (
                              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {issue.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {issue.description}
                    </p>

                    {(issue.evidence || issue.confidence) && (
                      <button
                        onClick={() => setExpandedIssue(isExpanded ? null : idx)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? "Less" : "More details"}
                      </button>
                    )}

                    {isExpanded && (
                      <div className="mt-2 space-y-1 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                        {issue.evidence && (
                          <p>
                            <strong className="text-foreground/80">Evidence:</strong>{" "}
                            {issue.evidence}
                          </p>
                        )}
                        {issue.confidence && (
                          <p>
                            <strong className="text-foreground/80">Confidence:</strong>{" "}
                            {issue.confidence}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => copyText(issue.fixPrompt, "Fix prompt")}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-muted/30 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" /> Copy Fix Prompt
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Improvement Prompt */}
        {result.improvementPrompt && (
          <section className="mt-10">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur">
              <div className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-300">
                    Ready-to-Paste Improvement Prompt
                  </p>
                  <p className="mt-1 text-xs text-emerald-300/60">
                    Copy this prompt and paste it into MeDo to apply all suggested fixes at once.
                  </p>
                  <div className="mt-4 rounded-xl bg-black/30 p-4">
                    <pre className="whitespace-pre-wrap text-xs leading-6 text-emerald-100/80">
                      {result.improvementPrompt}
                    </pre>
                  </div>
                  <Button
                    onClick={() => copyText(result.improvementPrompt!, "Improvement prompt")}
                    className="mt-4 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Full Prompt
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AI Thinking Process */}
        {result.thoughtProcess && result.thoughtProcess.length > 0 && (
          <section className="mt-10">
            <button
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/70 p-5 text-left backdrop-blur transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <span className="text-sm font-semibold">AI Thinking Process</span>
                <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {result.thoughtProcess.length} steps
                </span>
              </div>
              {thinkingOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {thinkingOpen && (
              <div className="mt-3 space-y-3 pl-4">
                {result.thoughtProcess.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-400">
                        {idx + 1}
                      </div>
                      {idx < result.thoughtProcess!.length - 1 && (
                        <div className="mt-1 h-full w-px bg-border/50" />
                      )}
                    </div>
                    <p className="pb-3 text-xs leading-5 text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border/40 pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <strong className="text-foreground">Medo Copilot</strong> — AI Launch Auditor
          </p>
          <Button
            onClick={() => {
              localStorage.removeItem("medo_audit_result");
              router.push("/");
            }}
            variant="outline"
            className="rounded-2xl px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Run Another Audit
          </Button>
        </div>
      </div>
    </main>
  );
}
