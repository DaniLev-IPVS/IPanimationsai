import { createHash } from "node:crypto";
import { brand } from "@/content/site";

/**
 * Meta Conversions API: the server-side twin of the browser pixel. Every event
 * sent here carries the same event_id the pixel used, so Meta keeps one of the
 * pair; it still counts when an ad blocker or iOS ate the pixel. Off until
 * META_CAPI_TOKEN is set (Events Manager → the dataset → Settings →
 * Conversions API → Generate access token). Never throws.
 */

export type CapiUser = { email?: string; phone?: string; firstName?: string; lastName?: string };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const hashed = (v: string | undefined) => (v ? [sha256(v)] : undefined);

function cookie(req: Request, name: string) {
  const match = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function sendCapiEvents(
  req: Request,
  events: { name: string; id?: string }[],
  user: CapiUser = {},
) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !events.length) return;

  const user_data = {
    em: hashed(user.email?.trim().toLowerCase()),
    ph: hashed(user.phone?.replace(/\D/g, "")),
    fn: hashed(user.firstName?.trim().toLowerCase()),
    ln: hashed(user.lastName?.trim().toLowerCase()),
    client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    client_user_agent: req.headers.get("user-agent") ?? undefined,
    fbp: cookie(req, "_fbp"),
    fbc: cookie(req, "_fbc"),
  };
  const event_time = Math.floor(Date.now() / 1000);
  const event_source_url = req.headers.get("referer") ?? `https://${brand.domain}/`;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${brand.metaPixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: events.map((e) => ({
          event_name: e.name,
          event_time,
          event_id: e.id?.slice(0, 100) || undefined,
          action_source: "website",
          event_source_url,
          user_data,
        })),
        access_token: token,
        ...(process.env.META_TEST_EVENT_CODE && { test_event_code: process.env.META_TEST_EVENT_CODE }),
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("[capi] Meta rejected the events:", res.status, await res.text());
  } catch (err) {
    console.error("[capi] call failed:", err);
  }
}
