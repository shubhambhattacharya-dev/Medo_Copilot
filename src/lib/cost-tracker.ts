/**
 * Cost Tracker Service
 * Tracks AI API costs per audit without modifying existing code
 * 
 * Pricing data sourced from provider documentation (as of 2024):
 * - Gemini 2.5 Flash: $0.075/1M input, $0.30/1M output
 * - Groq Llama 3.3: Free tier (rate limited)
 * - OpenRouter Claude: ~$3/1M input, $15/1M output
 * - Tencent Hunyuan: ~$0.15/1M input, $0.15/1M output
 * - Poolside: ~$0.50/1M input, $0.50/1M output
 * - NVIDIA Nemotron: ~$0.10/1M input, $0.10/1M output
 * - Mimo: ~$0.20/1M input, $0.20/1M output
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CostEstimate {
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  pricingSource: string;
}

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number; note: string }> = {
  gemini: { input: 0.075, output: 0.30, note: "Gemini 2.5 Flash pricing" },
  groq: { input: 0, output: 0, note: "Free tier (rate limited)" },
  openrouter: { input: 3.0, output: 15.0, note: "Claude 3.5 Sonnet via OpenRouter" },
  tencent: { input: 0.15, output: 0.15, note: "Hunyuan pricing" },
  poolside: { input: 0.50, output: 0.50, note: "Poolside Laguna pricing" },
  nvidia: { input: 0.10, output: 0.10, note: "Nemotron pricing" },
  mimo: { input: 0.20, output: 0.20, note: "Mimo pricing" },
};

/**
 * Estimate cost for a given provider and token usage
 */
export function estimateCost(
  provider: string,
  usage: TokenUsage
): CostEstimate {
  const pricing = PRICING[provider] || { input: 0, output: 0, note: "Unknown provider" };
  
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return {
    provider,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    estimatedCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000, // 6 decimal places
    pricingSource: pricing.note,
  };
}

/**
 * Parse token usage from Vercel AI SDK response metadata
 * The SDK includes usage in the response object
 */
export function parseTokenUsage(response: unknown): TokenUsage {
  const res = response as Record<string, unknown>;
  
  // Vercel AI SDK format: { usage: { promptTokens, completionTokens } }
  if (res.usage && typeof res.usage === "object") {
    const usage = res.usage as Record<string, number>;
    return {
      inputTokens: usage.promptTokens || 0,
      outputTokens: usage.completionTokens || 0,
    };
  }
  
  // Alternative format: { tokenUsage: { input, output } }
  if (res.tokenUsage && typeof res.tokenUsage === "object") {
    const usage = res.tokenUsage as Record<string, number>;
    return {
      inputTokens: usage.input || 0,
      outputTokens: usage.output || 0,
    };
  }
  
  return { inputTokens: 0, outputTokens: 0 };
}

/**
 * Get pricing info for display
 */
export function getPricingInfo(provider: string) {
  return PRICING[provider] || null;
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
  if (costUsd === 0) return "Free";
  if (costUsd < 0.001) return `<$0.001`;
  if (costUsd < 0.01) return `$${costUsd.toFixed(3)}`;
  return `$${costUsd.toFixed(4)}`;
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
