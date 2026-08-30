import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/audits/[id]/route";
import { getAuditById } from "@/lib/audits";

vi.mock("@/lib/env", () => ({
  assertProductionEnv: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: null })),
}));

vi.mock("@/lib/audits", () => ({
  getAuditById: vi.fn(),
}));

const mockedGetAuditById = vi.mocked(getAuditById);

function request() {
  return new NextRequest("https://medo.test/api/audits/123");
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("audit lookup route", () => {
  beforeEach(() => {
    mockedGetAuditById.mockReset();
  });

  it("rejects invalid audit ids", async () => {
    const response = await GET(request(), context("not-a-uuid"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("returns 404 when no audit exists", async () => {
    mockedGetAuditById.mockResolvedValue(null);

    const response = await GET(request(), context("7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it("returns a saved public audit", async () => {
    mockedGetAuditById.mockResolvedValue({
      auditId: "7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d",
      launchScore: 90,
      verdict: "launch-ready",
      summary: "Ready.",
      issues: [],
      improvementPrompt: "Ship it.",
    });

    const response = await GET(request(), context("7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        auditId: "7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d",
        launchScore: 90,
      },
    });
  });
});
