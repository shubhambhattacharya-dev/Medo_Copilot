import { describe, expect, it } from "vitest";
import {
  estimateCost,
  parseTokenUsage,
  formatCost,
  formatTokens,
  getPricingInfo,
} from "@/lib/cost-tracker";

describe("cost-tracker", () => {
  describe("estimateCost", () => {
    it("estimates cost for Gemini provider", () => {
      const result = estimateCost("gemini", { inputTokens: 1000, outputTokens: 500 });
      
      expect(result.provider).toBe("gemini");
      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.totalTokens).toBe(1500);
      expect(result.estimatedCostUsd).toBeGreaterThan(0);
      expect(result.pricingSource).toContain("Gemini");
    });

    it("returns zero cost for Groq (free tier)", () => {
      const result = estimateCost("groq", { inputTokens: 1000, outputTokens: 500 });
      
      expect(result.provider).toBe("groq");
      expect(result.estimatedCostUsd).toBe(0);
      expect(result.pricingSource).toContain("Free");
    });

    it("handles unknown provider gracefully", () => {
      const result = estimateCost("unknown", { inputTokens: 1000, outputTokens: 500 });
      
      expect(result.provider).toBe("unknown");
      expect(result.estimatedCostUsd).toBe(0);
    });

    it("calculates correct cost for OpenRouter", () => {
      const result = estimateCost("openrouter", { inputTokens: 1000, outputTokens: 1000 });
      
      // $3/1M input + $15/1M output = $0.003 + $0.015 = $0.018
      expect(result.estimatedCostUsd).toBeCloseTo(0.018, 4);
    });
  });

  describe("parseTokenUsage", () => {
    it("parses Vercel AI SDK format", () => {
      const response = {
        usage: { promptTokens: 100, completionTokens: 50 },
      };
      
      const result = parseTokenUsage(response);
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });

    it("parses alternative format", () => {
      const response = {
        tokenUsage: { input: 200, output: 100 },
      };
      
      const result = parseTokenUsage(response);
      expect(result.inputTokens).toBe(200);
      expect(result.outputTokens).toBe(100);
    });

    it("returns zeros for unknown format", () => {
      const result = parseTokenUsage({});
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });
  });

  describe("formatCost", () => {
    it("formats free cost", () => {
      expect(formatCost(0)).toBe("Free");
    });

    it("formats very small cost", () => {
      expect(formatCost(0.0005)).toBe("<$0.001");
    });

    it("formats medium cost", () => {
      expect(formatCost(0.012)).toBe("$0.0120");
    });

    it("formats larger cost", () => {
      expect(formatCost(0.1234)).toBe("$0.1234");
    });
  });

  describe("formatTokens", () => {
    it("formats small token count", () => {
      expect(formatTokens(500)).toBe("500");
    });

    it("formats thousands", () => {
      expect(formatTokens(1500)).toBe("1.5K");
    });

    it("formats millions", () => {
      expect(formatTokens(1500000)).toBe("1.5M");
    });
  });

  describe("getPricingInfo", () => {
    it("returns pricing for known provider", () => {
      const info = getPricingInfo("gemini");
      expect(info).not.toBeNull();
      expect(info?.input).toBe(0.075);
      expect(info?.output).toBe(0.30);
    });

    it("returns null for unknown provider", () => {
      const info = getPricingInfo("unknown");
      expect(info).toBeNull();
    });
  });
});
