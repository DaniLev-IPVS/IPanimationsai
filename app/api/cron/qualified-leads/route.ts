import { NextResponse } from "next/server";
import { brand } from "@/content/site";
import { hashedUser, postCapi, type CapiEvent, type MetaMatch } from "@/lib/capi";

/**
 * Notion → Meta: every lead Daniel moves to Pitch booked or any later stage of
 * a live deal goes back to the dataset as a QualifiedLead, once. That is the
 * event the ad sets can learn from instead of "filled in a form".
 *
 * Runs every 15 minutes (vercel.json crons). Vercel calls it with
 * `Authorization: Bearer $CRON_SECRET`; the same header works by hand, and
 * `?dry=1` lists what would be sent without sending or ticking anything.
 *
 * Needs on Vercel: NOTION_TOKEN (an internal integration the Lead DB is shared
 * with), CRON_SECRET, META_CAPI_TOKEN. Needs in Notion: a "Sent to Meta"
 * checkbox (ticked here, so each lead is sent once) and, optionally, a
 * "Meta match" text column filled by the Zap from the lead's meta_match field.
 */

export const runtime = "nodejs";

const LEADS = "3f363a9c-0965-80a7-a506-000b8722a3cb"; // IP Animations Lead DB data source
const NOTION_VERSION = "2025-09-03";

// A booked pitch and everything after it in a deal that's still alive or won.
// Not qualified, Dibil, Reach out list and Low price Leads never count.
const QUALIFIED = [
  "Pitch booked",
  "Create Estimate",
  "Estimate Follow-up 1",
  "Estimate Follow-up 2",
  "Estimate Follow-up 3",
  "Estimate Follow-up 4",
  "Estimate Follow-up 5",
  "Estimate Decision pending",
  "Invoice",
  "Invoiced",
  "Deposit / Work in progress",
  "Payment complete",
];

type NotionPage = { id: string; properties: Record<string, any> };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN is not set." }, { status: 503 });
  const dry = new URL(req.url).searchParams.has("dry");

  let pages: NotionPage[];
  try {
    pages = await unsentQualified(token);
  } catch (err) {
    console.error("[qualified-leads] Notion query failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const leads = pages.map(leadOf);
  if (dry || !leads.length) {
    return NextResponse.json({
      dry,
      count: leads.length,
      leads: leads.map(({ name, status, event }) => ({
        name,
        status,
        matched_by: Object.keys(event.user_data).filter((k) => event.user_data[k]),
      })),
    });
  }

  // One batch; event_id is per page, so a resend after a failed tick is
  // deduplicated by Meta rather than counted twice.
  if (!(await postCapi(leads.map((l) => l.event)))) {
    return NextResponse.json({ error: "Meta didn't accept the events." }, { status: 502 });
  }

  const ticked = await Promise.all(leads.map((l) => tick(token, l.id)));
  const failed = leads.filter((_, i) => !ticked[i]).map((l) => l.name);
  if (failed.length) console.error("[qualified-leads] sent but not ticked:", failed);
  return NextResponse.json({ sent: leads.map((l) => l.name), untickedInNotion: failed });
}

async function notion(token: string, path: string, method: string, body: unknown) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function unsentQualified(token: string) {
  const filter = {
    and: [
      { property: "Sent to Meta", checkbox: { equals: false } },
      { or: QUALIFIED.map((name) => ({ property: "Status", status: { equals: name } })) },
    ],
  };
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion(token, `data_sources/${LEADS}/query`, "POST", {
      filter,
      page_size: 100,
      ...(cursor && { start_cursor: cursor }),
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor && pages.length < 500);
  return pages;
}

async function tick(token: string, pageId: string) {
  try {
    await notion(token, `pages/${pageId}`, "PATCH", {
      properties: { "Sent to Meta": { checkbox: true } },
    });
    return true;
  } catch (err) {
    console.error("[qualified-leads] tick failed:", pageId, err);
    return false;
  }
}

function leadOf(page: NotionPage) {
  const p = page.properties;
  const text = (prop: any) =>
    (prop?.title ?? prop?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();
  const name = text(p.Name);
  const status: string = p.Status?.status?.name ?? "";
  const [firstName, ...rest] = name.split(/\s+/);

  let match: MetaMatch = {};
  try {
    match = JSON.parse(text(p["Meta match"]) || "{}");
  } catch {
    // A hand-edited cell; email and phone still match.
  }

  const event: CapiEvent = {
    event_name: "QualifiedLead",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `qualified-${page.id}`,
    // "website" needs the visitor's user agent; leads from before the Meta
    // match column only have email and phone, sent as a system event.
    action_source: match.ua ? "website" : "system_generated",
    event_source_url: `https://${brand.domain}/`,
    user_data: {
      ...hashedUser({
        email: p.Email?.email ?? undefined,
        phone: p.Phone?.phone_number ?? undefined,
        firstName,
        lastName: rest.join(" "),
      }),
      fbc: match.fbc,
      fbp: match.fbp,
      client_user_agent: match.ua,
    },
  };
  return { id: page.id, name, status, event };
}
