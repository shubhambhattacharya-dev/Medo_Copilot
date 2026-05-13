"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScoreGauge } from "@/components/score-gauge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FRONTEND_CATEGORIES } from "@/types/audit";
import type { AuditIssue, LighthouseMetrics, BackendMetrics } from "@/types/audit";
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  Info,
  LayoutPanelLeft,
  Lightbulb,
  MessageSquare,
  MousePointerClick,
  Server,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Database,
  XCircle,
  Zap,
  RotateCcw,
  TrendingUp,
  Clock,
  Gauge,
  Cpu,
} from "lucide-react";
import { escapeHtml } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────
type AuditResult = {
  launchScore: number;
  frontendScore?: number;
  backendScore?: number;
  issues: AuditIssue[];
  error?: string;
  analysisMode?: string;
  verdict?: "launch-ready" | "broken" | "needs-fixes";
  provider?: string;
  summary?: string;
  improvementPrompt?: string;
  thoughtProcess?: string[];
  auditedUrl?: string;
  lighthouse?: LighthouseMetrics;
  backendMetrics?: BackendMetrics;
  warning?: string;
};

// ─── Helpers ──────────────────────────────────────────
const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
const severityConfig = {
  high: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500", label: "High" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500", label: "Medium" },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500", label: "Low" },
};

function CategoryIcon({ category }: { category?: string }) {
  const cls = "h-4 w-4";
  switch (category) {
    case "security": return <Shield className={`${cls} text-red-400`} />;
    case "trust": return <Shield className={`${cls} text-amber-400`} />;
    case "performance": return <Zap className={`${cls} text-yellow-400`} />;
    case "copy": return <MessageSquare className={`${cls} text-blue-400`} />;
    case "cta": return <MousePointerClick className={`${cls} text-cyan-400`} />;
    case "mobile": return <Smartphone className={`${cls} text-purple-400`} />;
    case "accessibility": return <Eye className={`${cls} text-indigo-400`} />;
    case "empty-state": case "error-state": return <AlertTriangle className={`${cls} text-amber-400`} />;
    case "architecture": case "backend-error": return <FileCode className={`${cls} text-orange-400`} />;
    case "database": return <Database className={`${cls} text-emerald-400`} />;
    default: return <Info className={`${cls} text-muted-foreground`} />;
  }
}

function categoryLabel(cat?: string) {
  if (!cat) return "General";
  return cat.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function copyText(text: string, label: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    toast.success(`${label} copied!`);
  } catch { toast.error("Failed to copy. Please select and copy manually."); }
}

// ─── Loading Skeleton ─────────────────────────────────
function AuditSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3"><div className="h-9 w-36 rounded-xl bg-muted/40" /><div className="ml-auto h-8 w-8 rounded-xl bg-muted/40" /></div>
        <div className="mt-8 h-16 rounded-2xl bg-muted/20" />
        <div className="mt-10 flex flex-col items-center gap-6">
          <div className="h-52 w-52 rounded-full border-[10px] border-muted/20 bg-muted/10" />
          <div className="h-8 w-48 rounded-full bg-muted/30" />
          <div className="h-5 w-96 rounded bg-muted/20" />
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-44 rounded-2xl border border-border/30 bg-muted/10" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────
function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-cyan-500/10 blur-2xl" />
        <div className="relative rounded-3xl border border-border/50 bg-background/80 p-8 backdrop-blur">
          <ShieldAlert className="mx-auto h-14 w-14 text-muted-foreground/40" />
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">No audit report found</h2>
        <p className="mt-3 max-w-md text-muted-foreground">Run an audit from the home page first — paste your app URL and we&apos;ll generate a full report.</p>
      </div>
      <Button onClick={() => router.push("/")} size="lg" className="rounded-2xl px-8 shadow-lg shadow-cyan-500/10">
        <ArrowLeft className="mr-2 h-4 w-4" /> Start New Audit
      </Button>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────
