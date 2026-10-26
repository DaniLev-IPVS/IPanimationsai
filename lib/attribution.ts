/**
 * Which ad brought this visitor here. Meta fills the ad's URL parameters
 * ({{campaign.name}}, {{adset.id}}, …) at click time; we read them off the
 * landing URL, keep them for the session, and send them with the lead so the
 * Zap gets campaign / ad set / ad on every row.
 *
 * The ad's "URL parameters" field in Ads Manager should be:
 *   utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&site_source={{site_source_name}}
 *
 * site_source repeats {{site_source_name}} (fb / ig / msg / an) under a key of
 * its own because the R1 ads have utm_source=facebook typed into the link, and a
 * URL's first utm_source wins. The lead route turns it into utm_source.
 */

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "campaign_id",
  "adset_id",
  "ad_id",
  "placement",
  "site_source",
  "fbclid",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const STORE = "ipa:attribution";

/**
 * Last ad click wins: a landing URL carrying any tracked parameter replaces
 * what's stored; a bare URL (internal navigation, a refresh) keeps it.
 */
export function captureAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const fresh: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key)?.trim();
    if (value) fresh[key] = value.slice(0, 200);
  }

  try {
    if (Object.keys(fresh).length) {
      sessionStorage.setItem(STORE, JSON.stringify(fresh));
      return fresh;
    }
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Attribution;
  } catch {
    // Storage blocked (private mode, embedded preview): the URL is all we have.
    return fresh;
  }
}

export type Platform = "facebook" | "instagram" | "messenger" | "threads" | "audience_network";

const SITE_SOURCE: Record<string, Platform> = {
  fb: "facebook",
  ig: "instagram",
  msg: "messenger",
  an: "audience_network",
};

/**
 * Which Meta app the click came from. Best signal first: the ad's own
 * {{site_source_name}}, then {{placement}} ("Instagram_Reels", …), then the
 * in-app browser the visitor is still in. Audience Network clicks land in the
 * phone's own browser, so without the first two they come back null.
 */
export function metaPlatform(
  attribution: Attribution,
  userAgent: string | null,
): { platform: Platform | null; signal: "ad link" | "placement" | "in-app browser" | "" } {
  const site = SITE_SOURCE[attribution.site_source?.toLowerCase() ?? ""];
  if (site) return { platform: site, signal: "ad link" };

  const placement = attribution.placement?.toLowerCase() ?? "";
  const byPlacement: Platform | null =
    /^instagram/.test(placement) ? "instagram"
    : /^messenger/.test(placement) ? "messenger"
    : /^threads/.test(placement) ? "threads"
    : /^(audience|an_)/.test(placement) ? "audience_network"
    : /^facebook/.test(placement) ? "facebook"
    : null;
  if (byPlacement) return { platform: byPlacement, signal: "placement" };

  // Instagram's and Messenger's browsers are checked before Facebook's tokens.
  const ua = userAgent ?? "";
  const byBrowser: Platform | null =
    /Instagram/.test(ua) ? "instagram"
    : /Barcelona/.test(ua) ? "threads"
    : /MessengerForiOS|MessengerLiteForiOS|Orca-Android/.test(ua) ? "messenger"
    : /FBAN|FBAV|FB_IAB|FBIOS/.test(ua) ? "facebook"
    : null;
  if (byBrowser) return { platform: byBrowser, signal: "in-app browser" };

  return { platform: null, signal: "" };
}

/** One id per event, shared by the pixel and the Conversions API for dedup. */
export function newEventId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
