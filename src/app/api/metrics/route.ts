/**
 * Metrics API Route
 * Returns audit metrics and cost data for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserMetricsSummary, getUserRecentMetrics } from "@/lib/audit-metrics-db";
import { getPricingInfo } from "@/lib/cost-tracker";


export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Get summary
    const summary = await getUserMetricsSummary(userId, days);
    
    // Get recent metrics
    const recent = await getUserRecentMetrics(userId, limit);

    // Get pricing info for all providers
    const providers = ["gemini", "groq", "openrouter", "tencent", "poolside", "nvidia", "mimo"];
    const pricing = providers.reduce((acc, p) => {
      const info = getPricingInfo(p);
      if (info) acc[p] = info;
      return acc;
    }, {} as Record<string, { input: number; output: number; note: string }>);

    return NextResponse.json({
      success: true,
      data: {
        summary: summary || {
          totalAudits: 0,
          totalCostUsd: 0,
          avgLatencyMs: 0,
          avgLaunchScore: 0,
          totalTokens: 0,
          providerBreakdown: {},
          verdictBreakdown: { launchReady: 0, needsFixes: 0, broken: 0 },
        },
        recent: recent || [],
        pricing,
        period: { days, since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() },
      },
    });
  } catch (error) {
    console.error("[Metrics API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
