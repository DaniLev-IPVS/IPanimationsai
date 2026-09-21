import { NextResponse } from "next/server";
import { BUDGET_OPTIONS, PURPOSE_OPTIONS } from "@/content/site";

/**
 * Lead capture: browser → this route → Zapier catch hook → Notion.
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
  company_website?: string;
};

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
  const lead = {
    name,
    email,
    phone,
    budget,                                   // exact enum string, safe to branch on
    purpose,                                  // exact enum string, safe to branch on
    comment,
    source_section: body.source_section === "closing" ? "closing" : "hero",
    page_url: req.headers.get("referer") ?? `https://ipanimations.ai/`,
    submitted_at: new Date().toISOString(),
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

  return NextResponse.json({ ok: true });
}