function ErrorState({ error }: { error: string }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 text-center">
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8">
        <XCircle className="mx-auto h-14 w-14 text-red-400/80" />
      </div>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Audit Failed</h2>
        <p className="mt-3 max-w-lg text-muted-foreground">{error}</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => router.push("/")} variant="outline" className="rounded-2xl px-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
        <Button onClick={() => { localStorage.removeItem("medo_audit_result"); router.push("/"); }} className="rounded-2xl px-6">
          <RotateCcw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function AuditPage() {
  const router = useRouter();

  const [data, setData] = useState<{
    status: "loading" | "empty" | "ready" | "error";
    result: AuditResult | null;
    errorMsg: string;
  }>({ status: "loading", result: null, errorMsg: "" });
  
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentDate(new Date().toLocaleDateString());

    try {
      // Check localStorage first, then fallback to sessionStorage
      let raw = localStorage.getItem("medo_audit_result");
      if (!raw && typeof sessionStorage !== "undefined") {
        raw = sessionStorage.getItem("medo_audit_result");
      }

      if (!raw) {
        setData({ status: "empty", result: null, errorMsg: "" });
        return;
      }
      const parsed: AuditResult = JSON.parse(raw);

      // If we have issues, a score, or a specific failure mode/warning, it's a result we should show
      if (
        parsed.issues?.length > 0 || 
        parsed.launchScore > 0 || 
        parsed.analysisMode === "failed" || 
        parsed.warning ||
        parsed.error
      ) {
        if (parsed.error && !parsed.issues?.length && parsed.launchScore === 0) {
           setData({ status: "error", result: null, errorMsg: parsed.error });
        } else {
           setData({ status: "ready", result: parsed, errorMsg: "" });
        }
      } else {
        setData({ status: "empty", result: null, errorMsg: "" });
      }
    } catch {
      setData({ status: "error", result: null, errorMsg: "Could not load audit data." });
    }
  }, []);
  const { status, result, errorMsg } = data;
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  if (status === "loading") return <AuditSkeleton />;
  if (status === "empty") return <EmptyState />;
  if (status === "error") return <ErrorState error={errorMsg} />;
  if (!result) return <EmptyState />;

  const sortedIssues = [...result.issues].sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));
  const highCount = sortedIssues.filter(i => i.severity === "high").length;
  const medCount = sortedIssues.filter(i => i.severity === "medium").length;
  const lowCount = sortedIssues.filter(i => i.severity === "low").length;

  const verdictColor = result.verdict === "launch-ready"
    ? { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", icon: <CheckCircle2 className="h-5 w-5" />, label: "Launch Ready" }
    : result.verdict === "broken"
      ? { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/25", icon: <XCircle className="h-5 w-5" />, label: "Broken" }
      : { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25", icon: <AlertTriangle className="h-5 w-5" />, label: "Needs Fixes" };

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* ── Ambient Background ── */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-60 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.07] blur-[100px]" />
        <div className="absolute -right-40 top-20 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.05] blur-[100px]" />
        <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-violet-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <button onClick={() => router.push("/")} className="group inline-flex items-center gap-2.5 rounded-2xl border border-border/50 bg-background/70 px-5 py-2.5 text-sm font-medium backdrop-blur-xl transition-all hover:border-border hover:bg-muted/40 hover:shadow-lg hover:shadow-black/5">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Home
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-wide">Medo Copilot</span>
          </div>
        </header>

        {/* ── Report Banner ── */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-5 py-3.5 backdrop-blur-sm">
          <BadgeCheck className="h-4 w-4 shrink-0 text-cyan-400" />
          <p className="text-xs leading-5 text-cyan-300/80"><span className="font-semibold text-cyan-300">Verified Analysis</span> — This report was generated using state-of-the-art vision models and deterministic heuristics.</p>
        </div>

        {/* ── Score Hero ── */}
        <section className="mt-12 flex flex-col items-center gap-8">
          <div className="flex flex-wrap justify-center gap-12 sm:gap-24">
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Frontend Score</h3>
              <ScoreGauge score={result.frontendScore ?? result.launchScore} size={160} strokeWidth={12} />
            </div>
            
            {(result.backendScore !== undefined || result.backendMetrics) ? (
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Backend Score</h3>
                <ScoreGauge score={result.backendScore ?? result.launchScore} size={160} strokeWidth={12} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-4">
            <span className={`inline-flex items-center gap-2 rounded-full ${verdictColor.bg} ${verdictColor.border} border px-5 py-2 text-sm font-bold ${verdictColor.text}`}>
              {verdictColor.icon} {verdictColor.label}
            </span>
            {result.summary && <p className="max-w-2xl text-center text-base leading-7 text-muted-foreground">{result.summary}</p>}
          </div>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {result.provider && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                <Zap className="h-3 w-3 text-cyan-400" /> {result.provider}
              </span>
            )}
            {result.analysisMode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                <TrendingUp className="h-3 w-3 text-emerald-400" /> {result.analysisMode} mode
              </span>
            )}
            {result.auditedUrl && (
              <a href={result.auditedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground">
                <ExternalLink className="h-3 w-3" /> {result.auditedUrl.replace(/^https?:\/\//, "").slice(0, 35)}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
              <Clock className="h-3 w-3" /> {currentDate || "..."}
            </span>
          </div>

          {/* Severity Summary Pills */}
          {sortedIssues.length > 0 && (
            <div className="flex items-center gap-3">
              {highCount > 0 && <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {highCount} Critical</span>}
              {medCount > 0 && <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {medCount} Warning</span>}
              {lowCount > 0 && <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {lowCount} Info</span>}
            </div>
          )}
          {sortedIssues.length === 0 && !result.warning && <p className="text-sm text-emerald-400 font-medium">✨ No issues found — your app looks great!</p>}
          
          {/* ── AI Failure Warning Banner ── */}
          {result.warning && (
            <div className="w-full mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex flex-col gap-1 text-left">
                  <h3 className="font-semibold text-amber-500">Partial Audit Results</h3>
                  <p className="text-sm text-amber-500/80 leading-relaxed">
                    {result.warning} Deterministic metrics (Lighthouse & Static Analysis) are displayed below, but the AI could not generate UX/UI issues.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Accuracy Warning ── */}
        <section className="mt-14">
          <div className="overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent backdrop-blur-sm">
            <div className="flex items-start gap-4 p-5">
              <div className="mt-0.5 rounded-xl bg-amber-500/10 p-2"><AlertTriangle className="h-4 w-4 text-amber-400" /></div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-300">AI-Powered Analysis — Not 100% Accurate</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    "AI may misinterpret visual elements or miss context-specific nuances in page design.",
                    "Rule-based checks (meta tags, CTA keywords, alt text) are deterministic and highly reliable.",
                    result.analysisMode === "fallback" ? "Text-only fallback mode was used — visual layout could not be verified." : "Screenshot analysis provides ~85-90% accuracy for visual issues.",
                    "For production decisions, combine this report with manual QA and real user testing.",
                  ].map((txt, i) => (
                    <p key={i} className="flex items-start gap-2 text-[11px] leading-5 text-amber-200/60">
                      <span className="mt-2 block h-1 w-1 shrink-0 rounded-full bg-amber-400/40" />{txt}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Methodology Pros/Cons ── */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/[0.02] p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">AI-Powered Analysis</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-tighter">Pros</p>
                <p className="text-xs text-muted-foreground leading-5">Deep UX understanding, visual hierarchy analysis, conversion copywriting suggestions, and creative fix prompts.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-tighter">Cons</p>
                <p className="text-xs text-muted-foreground leading-5">Subject to API quota limits, slower inference, and rare &quot;hallucinations&quot; (seeing things that aren&apos;t there).</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.02] p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-bold text-violet-300 uppercase tracking-wider">Tool-Based Analysis</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-tighter">Pros</p>
                <p className="text-xs text-muted-foreground leading-5">100% reliable, objective metrics (Lighthouse), precise security scanning, and no quota limits.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-red-400 uppercase tracking-tighter">Cons</p>
                <p className="text-xs text-muted-foreground leading-5">Cannot judge &quot;vibe&quot; or design quality, lacks context on user intent, and limited to predefined rules.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Lighthouse Metrics (if available) ── */}
        {result.lighthouse && (
          <section className="mt-14">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2.5">
                <Gauge className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Core Web Vitals</h2>
                <p className="text-sm text-muted-foreground">Deterministic scores from Google Lighthouse</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Performance", score: result.lighthouse.performance },
                { label: "Accessibility", score: result.lighthouse.accessibility },
                { label: "Best Practices", score: result.lighthouse.bestPractices },
                { label: "SEO", score: result.lighthouse.seo },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm">
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full" style={{
                    background: `conic-gradient(${
                      metric.score >= 90 ? '#10b981' : metric.score >= 50 ? '#f59e0b' : '#ef4444'
                    } ${metric.score}%, transparent ${metric.score}%)`
                  }}>
                    <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
                      <span className={`text-lg font-bold ${
                        metric.score >= 90 ? 'text-emerald-400' : metric.score >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {metric.score}
                      </span>
                    </div>
                  </div>
                  <span className="mt-3 text-sm font-medium text-foreground">{metric.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Backend Static Metrics (if available) ── */}
        {result.backendMetrics && (
          <section className="mt-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/10 p-2.5">
                <Cpu className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">Backend Health</h2>
                <p className="text-sm text-muted-foreground">Deterministic scores from Static Code Analyzer</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Security", score: result.backendMetrics.security },
                { label: "Code Quality", score: result.backendMetrics.codeQuality },
                { label: "Maintainability", score: result.backendMetrics.maintainability },
              ].map((metric) => (
                <div key={metric.label} className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm">
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full" style={{
                    background: `conic-gradient(${
                      metric.score >= 90 ? '#10b981' : metric.score >= 50 ? '#f59e0b' : '#ef4444'
                    } ${metric.score}%, transparent ${metric.score}%)`
                  }}>
                    <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
                      <span className={`text-lg font-bold ${
                        metric.score >= 90 ? 'text-emerald-400' : metric.score >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {metric.score}
                      </span>
                    </div>
                  </div>
                  <span className="mt-3 text-sm font-medium text-foreground">{metric.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Issues List ── */}
        <section className="mt-20">
          {sortedIssues.length > 0 ? (
            (() => {
              const feIssues = sortedIssues.filter(i => FRONTEND_CATEGORIES.has(i.category));
              const beIssues = sortedIssues.filter(i => !FRONTEND_CATEGORIES.has(i.category));

              const renderIssueCard = (issue: typeof sortedIssues[0], globalIdx: number) => {
                const sev = severityConfig[issue.severity];
                const isExpanded = expandedIssue === globalIdx;
                return (
                  <div key={`${issue.title}-${globalIdx}`} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-xl transition-all duration-300 hover:border-border/80 hover:shadow-xl hover:shadow-black/[0.08]">
                    <div className={`absolute left-0 top-0 h-full w-1 ${sev.dot}`} />
                    <div className="p-5 pl-6">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-xl ${sev.bg} p-2`}><CategoryIcon category={issue.category} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold leading-snug">{issue.title}</h3>
                            <span className={`shrink-0 rounded-md ${sev.bg} px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${sev.text}`}>{sev.label}</span>
                          </div>
                          {issue.category && <span className="mt-1 inline-block rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{categoryLabel(issue.category)}</span>}
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{issue.description}</p>
                      {(issue.evidence || issue.confidence) && (
                        <button onClick={() => setExpandedIssue(isExpanded ? null : globalIdx)} className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded ? "Hide details" : "Show evidence"}
                        </button>
                      )}
                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 rounded-xl border border-border/30 bg-muted/20 p-3.5 text-[11px] leading-5 text-muted-foreground">
                          {issue.evidence && <p><strong className="text-foreground/70">Evidence:</strong> {issue.evidence}</p>}
                          {issue.confidence && <p><strong className="text-foreground/70">Confidence:</strong> <span className={issue.confidence === "high" ? "text-emerald-400" : issue.confidence === "medium" ? "text-amber-400" : "text-blue-400"}>{issue.confidence}</span></p>}
                        </div>
                      )}
                      <button onClick={() => copyText(issue.fixPrompt, "Fix prompt")} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/20 py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400">
                        <Copy className="h-3.5 w-3.5" /> Copy Fix Prompt
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-16">
                  {/* Frontend Issues */}
                  <div>
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-cyan-500/10 p-2.5">
                          <LayoutPanelLeft className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold tracking-tight">Frontend Audit</h2>
                          <p className="text-sm text-muted-foreground">UX, UI, and Conversion issues found</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground">{feIssues.length} issues</span>
                    </div>
                    {feIssues.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {feIssues.map((issue, idx) => renderIssueCard(issue, idx))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-emerald-500/10 bg-emerald-500/[0.03] p-10 text-center backdrop-blur-sm">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/40" />
                        <p className="mt-4 text-sm font-medium text-emerald-400/80">No frontend issues found. Your UX is solid!</p>
                      </div>
                    )}
                  </div>

                  {/* Backend Issues */}
                  {(beIssues.length > 0 || result.backendMetrics) && (
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-violet-500/10 p-2.5">
                            <Server className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold tracking-tight">Backend Audit</h2>
                            <p className="text-sm text-muted-foreground">Security, Quality, and Architecture findings</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-muted/40 px-3 py-1 text-xs font-bold text-muted-foreground">{beIssues.length} issues</span>
                      </div>
                      {beIssues.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {beIssues.map((issue, idx) => renderIssueCard(issue, feIssues.length + idx))}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-emerald-500/10 bg-emerald-500/[0.03] p-10 text-center backdrop-blur-sm">
                          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/40" />
                          <p className="mt-4 text-sm font-medium text-emerald-400/80">No critical backend code issues found.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="rounded-3xl border border-amber-500/10 bg-amber-500/[0.03] p-10 text-center backdrop-blur-sm">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-400/40" />
              <p className="mt-4 text-sm font-medium text-amber-400/80">No issues found in this audit.</p>
            </div>
          )}
        </section>

        {/* ── Improvement Prompt ── */}
        {result.improvementPrompt && (
          <section className="mt-14">
            <div className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5"><Lightbulb className="h-5 w-5 text-emerald-400" /></div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-emerald-300">Ready-to-Paste Improvement Prompt</h3>
                    <p className="mt-1 text-xs text-emerald-300/50">Copy this prompt and paste it into MeDo to apply all suggested fixes at once.</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-emerald-500/10 bg-black/20 p-5">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-7 text-emerald-100/70">{escapeHtml(result.improvementPrompt || "")}</pre>
                </div>
                <Button onClick={() => copyText(result.improvementPrompt!, "Improvement prompt")} className="mt-5 rounded-xl bg-emerald-600 px-8 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 hover:shadow-emerald-500/30">
                  <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Full Prompt
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ── AI Thinking Process ── */}
        {result.thoughtProcess && result.thoughtProcess.length > 0 && (
          <section className="mt-14">
            <button onClick={() => setThinkingOpen(!thinkingOpen)} className="flex w-full items-center justify-between rounded-2xl border border-border/50 bg-background/60 p-5 text-left backdrop-blur-xl transition-all hover:border-border/80 hover:shadow-lg hover:shadow-black/5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-500/10 p-2"><Sparkles className="h-4 w-4 text-violet-400" /></div>
                <span className="text-sm font-bold">AI Reasoning Process</span>
                <span className="rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{result.thoughtProcess.length} steps</span>
              </div>
              {thinkingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {thinkingOpen && (
              <div className="mt-4 space-y-0 rounded-2xl border border-border/40 bg-background/40 p-5 backdrop-blur-sm">
                {result.thoughtProcess.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-[10px] font-bold text-violet-300">{idx + 1}</div>
                      {idx < (result.thoughtProcess?.length ?? 0) - 1 && <div className="mt-1 h-full w-px bg-gradient-to-b from-border/50 to-transparent" />}
                    </div>
                    <p className="pb-5 text-xs leading-6 text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 flex flex-col items-center gap-6 border-t border-border/30 pt-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Powered by <strong className="text-foreground">Medo Copilot</strong> — AI Launch Auditor
          </div>
          <Button onClick={() => { localStorage.removeItem("medo_audit_result"); router.push("/"); }} variant="outline" size="lg" className="rounded-2xl px-8">
            <RotateCcw className="mr-2 h-4 w-4" /> Run Another Audit
          </Button>
        </footer>
      </div>
    </main>
  );
}
