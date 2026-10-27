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

/** The browser-side match keys Meta pairs with an ad click, saved with the lead. */
export type MetaMatch = { fbc?: string; fbp?: string; ua?: string };

export type CapiEvent = {
  event_name: string;
  event_time: number;
  event_id?: string;
  action_source: "website" | "system_generated";
  event_source_url?: string;
  user_data: Record<string, unknown>;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const hashed = (v: string | undefined) => (v ? [sha256(v)] : undefined);

function cookie(req: Request, name: string) {
  const match = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Meta's normalisation, then SHA-256, for the personal match keys. */
export function hashedUser(user: CapiUser) {
  return {
    em: hashed(user.email?.trim().toLowerCase()),
    ph: hashed(user.phone?.replace(/\D/g, "")),
    fn: hashed(user.firstName?.trim().toLowerCase()),
    ln: hashed(user.lastName?.trim().toLowerCase()),
  };
}

/**
 * The click and browser ids for this visitor. _fbc is set by the pixel when an
 * ad click lands; if it hasn't been yet, it is rebuilt from the fbclid.
 */
export function metaMatchOf(req: Request, fbclid?: string): MetaMatch {
  return {
    fbc: cookie(req, "_fbc") ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined),
    fbp: cookie(req, "_fbp"),
    ua: req.headers.get("user-agent") ?? undefined,
  };
}

export async function sendCapiEvents(
  req: Request,
  events: { name: string; id?: string }[],
  user: CapiUser = {},
) {
  if (!events.length) return;
  const match = metaMatchOf(req);
  const user_data = {
    ...hashedUser(user),
    client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    client_user_agent: match.ua,
    fbp: match.fbp,
    fbc: match.fbc,
  };
  const event_time = Math.floor(Date.now() / 1000);
  const event_source_url = req.headers.get("referer") ?? `https://${brand.domain}/`;

  await postCapi(
    events.map((e) => ({
      event_name: e.name,
      event_time,
      event_id: e.id?.slice(0, 100) || undefined,
      action_source: "website",
      event_source_url,
      user_data,
    })),
  );
}

/** Posts events to the dataset. True only when Meta accepted them. */
export async function postCapi(data: CapiEvent[]): Promise<boolean> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !data.length) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${brand.metaPixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        access_token: token,
        ...(process.env.META_TEST_EVENT_CODE && { test_event_code: process.env.META_TEST_EVENT_CODE }),
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("[capi] Meta rejected the events:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[capi] call failed:", err);
    return false;
  }
}
