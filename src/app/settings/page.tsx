"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Settings2,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  FileCode,
  Shield,
} from "lucide-react";

const MODEL_OPTIONS = [
  { value: "default", label: "Default (Best)", description: "Uses server keys with automatic fallback" },
  { value: "gemini", label: "Google Gemini", description: "Best for visual/screenshot analysis" },
  { value: "groq", label: "Groq (Llama)", description: "Fastest response time" },
  { value: "openrouter", label: "OpenRouter (Claude)", description: "Requires your own API key" },
];

interface UserSettings {
  visionProvider: string;
  hasVisionKey: boolean;
  codeProvider: string;
  hasCodeKey: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  
  const [visionProvider, setVisionProvider] = useState("default");
  const [visionKey, setVisionKey] = useState("");
  const [codeProvider, setCodeProvider] = useState("default");
  const [codeKey, setCodeKey] = useState("");
  
  const [showVisionKey, setShowVisionKey] = useState(false);
  const [showCodeKey, setShowCodeKey] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch current settings on mount
  useEffect(() => {
    if (!userLoaded || !user) {
      setLoading(false);
      return;
    }
    
    async function fetchSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data: UserSettings = await res.json();
          setVisionProvider(data.visionProvider || "default");
          setCodeProvider(data.codeProvider || "default");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    
    fetchSettings();
  }, [userLoaded, user?.id]);

  const handleSave = async () => {
    if (!user) {
      toast.error("Please sign in to save settings");
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visionProvider,
          visionKey: visionKey || undefined,
          codeProvider,
          codeKey: codeKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setVisionKey("");
      setCodeKey("");
      toast.success("Settings saved successfully!");
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (!userLoaded || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Not signed in state
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
            <h2 className="text-lg font-semibold text-amber-300">Sign In Required</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please sign in to manage your API settings and save custom keys.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10">
              <Settings2 className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">API Settings</h1>
              <p className="text-sm text-muted-foreground">
                Add your own API keys for better analysis
              </p>
            </div>
          </div>
          <UserButton />
        </div>

        {/* User Info Card */}
        <div className="rounded-xl border border-border/60 bg-background/60 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white font-semibold">
              {user.firstName?.[0] || user.username?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user.fullName || user.username || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Shield className="h-3.5 w-3.5" />
              Authenticated
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Vision API Keys */}
          <div className="rounded-2xl border border-border/60 bg-background/60 p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-border/40">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span className="font-medium">Vision & Analysis</span>
              <span className="text-xs text-muted-foreground ml-auto">
                For page screenshots & visual analysis
              </span>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Vision AI Provider
                </label>
                <select
                  value={visionProvider}
                  onChange={(e) => setVisionProvider(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  API Key (Optional)
                </label>
                <div className="relative">
                  <Input
                    type={showVisionKey ? "text" : "password"}
                    placeholder={visionProvider === "default" ? "Uses system keys if empty" : "Enter your API key..."}
                    value={visionKey}
                    onChange={(e) => setVisionKey(e.target.value)}
                    disabled={visionProvider === "default"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowVisionKey(!showVisionKey)}
                    disabled={visionProvider === "default"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground disabled:opacity-50"
                  >
                    {showVisionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {visionProvider !== "default" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Get key from provider&apos;s dashboard. Leave empty to use system keys.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Code API Keys */}
          <div className="rounded-2xl border border-border/60 bg-background/60 p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-border/40">
              <FileCode className="h-4 w-4 text-purple-400" />
              <span className="font-medium">Code & Backend</span>
              <span className="text-xs text-muted-foreground ml-auto">
                For GitHub code analysis
              </span>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Code AI Provider
                </label>
                <select
                  value={codeProvider}
                  onChange={(e) => setCodeProvider(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  API Key (Optional)
                </label>
                <div className="relative">
                  <Input
                    type={showCodeKey ? "text" : "password"}
                    placeholder={codeProvider === "default" ? "Uses system keys if empty" : "Enter your API key..."}
                    value={codeKey}
                    onChange={(e) => setCodeKey(e.target.value)}
                    disabled={codeProvider === "default"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCodeKey(!showCodeKey)}
                    disabled={codeProvider === "default"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground disabled:opacity-50"
                  >
                    {showCodeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {codeProvider !== "default" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Get key from provider&apos;s dashboard. Leave empty to use system keys.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full h-12"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Saved!</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Save Settings</>
            )}
          </Button>

          {/* Success Message */}
          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Your API settings are saved! They will be Used for analysis.
            </div>
          )}

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Privacy & Security</span>
              <p className="text-xs mt-1 opacity-80">
                Your API keys are encrypted (AES-256-GCM) and stored securely. 
                They are only used when you run audits and are never shared. 
                If you don&apos;t add your own keys, the system uses free fallback models with limited features.
              </p>
            </div>
          </div>

          {/* Feature Info */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground mb-2">About API Modes</h4>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Default (Recommended):</strong> Uses server keys with automatic fallback</li>
              <li>• <strong>Gemini:</strong> Best for analyzing screenshots visually</li>
              <li>• <strong>Groq:</strong> Free, fast, good for text analysis</li>
              <li>• <strong>OpenRouter:</strong> Access to Claude, requires your own key</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}