import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings, saveUserSettings } from "@/lib/audits";
import { z } from "zod";

const settingsSchema = z.object({
  visionProvider: z.enum(["default", "gemini", "groq", "openrouter"]).optional(),
  visionKey: z.string().max(200).optional().nullable(),
  codeProvider: z.enum(["default", "gemini", "groq", "openrouter"]).optional(),
  codeKey: z.string().max(200).optional().nullable(),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getUserSettings(userId);
    
    // Do NOT send the raw API keys back to the client! 
    // Just send a boolean indicating if they are set.
    return NextResponse.json({
      visionProvider: settings?.visionProvider || "default",
      hasVisionKey: !!settings?.visionKey,
      codeProvider: settings?.codeProvider || "default",
      hasCodeKey: !!settings?.codeKey,
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
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving user settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
