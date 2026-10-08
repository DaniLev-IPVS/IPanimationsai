import { NextResponse } from "next/server";
import { sendCapiEvents } from "@/lib/capi";

/**
 * Server-side copy of the pixel's "form started" event (Contact). Only that
 * one event name is accepted, so this can't be used to post arbitrary events
 * into the dataset.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.event !== "Contact") return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  await sendCapiEvents(req, [{ name: "Contact", id: String(body.event_id ?? "") }]);
  return NextResponse.json({ ok: true });
}
