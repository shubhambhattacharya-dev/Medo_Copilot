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
} from "lucide-react";

const FRONTEND_CATS = new Set(["copy","trust","cta","mobile","empty-state","error-state","accessibility","performance"]);

// ─── Types ────────────────────────────────────────────
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
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 rounded-2xl border border-border/30 bg-muted/10" />)}
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
  const [result, setResult] = useState<AuditResult | null>(null);
  const [status, setStatus] = useState<"loading"|"empty"|"error"|"ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("medo_audit_result");
      if (!raw) { setStatus("empty"); return; }
      const parsed: AuditResult = JSON.parse(raw);
      if (parsed.error && !parsed.issues?.length) { setErrorMsg(parsed.error); setStatus("error"); return; }
      setResult(parsed); setStatus("ready");
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

        {/* ── WIP Banner ── */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-5 py-3.5 backdrop-blur-sm">
          <Construction className="h-4 w-4 shrink-0 text-cyan-400" />
          <p className="text-xs leading-5 text-cyan-300/80"><span className="font-semibold text-cyan-300">Work in Progress</span> — Actively improving accuracy, checks, and suggestions. Your feedback matters.</p>
        </div>

        {/* ── Score Hero ── */}
        <section className="mt-12 flex flex-col items-center gap-8">
          <ScoreGauge score={result.launchScore} size={220} strokeWidth={14} />

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
              <Clock className="h-3 w-3" /> {new Date().toLocaleDateString()}
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
          {sortedIssues.length === 0 && <p className="text-sm text-emerald-400 font-medium">✨ No issues found — your app looks great!</p>}
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

        {/* ── Issue Card Component ── */}
        {(() => {
          const feIssues = sortedIssues.filter(i => FRONTEND_CATS.has(i.category || ""));
          const beIssues = sortedIssues.filter(i => !FRONTEND_CATS.has(i.category || ""));

          const renderIssueCard = (issue: typeof sortedIssues[0], idx: number, globalIdx: number) => {
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
            <>
              {/* ── Frontend Audit Section ── */}
              {feIssues.length > 0 && (
                <section className="mt-14">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10 p-2.5"><LayoutPanelLeft className="h-5 w-5 text-cyan-400" /></div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">Frontend Audit</h2>
                      <p className="text-xs text-muted-foreground">UX, copy, trust signals, CTA, mobile, accessibility</p>
                    </div>
                    <span className="ml-auto rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">{feIssues.length} issues</span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {feIssues.map((issue, idx) => renderIssueCard(issue, idx, idx))}
                  </div>
                </section>
              )}

              {/* ── Backend Audit Section ── */}
              {beIssues.length > 0 && (
                <section className="mt-14">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-orange-500/15 to-red-500/10 p-2.5"><Server className="h-5 w-5 text-orange-400" /></div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">Backend Audit</h2>
                      <p className="text-xs text-muted-foreground">Security, architecture, database, error handling, code quality</p>
                    </div>
                    <span className="ml-auto rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">{beIssues.length} issues</span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {beIssues.map((issue, idx) => renderIssueCard(issue, idx, feIssues.length + idx))}
                  </div>
                </section>
              )}

              {/* ── No issues ── */}
              {feIssues.length === 0 && beIssues.length === 0 && (
                <section className="mt-14 flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <h3 className="text-lg font-bold text-emerald-300">All Clear!</h3>
                  <p className="text-sm text-muted-foreground">No significant issues found. Your app looks launch-ready.</p>
                </section>
              )}
            </>
          );
        })()}

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
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-7 text-emerald-100/70">{result.improvementPrompt}</pre>
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
                      {idx < result.thoughtProcess!.length - 1 && <div className="mt-1 h-full w-px bg-gradient-to-b from-border/50 to-transparent" />}
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
