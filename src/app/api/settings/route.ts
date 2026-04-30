import { NextRequest, NextResponse } from "next/server";
import { upsertUserApiKeys, getUserApiKeys } from "@/lib/audits";

const USER_ID = "default-user";

export async function GET() {
  try {
    const keys = await getUserApiKeys(USER_ID);
    return NextResponse.json({
      hasKeys: !!(keys?.googleKey || keys?.groqKey || keys?.openaiKey || keys?.anthropicKey),
      modelPreference: keys?.modelPreference || "auto",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { googleKey, groqKey, openaiKey, anthropicKey, modelPreference } = body;

    if (!googleKey && !groqKey && !openaiKey && !anthropicKey && !modelPreference) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    const result = await upsertUserApiKeys(USER_ID, {
      googleKey,
      groqKey,
      openaiKey,
      anthropicKey,
      modelPreference,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to save (database not configured)" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, hasKeys: true });
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}