import { describe, expect, it } from "vitest";
import { StaticAnalyzer } from "@/lib/static-analyzer";

describe("static analyzer", () => {
  it("penalizes hardcoded secrets and dangerous code", () => {
    const result = StaticAnalyzer.analyze(`
--- File: src/app/api/payments/route.ts ---
const stripeKey = "REPLACE_WITH_YOUR_STRIPE_SECRET_KEY";
export async function POST() {
  eval("console.log('bad')");
}
`);

    expect(result.security).toBeLessThan(100);
    expect(result.codeQuality).toBeLessThanOrEqual(100);
  });

  it("returns zeroed metrics for empty code", () => {
    expect(StaticAnalyzer.analyze("")).toEqual({
      security: 0,
      codeQuality: 0,
      maintainability: 0,
    });
  });
});
