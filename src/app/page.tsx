"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Copy,
  Gauge,
  LayoutPanelLeft,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

const checks = [
  {
    title: "Trust signals",
    description: "Find missing proof, unclear pricing cues, and weak social trust.",
    icon: ShieldCheck,
  },
  {
    title: "Mobile clarity",
    description: "Spot cramped layouts, tiny tap targets, and broken hierarchy.",
    icon: Smartphone,
  },
  {
    title: "Conversion friction",
    description: "Catch distracting copy, unclear CTA flow, and noisy sections.",
    icon: Gauge,
  },
];

const fixes = [
  "Add a stronger hero promise above the fold.",
  "Move the primary CTA higher and reduce competing actions.",
  "Show one concrete outcome instead of generic marketing copy.",
];

const steps = [
  {
    step: "01",
    title: "Paste your MeDo URL",
    description: "Drop in the page you want audited. No setup, no config.",
  },
  {
    step: "02",
    title: "Scan the UX",
    description: "Medo Copilot checks the page for clarity, trust, and mobile issues.",
  },
  {
    step: "03",
    title: "Copy the fixes",
    description: "Use short prompts and specific edits you can apply immediately.",
  },
];

type AuditIssue = {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  fixPrompt: string;
};

type AuditResult = {
  launchScore: number;
  issues: AuditIssue[];
  error?: string;
  analysisMode?: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      
      const data = await res.json();
      console.log("Analysis Result:", data);
      setResult(data);
      
      // Scroll to result card
      setTimeout(() => {
        document.getElementById("audit-card")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (error) {
      console.error("Error analyzing app:", error);
      setResult({
        launchScore: 0,
        issues: [],
        error: "Unable to reach the audit API.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-40 top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-[24rem] w-[24rem] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur md:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg shadow-foreground/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">
                Medo Copilot
              </p>
              <p className="text-xs text-muted-foreground">
                Launch-ready audit for MeDo apps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:flex">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
              Trusted by builders shipping faster
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:py-16">
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Built for the MeDo hackathon
            </div>

            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-7xl">
              Is your MeDo app ready to{" "}
              <span className="bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-500 bg-clip-text text-transparent">
                launch
              </span>
              ?
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Paste your MeDo URL and get a focused audit that spots weak trust
              signals, confusing UX, and mobile friction. You will get concrete
              fixes you can apply right away.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur">
                <p className="text-2xl font-semibold tracking-tight">30 sec</p>
                <p className="mt-1 text-sm text-muted-foreground">Fast audit pass</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur">
                <p className="text-2xl font-semibold tracking-tight">12+</p>
                <p className="mt-1 text-sm text-muted-foreground">Signals checked</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur">
                <p className="text-2xl font-semibold tracking-tight">Mobile</p>
                <p className="mt-1 text-sm text-muted-foreground">First by default</p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LayoutPanelLeft className="h-4 w-4 text-cyan-500" />
                Audit your MeDo URL
              </div>
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://your-app.medo.dev"
                  aria-label="MeDo app URL"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-12 flex-1 rounded-2xl bg-background/80 px-4 text-base"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="h-12 rounded-2xl px-6 text-sm font-semibold shadow-lg shadow-cyan-500/15"
                >
                  {loading ? "Analyzing..." : "Analyze app"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Try a sample:</span>
                {["medo.dev", "resumeana.com", "acme.medo.dev"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setUrl(item);
                      setResult(null);
                    }}
                    className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative" id="audit-card">
            <Card className="border-border/70 bg-background/80 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.55)] backdrop-blur">
              <CardHeader className="space-y-2 border-b border-border/60 pb-5">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  {result?.error ? "Audit failed" : "Live audit preview"}
                </CardTitle>
                <CardDescription>
                  {result?.error
                    ? result.error
                    : "A compact readout of what Medo Copilot will flag on a typical landing page."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Launch score
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {result?.analysisMode === "fallback" ? "Fallback" : "Live"}
                      </span>
                    </div>
                    <div className="mt-5 flex items-end gap-2">
                      <p className="text-5xl font-semibold tracking-tight">
                        {result?.launchScore ?? 82}
                      </p>
                      <p className="pb-1 text-sm text-muted-foreground">/ 100</p>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-500"
                        style={{ width: `${result?.launchScore ?? 82}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {result
                        ? "Your audit result is ready."
                        : "Strong base, but the hero and CTA need sharper proof."}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TriangleAlert className="h-4 w-4 text-amber-500" />
                      Top issues
                    </div>
                    {result?.issues?.length
                      ? result.issues.map((issue) => (
                          <div
                            key={issue.title}
                            className="group relative flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/40 p-4 transition-all hover:bg-muted/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {issue.title}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  issue.severity === "high" ? "bg-red-500/10 text-red-500" :
                                  issue.severity === "medium" ? "bg-amber-500/10 text-amber-500" :
                                  "bg-blue-500/10 text-blue-500"
                                }`}>
                                  {issue.severity}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(issue.fixPrompt);
                                  toast.success("Prompt copied to clipboard!");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground opacity-0 shadow-sm transition-all hover:text-cyan-500 group-hover:opacity-100"
                              >
                                <Copy className="h-3 w-3" />
                                Copy Fix
                              </button>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {issue.description}
                            </p>
                          </div>
                        ))
                      : fixes.map((fix) => (
                          <div
                            key={fix}
                            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
                          >
                            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <p className="text-sm leading-6 text-foreground">{fix}</p>
                          </div>
                        ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {checks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-border/70 bg-muted/25 p-4"
                      >
                        <Icon className="h-5 w-5 text-cyan-500" />
                        <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 pb-10 md:grid-cols-3">
          {steps.map((item) => (
            <Card
              key={item.step}
              className="border-border/70 bg-background/75 backdrop-blur"
            >
              <CardHeader className="space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background">
                  {item.step}
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  {item.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
