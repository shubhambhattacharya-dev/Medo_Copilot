"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { UserButton, useUser } from "@clerk/nextjs";
import { BarChart3, CheckCircle2, Sparkles, Copy, BadgeCheck, Settings, ShieldCheck } from "lucide-react";
import { AuditForm } from "@/components/audit-form";
import { checks, previewFixes, steps, loadingSteps } from "@/lib/constants";
import { normalizeAuditUrl } from "@/lib/audit-helpers";
import type { ApiResponse, AuditResponse } from "@/types/audit";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [visionProvider, setVisionProvider] = useState("default");
  const [visionKey, setVisionKey] = useState("");
  const [codeProvider, setCodeProvider] = useState("default");
  const [codeKey, setCodeKey] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [force, setForce] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { isSignedIn } = useUser();

  // Fetch user settings on mount
  useEffect(() => {
    fetch("/api/user/settings")
      .then(res => res.ok ? res.json() : { error: "Failed to fetch settings" })
      .then(data => {
        if (!data.error) {
          if (data.visionProvider) setVisionProvider(data.visionProvider);
          if (data.codeProvider) setCodeProvider(data.codeProvider);
          setKeysSaved(data.hasVisionKey || data.hasCodeKey);
        }
      })
      .catch(console.error);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionProvider,
          visionKey,
          codeProvider,
          codeKey
        })
      });
      if (res.ok) {
        toast.success("API keys saved securely!");
        setKeysSaved(true);
        setVisionKey("");
        setCodeKey("");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Error saving settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedUrl = normalizeAuditUrl(url);

    if (!submittedUrl) {
      toast.error("Enter a public app URL first.");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setUrl(submittedUrl);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 4000);

    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append("url", submittedUrl);
      if (githubUrl.trim()) {
        formData.append("githubUrl", githubUrl.trim());
      }
      formData.append("visionProvider", visionProvider);
      formData.append("codeProvider", codeProvider);
      
      if (visionKey.trim()) formData.append("visionKey", visionKey.trim());
      if (codeKey.trim()) formData.append("codeKey", codeKey.trim());
      if (force) formData.append("force", "true");

      for (let i = 0; i < screenshots.length; i++) {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(screenshots[i]);
        });
        formData.append(`screenshot_${i}`, base64Data.split(",")[1]);
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        signal: abortRef.current?.signal,
      });

      const data: ApiResponse<AuditResponse> = await res.json().catch(() => null);
      
      if (!res.ok || !data || !data.success) {
        throw new Error(data?.error || "Audit request failed.");
      }

      const auditResult = data.data;
      if (!auditResult) {
        throw new Error("No audit data received from server.");
      }

      // If AI failed but we have fallback data, warn the user
      if (auditResult.warning && (auditResult.lighthouse || auditResult.backendMetrics)) {
        toast.warning("AI Quota exceeded. Using automated tools for report.", {
          duration: 6000,
          description: "Deterministic analysis is active, but visual AI audit was skipped.",
        });
      }

      localStorage.setItem(
        "medo_audit_result",
        JSON.stringify({ ...auditResult, auditedUrl: submittedUrl })
      );
      router.push("/audit");
    } catch (error: unknown) {
      console.error("Error analyzing app:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unable to reach the audit API.";
      toast.error(errorMessage);

      localStorage.setItem(
        "medo_audit_result",
        JSON.stringify({
          launchScore: 0,
          issues: [],
          error: errorMessage,
          auditedUrl: submittedUrl,
        })
      );
      router.push("/audit");
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
                Professional Launch-Ready Audit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs text-muted-foreground md:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Professional Grade Audit Pipeline
            </div>
            
            {isSignedIn ? (
              <>
                <button
                  onClick={() => router.push("/settings")}
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </button>
                <UserButton />
              </>
            ) : null}
            
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:py-16">
          <div className="relative max-w-2xl">
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

            <AuditForm
              url={url}
              setUrl={setUrl}
              githubUrl={githubUrl}
              setGithubUrl={setGithubUrl}
              screenshots={screenshots}
              setScreenshots={setScreenshots}
              loading={loading}
              loadingStep={loadingStep}
              isSignedIn={isSignedIn || false}
              onSubmit={handleSubmit}
              visionProvider={visionProvider}
              setVisionProvider={setVisionProvider}
              visionKey={visionKey}
              setVisionKey={setVisionKey}
              codeProvider={codeProvider}
              setCodeProvider={setCodeProvider}
              codeKey={codeKey}
              setCodeKey={setCodeKey}
              keysSaved={keysSaved}
              isSaving={isSaving}
              onSaveSettings={handleSaveSettings}
              force={force}
              setForce={setForce}
            />
          </div>

          <div className="relative">
            <Card className="border-border/70 bg-background/80 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.55)] backdrop-blur">
              <CardHeader className="space-y-2 border-b border-border/60 pb-5">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  What you&apos;ll get
                </CardTitle>
                <CardDescription>
                  A full audit report with scores, issues, and ready-to-paste fix
                  prompts.
                </CardDescription>
              </CardHeader>
              <div className="space-y-5 p-5">
                <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Launch score</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      AI-Powered
                    </span>
                  </div>
                  <div className="mt-5 flex items-end gap-2">
                    <p className="text-5xl font-semibold tracking-tight">82</p>
                    <p className="pb-1 text-sm text-muted-foreground">/ 100</p>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-500"
                      style={{ width: "82%" }}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-background p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Example suggestions
                  </div>
                  {previewFixes.map((fix) => (
                    <div
                      key={fix}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
                    >
                      <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm leading-6 text-foreground">{fix}</p>
                    </div>
                  ))}
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
              </div>
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
