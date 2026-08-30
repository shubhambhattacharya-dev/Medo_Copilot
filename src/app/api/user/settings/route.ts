import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveUserSettings, getUserSettingsSummary } from "@/lib/audits";
import { assertProductionEnv } from "@/lib/env";
import { z } from "zod";

const settingsSchema = z.object({
  visionProvider: z.enum(["default", "gemini", "groq", "openrouter", "tencent", "poolside", "nvidia", "mimo"]).optional(),
  visionKey: z.string().max(512).optional().nullable(),
  codeProvider: z.enum(["default", "gemini", "groq", "openrouter", "tencent", "poolside", "nvidia", "mimo"]).optional(),
  codeKey: z.string().max(512).optional().nullable(),
});

export async function GET() {
  try {
    assertProductionEnv();

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(await getUserSettingsSummary(userId));
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertProductionEnv();

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = settingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.issues },
        { status: 400 }
      );
    }
    const { visionProvider, visionKey, codeProvider, codeKey } = result.data;

    // Only update keys if they are provided. If they are empty strings, it means the user didn't change them.
    // If they want to delete them, they would send `null`. Let's assume empty string means "no change".
    const updateData: {
      visionProvider?: string;
      visionKey?: string | null;
      codeProvider?: string;
      codeKey?: string | null;
    } = {
      visionProvider,
      codeProvider,
    };

    const normalizedVisionKey = typeof visionKey === "string" ? visionKey.trim() : visionKey;
    const normalizedCodeKey = typeof codeKey === "string" ? codeKey.trim() : codeKey;

    if (normalizedVisionKey === null) {
      updateData.visionKey = null;
    } else if (normalizedVisionKey) {
      updateData.visionKey = normalizedVisionKey;
    }

    if (normalizedCodeKey === null) {
      updateData.codeKey = null;
    } else if (normalizedCodeKey) {
      updateData.codeKey = normalizedCodeKey;
    }

    await saveUserSettings(userId, Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ));

    return NextResponse.json({
      success: true,
      settings: await getUserSettingsSummary(userId),
    });
  } catch (error) {
    console.error("Error saving user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
