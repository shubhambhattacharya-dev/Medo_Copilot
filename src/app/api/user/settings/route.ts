import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveUserSettings, ensureUserSettingsTable } from "@/lib/audits";
import { z } from "zod";

const settingsSchema = z.object({
  visionProvider: z.enum(["default", "gemini", "groq", "openrouter", "tencent", "poolside", "nvidia"]).optional(),
  visionKey: z.string().max(200).optional().nullable(),
  codeProvider: z.enum(["default", "gemini", "groq", "openrouter", "tencent", "poolside", "nvidia"]).optional(),
  codeKey: z.string().max(200).optional().nullable(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await ensureUserSettingsTable();
    
    if (!db) {
      return NextResponse.json({
        visionProvider: "default",
        hasVisionKey: false,
        codeProvider: "default",
        hasCodeKey: false,
      });
    }

    const rows = await db`
      SELECT vision_provider, vision_api_key_encrypted, code_provider, code_api_key_encrypted 
      FROM user_settings 
      WHERE user_id = ${userId}
    ` as Array<{
      vision_provider: string;
      vision_api_key_encrypted: string | null;
      code_provider: string;
      code_api_key_encrypted: string | null;
    }>;

    const row = rows[0];
    return NextResponse.json({
      visionProvider: row?.vision_provider || "default",
      hasVisionKey: !!row?.vision_api_key_encrypted,
      codeProvider: row?.code_provider || "default",
      hasCodeKey: !!row?.code_api_key_encrypted,
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const updateData: Record<string, string | undefined> = {
      visionProvider,
      codeProvider,
    };

    // If the user provided a key string that is not masked (i.e. we don't send it back anyway, but if they enter a new one)
if (visionKey !== undefined && visionKey !== null && visionKey !== "") {
      updateData.visionKey = visionKey;
    }
    if (codeKey !== undefined && codeKey !== null && codeKey !== "") {
      updateData.codeKey = codeKey;
    }

    await saveUserSettings(userId, Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
