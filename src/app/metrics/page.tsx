"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  Coins,
  Clock,
  Zap,
  Shield,
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface MetricsSummary {
  totalAudits: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  avgLaunchScore: number;
  totalTokens: number;
  providerBreakdown: Record<string, { count: number; cost: number }>;
  verdictBreakdown: { launchReady: number; needsFixes: number; broken: number };
}

interface MetricRow {
  id: string;
  audit_id: string;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  issues_found: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  frontend_score: number | null;
  backend_score: number | null;
  launch_score: number;
  verdict: string;
  created_at: string;
}

interface PricingInfo {
  input: number;
  output: number;
  note: string;
}

interface MetricsData {
  summary: MetricsSummary;
  recent: MetricRow[];
  pricing: Record<string, PricingInfo>;
  period: { days: number; since: string };
}

function formatCost(costUsd: number): string {
  if (costUsd === 0) return "Free";
  if (costUsd < 0.001) return "<$0.001";
  return `$${costUsd.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case "launch-ready":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "broken":
      return <XCircle className="h-4 w-4 text-red-400" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  }
}

function getVerdictColor(verdict: string) {
  switch (verdict) {
    case "launch-ready":
      return "text-emerald-400 bg-emerald-500/10";
    case "broken":
      return "text-red-400 bg-red-500/10";
    default:
      return "text-amber-400 bg-amber-500/10";
  }
}

export default function MetricsPage() {
  const router = useRouter();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoaded || !isSignedIn) {
      return;
    }

    async function fetchMetrics() {
      try {
        const res = await fetch("/api/metrics?days=30&limit=10");
        const payload = await res.json();
        
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "Failed to fetch metrics");
        }
        
        setData(payload.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [userLoaded, isSignedIn]);

  if (!userLoaded || (loading && isSignedIn)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-8 w-8 mx-auto text-amber-400 mb-3" />
            <h2 className="text-lg font-semibold text-amber-300">Sign In Required</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please sign in to view your audit metrics and cost tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-3" />
            <h2 className="text-lg font-semibold text-red-300">Error Loading Metrics</h2>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const recent = data?.recent || [];
  const pricing = data?.pricing || {};

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/")} variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Home
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
              <h1 className="text-2xl font-bold">Audit Metrics</h1>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            Last {data?.period?.days || 30} days
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Total Audits</span>
            </div>
            <p className="text-3xl font-bold">{summary?.totalAudits || 0}</p>
          </div>
          
          <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium">Total Cost</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">
              {formatCost(summary?.totalCostUsd || 0)}
            </p>
          </div>
          
          <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium">Avg Latency</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">
              {formatLatency(summary?.avgLatencyMs || 0)}
            </p>
          </div>
          
          <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-medium">Total Tokens</span>
            </div>
            <p className="text-3xl font-bold text-cyan-400">
              {formatTokens(summary?.totalTokens || 0)}
            </p>
          </div>
        </div>

        {/* Provider Breakdown */}
        <div className="rounded-2xl border border-border/50 bg-background/60 p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            Provider Breakdown
          </h2>
          
          {Object.keys(summary?.providerBreakdown || {}).length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit data yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary?.providerBreakdown || {}).map(([provider, data]) => (
                <div key={provider} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{provider}</span>
                    <span className="text-sm text-muted-foreground">{data.count} audits</span>
                  </div>
                  <p className="text-lg font-bold text-amber-400">{formatCost(data.cost)}</p>
                  {pricing[provider] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {pricing[provider].note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verdict Breakdown */}
        <div className="rounded-2xl border border-border/50 bg-background/60 p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Audit Results
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-400 mb-2" />
              <p className="text-2xl font-bold text-emerald-400">
                {summary?.verdictBreakdown?.launchReady || 0}
              </p>
              <p className="text-xs text-muted-foreground">Launch Ready</p>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 mx-auto text-amber-400 mb-2" />
              <p className="text-2xl font-bold text-amber-400">
                {summary?.verdictBreakdown?.needsFixes || 0}
              </p>
              <p className="text-xs text-muted-foreground">Needs Fixes</p>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-red-500/10">
              <XCircle className="h-6 w-6 mx-auto text-red-400 mb-2" />
              <p className="text-2xl font-bold text-red-400">
                {summary?.verdictBreakdown?.broken || 0}
              </p>
              <p className="text-xs text-muted-foreground">Broken</p>
            </div>
          </div>
        </div>

        {/* Recent Audits */}
        <div className="rounded-2xl border border-border/50 bg-background/60 p-6">
          <h2 className="text-lg font-bold mb-4">Recent Audits</h2>
          
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No audits yet. Run an audit to see metrics here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Provider</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cost</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tokens</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Latency</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Issues</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-3 px-2">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 capitalize">{row.provider}</td>
                      <td className="py-3 px-2 text-amber-400 font-medium">
                        {formatCost(row.estimated_cost_usd)}
                      </td>
                      <td className="py-3 px-2">{formatTokens(row.total_tokens)}</td>
                      <td className="py-3 px-2">{formatLatency(row.latency_ms)}</td>
                      <td className="py-3 px-2">
                        <span className="text-red-400">{row.high_severity_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-amber-400">{row.medium_severity_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-400">{row.low_severity_count}</span>
                      </td>
                      <td className="py-3 px-2 font-medium">{row.launch_score}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getVerdictColor(row.verdict)}`}>
                          {getVerdictIcon(row.verdict)}
                          {row.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pricing Reference */}
        <div className="mt-8 rounded-2xl border border-border/50 bg-background/60 p-6">
          <h2 className="text-lg font-bold mb-4">Provider Pricing (per 1M tokens)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(pricing).map(([provider, info]) => (
              <div key={provider} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{provider}</span>
                  {info.input === 0 && info.output === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      Free
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Input: ${info.input.toFixed(3)}</p>
                  <p>Output: ${info.output.toFixed(3)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{info.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
