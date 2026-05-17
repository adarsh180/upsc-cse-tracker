import { NextResponse } from "next/server";
import { getUPSCPrepConfidence } from "@/lib/prep-confidence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getUPSCPrepConfidence();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[prep-confidence]", error);
    return NextResponse.json(
      { error: "Failed to load live prep confidence" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
