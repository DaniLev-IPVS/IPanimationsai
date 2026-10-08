import { NextResponse } from "next/server";
import { BUDGET_OPTIONS, PURPOSE_OPTIONS } from "@/content/site";
import { ATTRIBUTION_KEYS } from "@/lib/attribution";
import { sendCapiEvents } from "@/lib/capi";

/**
 * Lead capture: browser → this route → Zapier catch hook → Notion, plus a
 * CompleteRegistration + Lead to Meta's Conversions API once the Zap has it.
 *
 * It goes through our own route rather than posting to Zapier from the browser
 * so that the hook URL stays out of the page source, spam gets filtered before
 * it reaches the Zap, and the visitor gets a real success/failure state.
 *
 * The payload keys below are the contract with the Zap. Renaming one silently
 * breaks lead capture — change them here and in the Zap together, never alone.
 */

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Payload = {
  name?: string;
  email?: string;
  phone?: string;
  budget?: string;
  purpose?: string;
  comment?: string;
  source_section?: string;
  event_id?: string;
  company_website?: string;
} & Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // Honeypot — a bot filled a field no human can see. Accept and drop silently
  // so it doesn't learn anything from the response.
  if (body.company_website) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const budget = (body.budget ?? "").trim();
  const purpose = (body.purpose ?? "").trim();
  const comment = (body.comment ?? "").trim().slice(0, 2000);

  const problems: string[] = [];
  if (name.length < 2) problems.push("name");
  if (!EMAIL.test(email)) problems.push("email");
  if (phone.replace(/\D/g, "").length < 7) problems.push("phone number");
  if (!(BUDGET_OPTIONS as readonly string[]).includes(budget)) problems.push("budget");
  if (!(PURPOSE_OPTIONS as readonly string[]).includes(purpose)) problems.push("purpose");

  if (problems.length) {
    return NextResponse.json(
      { error: `Please check your ${problems.join(", ")}.` },
      { status: 422 },
    );
  }

  const hook = process.env.ZAPIER_WEBHOOK_URL;

  // ── the Zapier contract ────────────────────────────────────────────────
  // Derived fields are pre-computed here so the Zap is pure field mapping:
  // no formatter steps, no lookups.
  const sourceSection = body.source_section === "closing" ? "closing" : "hero";
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ");
  const submittedAt = new Date().toISOString();
  const summary = [
    `New lead: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Budget: ${budget}`,
    `For: ${purpose}`,
    comment ? `Note: ${comment}` : "",
    `From: ${sourceSection} form`,
  ].filter(Boolean).join("\n");

  const lead = {
    name,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    budget,                                   // exact enum string, safe to branch on
    purpose,                                  // exact enum string, safe to branch on
    comment,
    source_section: sourceSection,
    // Matches the Notion "Source" select options verbatim.
    source_label: sourceSection === "closing" ? "Website – closing form" : "Website – hero form",
    summary,                                  // ready-made text for the Telegram message
    page_url: req.headers.get("referer") ?? `https://ipanimations.ai/`,
    submitted_at: submittedAt,
    // Which ad it came from — empty strings when the visit wasn't from an ad,
    // so the Zap always sees every key.
    ...attributionOf(body),
  };

  if (!hook) {
    // Not configured yet (local dev, or the env var hasn't been set on Vercel).
    // Log it rather than pretending it was delivered.
    console.warn("[lead] ZAPIER_WEBHOOK_URL is not set — lead NOT delivered:", lead);
    return NextResponse.json(
      { error: "Lead capture isn't connected yet." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[lead] Zapier rejected the hook:", res.status, await res.text());
      return NextResponse.json({ error: "We couldn't send that." }, { status: 502 });
    }
  } catch (err) {
    console.error("[lead] Zapier hook failed:", err);
    return NextResponse.json({ error: "We couldn't send that." }, { status: 502 });
  }

  // Only once the Zap has the lead, mirroring the pixel (which fires on success).
  // Never fails the request: the lead is already delivered.
  const eventId = body.event_id?.slice(0, 80);
  await sendCapiEvents(
    req,
    [
      { name: "CompleteRegistration", id: eventId },
      { name: "Lead", id: eventId && `${eventId}-lead` },
    ],
    { email, phone, firstName, lastName },
  );
  return NextResponse.json({ ok: true });
}

function attributionOf(body: Payload) {
  const out = {} as Record<(typeof ATTRIBUTION_KEYS)[number], string>;
  for (const key of ATTRIBUTION_KEYS) out[key] = String(body[key] ?? "").trim().slice(0, 200);
  return out;
}
