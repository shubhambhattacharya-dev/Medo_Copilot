"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const MODEL_OPTIONS = [
  { value: "auto", label: "Auto (Best)", description: "Use 2 models for best analysis" },
  { value: "gemini", label: "Google Gemini", description: "Best for visual analysis" },
  { value: "groq", label: "Groq (Llama)", description: "Fastest response" },
  { value: "openai", label: "OpenAI GPT", description: "Best reasoning" },
  { value: "anthropic", label: "Anthropic Claude", description: "Best for code" },
];

export default function SettingsPage() {
  const [googleKey, setGoogleKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [modelPref, setModelPref] = useState("auto");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleShow = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleKey: googleKey || undefined,
          groqKey: groqKey || undefined,
          openaiKey: openaiKey || undefined,
          anthropicKey: anthropicKey || undefined,
          modelPreference: modelPref,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      toast.success("API keys saved successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/10">
            <Settings className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">API Settings</h1>
            <p className="text-sm text-muted-foreground">
              Add your own API keys for better analysis
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/60 p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-border/40">
            <Key className="h-4 w-4 text-cyan-400" />
            <span className="font-medium">Your API Keys</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Stored securely in your browser
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">
                Google Gemini API Key
              </label>
              <div className="relative">
                <Input
                  type={showKeys.google ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("google")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKeys.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Groq API Key</label>
              <div className="relative">
                <Input
                  type={showKeys.groq ? "text" : "password"}
                  placeholder="gsk_..."
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("groq")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKeys.groq ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get key from{" "}
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Groq Console
                </a>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <Input
                  type={showKeys.openai ? "text" : "password"}
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("openai")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  OpenAI Platform
                </a>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Anthropic API Key
              </label>
              <div className="relative">
                <Input
                  type={showKeys.anthropic ? "text" : "password"}
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleShow("anthropic")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Get key from{" "}
                <a
                  href="https://console.anthropic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  Anthropic Console
                </a>
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40">
            <label className="text-sm font-medium block mb-3">
              Model Preference
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModelPref(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modelPref === opt.value
                      ? "border-cyan-500/50 bg-cyan-500/10"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {modelPref === opt.value && (
                      <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                    )}
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? (
                <>Saving...</>
              ) : saved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Saved!
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Save Settings
                </>
              )}
            </Button>
          </div>

          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Your API keys are saved! They will be used for analysis.
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Privacy Note</span>
              <p className="text-xs mt-1 opacity-80">
                Your API keys are stored securely and only used when you run
                audits. We never share your keys. If you don&apos;t add your own
                keys, the system uses free fallback models.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}