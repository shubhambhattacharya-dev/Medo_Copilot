import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getAuditById } from "@/lib/audits";
import { assertProductionEnv } from "@/lib/env";
import type { ApiResponse, AuditResponse } from "@/types/audit";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AuditResponse>>> {
  try {
    assertProductionEnv();

    const params = paramsSchema.parse(await context.params);
    const { userId } = await auth();
    const audit = await getAuditById(params.id, userId);

    if (!audit) {
      return NextResponse.json(
        { success: false, error: "Audit report not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: audit as AuditResponse });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid audit id", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    console.error("Audit lookup failed:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load audit report", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
