import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/lib/encryption";
import { resetEnvCacheForTests } from "@/lib/env";

describe("encryption", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "a".repeat(64));
    resetEnvCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it("round-trips BYOK secrets without storing plaintext", () => {
    const encrypted = encrypt("secret-api-key");

    expect(encrypted).not.toContain("secret-api-key");
    expect(decrypt(encrypted)).toBe("secret-api-key");
  });

  it("rejects invalid master key lengths", () => {
    vi.stubEnv("ENCRYPTION_MASTER_KEY", "short");
    resetEnvCacheForTests();

    expect(() => encrypt("secret")).toThrow("Failed to encrypt data");
  });
});
