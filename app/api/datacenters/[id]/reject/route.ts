import { NextRequest, NextResponse } from "next/server";
import { rejectDataCenter } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  if (!rejectDataCenter(Number(id), reason)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
