import { NextResponse } from "next/server";
import { syncAll } from "@/lib/studio/sync";

/** Hourly copy of BytePlus render tasks into Neon. Same CRON_SECRET header as the other cron. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncAll();
  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}
