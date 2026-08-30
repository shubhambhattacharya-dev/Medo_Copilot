import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { assertProductionEnv, getServerEnv, resetEnvCacheForTests } from "@/lib/env";

describe("rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it("fails closed in production when DATABASE_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    resetEnvCacheForTests();

    const request = new NextRequest("https://medo.test/api/analyze", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    await expect(checkRateLimitAsync(request)).resolves.toMatchObject({
      success: false,
      remaining: 0,
    });
  });

  it("allows malformed encryption keys to be reported by production assertions", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "https://example.neon.tech/db");
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "not-a-valid-key");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    resetEnvCacheForTests();

    expect(() => assertProductionEnv()).toThrow(/valid ENCRYPTION_MASTER_KEY/);
  });

  it("does not crash development env reads for malformed optional encryption keys", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "not-a-valid-key");
    resetEnvCacheForTests();

    expect(getServerEnv()).toMatchObject({
      NODE_ENV: "development",
      ENCRYPTION_MASTER_KEY: "not-a-valid-key",
    });
  });
});
