import { NextResponse } from "next/server";
import { createProjectFromLead, leadsWithoutProject, plain } from "@/lib/studio/proposals";

/**
 * Lead DB → Proposal Board: every lead Daniel moves to "Pitch Booked" (or
 * straight to "Create Estimate") gets a project row on the board, once, with
 * what the lead already told us filled in.
 * The row's Lead relation is what marks the lead as done (it fills the lead's
 * "Proposal" column), so a lead is never copied twice.
 *
 * Runs every 15 minutes (vercel.json crons) with `Authorization: Bearer
 * $CRON_SECRET`; `?dry=1` lists what would be created without creating it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!process.env.NOTION_TOKEN) return NextResponse.json({ error: "NOTION_TOKEN is not set." }, { status: 503 });
  const dry = new URL(req.url).searchParams.has("dry");

  let leads;
  try {
    leads = await leadsWithoutProject();
  } catch (err) {
    console.error("[proposal-intake] Notion query failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
  if (dry || !leads.length) {
    return NextResponse.json({ dry, count: leads.length, leads: leads.map((l) => plain(l.properties.Name)) });
  }

  // One at a time: Notion allows about three requests a second.
  const created: string[] = [];
  const failed: string[] = [];
  for (const lead of leads) {
    try {
      created.push((await createProjectFromLead(lead)).name);
    } catch (err) {
      console.error("[proposal-intake] create failed:", lead.id, err);
      failed.push(plain(lead.properties.Name) || lead.id);
    }
  }
  return NextResponse.json({ created, failed }, { status: failed.length ? 502 : 200 });
}
