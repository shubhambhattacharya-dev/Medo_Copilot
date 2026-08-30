import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/user/settings/route";
import { saveUserSettings, getUserSettingsSummary } from "@/lib/audits";
import { auth } from "@clerk/nextjs/server";

vi.mock("@/lib/env", () => ({
  assertProductionEnv: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_123" })),
}));

vi.mock("@/lib/audits", () => ({
  saveUserSettings: vi.fn(),
  getUserSettingsSummary: vi.fn(),
}));

const mockedAuth = vi.mocked(auth);
const mockedSaveUserSettings = vi.mocked(saveUserSettings);
const mockedGetUserSettingsSummary = vi.mocked(getUserSettingsSummary);

function postRequest(body: unknown) {
  return new NextRequest("https://medo.test/api/user/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("user settings route", () => {
  beforeEach(() => {
    mockedAuth.mockResolvedValue({ userId: "user_123" } as Awaited<ReturnType<typeof auth>>);
    mockedSaveUserSettings.mockResolvedValue({ success: true });
    mockedGetUserSettingsSummary.mockResolvedValue({
      visionProvider: "gemini",
      hasVisionKey: true,
      codeProvider: "groq",
      hasCodeKey: false,
    });
  });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized" });
    expect(mockedGetUserSettingsSummary).not.toHaveBeenCalled();
  });

  it("returns settings summary after saving providers and keys", async () => {
    const response = await POST(postRequest({
      visionProvider: "gemini",
      visionKey: "  vision-secret  ",
      codeProvider: "groq",
      codeKey: "code-secret",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedSaveUserSettings).toHaveBeenCalledWith("user_123", {
      visionProvider: "gemini",
      visionKey: "vision-secret",
      codeProvider: "groq",
      codeKey: "code-secret",
    });
    expect(body).toMatchObject({
      success: true,
      settings: {
        visionProvider: "gemini",
        hasVisionKey: true,
        codeProvider: "groq",
        hasCodeKey: false,
      },
    });
  });

  it("sends null only for the key being cleared", async () => {
    const response = await POST(postRequest({
      visionProvider: "gemini",
      visionKey: null,
      codeProvider: "groq",
    }));

    expect(response.status).toBe(200);
    expect(mockedSaveUserSettings).toHaveBeenCalledWith("user_123", {
      visionProvider: "gemini",
      visionKey: null,
      codeProvider: "groq",
    });
  });

  it("treats blank key fields as unchanged", async () => {
    const response = await POST(postRequest({
      visionProvider: "gemini",
      visionKey: "   ",
      codeProvider: "groq",
      codeKey: "",
    }));

    expect(response.status).toBe(200);
    expect(mockedSaveUserSettings).toHaveBeenCalledWith("user_123", {
      visionProvider: "gemini",
      codeProvider: "groq",
    });
  });
});
