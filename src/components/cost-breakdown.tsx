"use client";

import { Coins, Clock, Zap, Shield, Info } from "lucide-react";

interface CostBreakdownProps {
  provider?: string;
  latencyMs?: number;
  analysisMode?: string;
  issuesFound?: number;
  hasScreenshots?: boolean;
  hasGithubCode?: boolean;
}

const PROVIDER_COST_ESTIMATES: Record<string, { input: number; output: number; note: string }> = {
  gemini: { input: 0.075, output: 0.30, note: "Gemini 2.5 Flash" },
  groq: { input: 0, output: 0, note: "Free tier" },
  openrouter: { input: 3.0, output: 15.0, note: "Claude 3.5 Sonnet" },
  tencent: { input: 0.15, output: 0.15, note: "Hunyuan" },
  poolside: { input: 0.50, output: 0.50, note: "Poolside Laguna" },
  nvidia: { input: 0.10, output: 0.10, note: "Nemotron" },
  mimo: { input: 0.20, output: 0.20, note: "Mimo" },
};

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function CostBreakdown({
  provider = "gemini",
  latencyMs = 0,
  analysisMode = "ai-split",
  issuesFound = 0,
  hasScreenshots = false,
}: CostBreakdownProps) {
  const pricing = PROVIDER_COST_ESTIMATES[provider] || PROVIDER_COST_ESTIMATES.gemini;
  
  // Estimate tokens based on analysis type
  const estimatedInputTokens = hasScreenshots ? 4000 : 2000; // Screenshots add tokens
  const estimatedOutputTokens = issuesFound > 0 ? 1500 + issuesFound * 200 : 1000;
  
  const estimatedCost = 
    (estimatedInputTokens / 1_000_000) * pricing.input +
    (estimatedOutputTokens / 1_000_000) * pricing.output;

  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-bold">Cost & Performance</h3>
      </div>
      
      <div className="space-y-3">
        {/* Provider & Model */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-sm">Provider</span>
          </div>
          <span className="text-sm font-medium capitalize">{provider}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">Model Tier</span>
          </div>
          <span className="text-sm text-muted-foreground">{pricing.note}</span>
        </div>
        
        {/* Latency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-sm">Latency</span>
          </div>
          <span className="text-sm font-medium text-blue-400">
            {latencyMs > 0 ? formatLatency(latencyMs) : "N/A"}
          </span>
        </div>
        
        {/* Estimated Tokens */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-sm">Est. Tokens</span>
          </div>
          <span className="text-sm font-medium">
            ~{((estimatedInputTokens + estimatedOutputTokens) / 1000).toFixed(1)}K
          </span>
        </div>
        
        {/* Divider */}
        <div className="border-t border-border/30" />
        
        {/* Estimated Cost */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-medium">Est. Cost</span>
          </div>
          <span className="text-lg font-bold text-amber-400">
            {estimatedCost === 0 ? "Free" : estimatedCost < 0.001 ? "<$0.001" : `$${estimatedCost.toFixed(4)}`}
          </span>
        </div>
        
        {/* Analysis Mode */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Analysis Mode</span>
          <span>{analysisMode || "ai-split"}</span>
        </div>
      </div>
      
      {/* Cost Note */}
      <div className="mt-4 p-3 rounded-xl bg-muted/20 border border-border/30">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold">Note:</span> Costs are estimated based on typical token usage. 
          Actual costs may vary based on page complexity and analysis depth.
          {pricing.input === 0 && pricing.output === 0 && (
            <span className="text-emerald-400"> This provider offers a free tier.</span>
          )}
        </p>
      </div>
    </div>
  );
}
