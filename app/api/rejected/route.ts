import { NextResponse } from "next/server";
import { listRejected } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(listRejected());
}
