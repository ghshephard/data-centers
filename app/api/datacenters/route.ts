import { NextRequest, NextResponse } from "next/server";
import { listDataCenters } from "@/lib/db";
import { STATUSES } from "@/lib/schema";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const minMw = Number(req.nextUrl.searchParams.get("minMw") ?? 0);
  const statusParam = req.nextUrl.searchParams.get("status");
  const statuses = statusParam ? statusParam.split(",").filter((s) => (STATUSES as readonly string[]).includes(s)) : undefined;
  return NextResponse.json(listDataCenters({ minMw, statuses }));
}
