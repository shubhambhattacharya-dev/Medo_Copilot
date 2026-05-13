"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  ChevronDown, 
  LayoutPanelLeft, 
  Key, 
  ShieldCheck, 
  Loader2, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { AI_PROVIDERS, loadingSteps } from "@/lib/constants";

interface AuditFormProps {
  url: string;
  setUrl: (url: string) => void;
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  screenshots: File[];
  setScreenshots: (files: File[]) => void;
  loading: boolean;
  loadingStep: number;
  isSignedIn: boolean;
  onSubmit: (e: React.FormEvent) => void;
  
  // Settings props
  visionProvider: string;
  setVisionProvider: (v: string) => void;
  visionKey: string;
  setVisionKey: (k: string) => void;
  codeProvider: string;
  setCodeProvider: (v: string) => void;
  codeKey: string;
  setCodeKey: (k: string) => void;
  keysSaved: boolean;
  isSaving: boolean;
  onSaveSettings: () => void;
  force: boolean;
  setForce: (f: boolean) => void;
}

export function AuditForm({
  url,
  setUrl,
  githubUrl,
  setGithubUrl,
  screenshots,
  setScreenshots,
  loading,
  loadingStep,
  isSignedIn,
  onSubmit,
  visionProvider,
  setVisionProvider,
  visionKey,
  setVisionKey,
  codeProvider,
  setCodeProvider,
  codeKey,
  setCodeKey,
  keysSaved,
  isSaving,
  onSaveSettings,
  force,
  setForce
}: AuditFormProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mt-8 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <LayoutPanelLeft className="h-4 w-4 text-cyan-500" />
        Audit your MeDo URL
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            inputMode="url"
            placeholder="https://your-app.medo.dev"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="h-12 flex-1 rounded-2xl bg-background/80 px-4 text-base"
          />
          <label className="flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-border/70 bg-background/80 px-4 text-sm hover:bg-muted whitespace-nowrap">
            {screenshots.length > 0
              ? `${screenshots.length} screenshots`
              : "Upload screenshots (Optional)"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) =>
                setScreenshots(Array.from(e.target.files || []).slice(0, 7))
              }
            />
          </label>
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">
          Tip: 1-3 screenshots of different pages work best. If omitted, we'll try to capture them automatically.
        </p>
        <Input
          type="text"
          placeholder="GitHub Repository URL (Optional)"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          disabled={loading}
          className="h-12 w-full rounded-2xl bg-background/80 px-4 text-base"
        />

        {/* Advanced Settings (BYOK) */}
        <div className="w-full">
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="inline-flex w-full items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Settings (Bring Your Own Key)
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
          
          {settingsOpen && (
            <div className="mt-2 space-y-5 rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur">
               <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-500">
                 <strong>Tip:</strong> Go to Settings page to save API keys securely for future use.
               </div>

               {/* Cache Bypass */}
               <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                 <input
                   type="checkbox"
                   id="force-audit"
                   checked={force}
                   onChange={(e) => setForce(e.target.checked)}
                   className="h-4 w-4 rounded border-border/50 bg-background text-cyan-500 focus:ring-cyan-500/50"
                 />
                 <label htmlFor="force-audit" className="flex flex-col gap-0.5 cursor-pointer">
                   <span className="text-sm font-semibold text-foreground">Force fresh audit</span>
                   <span className="text-[10px] text-muted-foreground">Bypass cached results and scan the live site immediately</span>
                 </label>
               </div>

               <hr className="border-border/50" />

               {/* Vision Provider */}
               <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <LayoutPanelLeft className="h-4 w-4 text-cyan-500" />
                  Frontend Vision Model
                </h4>
                <div className="space-y-1.5 pl-5 border-l-2 border-border/50">
                  <select
                    value={visionProvider}
                    onChange={(e) => setVisionProvider(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    {AI_PROVIDERS.find(p => p.value === visionProvider)?.hint}
                  </p>

                  {visionProvider !== "default" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 pt-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                        <Key className="h-3 w-3" />
                        Vision API Key
                      </label>
                      <Input
                        type="password"
                        placeholder={keysSaved && !visionKey ? "Key saved in database (leave blank to keep)" : "Enter API key"}
                        value={visionKey}
                        onChange={(e) => setVisionKey(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Code Provider */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Settings className="h-4 w-4 text-emerald-500" />
                  Backend Code Model
                </h4>
                <div className="space-y-1.5 pl-5 border-l-2 border-border/50">
                  <select
                    value={codeProvider}
                    onChange={(e) => setCodeProvider(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    {AI_PROVIDERS.find(p => p.value === codeProvider)?.hint}
                  </p>

                  {codeProvider !== "default" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 pt-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                        <Key className="h-3 w-3" />
                        Code API Key
                      </label>
                      <Input
                        type="password"
                        placeholder={keysSaved && !codeKey ? "Key saved in database (leave blank to keep)" : "Enter API key"}
                        value={codeKey}
                        onChange={(e) => setCodeKey(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              {(visionKey || codeKey || visionProvider !== "default" || codeProvider !== "default") && (
                <div className="pt-2">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                    onClick={onSaveSettings}
                    disabled={isSaving || (!visionKey && !codeKey && !keysSaved)}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" />}
                    {keysSaved && !visionKey && !codeKey ? "Settings Saved Securely" : "Save Settings to Profile"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row items-center">
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-12 w-full rounded-2xl px-8 text-sm font-semibold shadow-lg shadow-cyan-500/15 sm:w-auto bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white border-0"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze app
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          
          {!isSignedIn && !loading && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold bg-muted/50 px-2 py-1 rounded-md border border-border/50">
              Guest Mode
            </span>
          )}
        </div>
      </form>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-5 space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">
              {loadingSteps[loadingStep]}
            </span>
          </div>
          <div className="flex gap-1">
            {loadingSteps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  idx <= loadingStep ? "bg-cyan-400" : "bg-muted/40"
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-cyan-300/50">
            This may take 15-30 seconds depending on the website size.
          </p>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Try a sample:</span>
          {["medo.dev", "resumeana.com", "acme.medo.dev"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setUrl(item)}
              className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
