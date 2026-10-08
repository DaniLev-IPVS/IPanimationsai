/**
 * Which ad brought this visitor here. Meta fills the ad's URL parameters
 * ({{campaign.name}}, {{adset.id}}, …) at click time; we read them off the
 * landing URL, keep them for the session, and send them with the lead so the
 * Zap gets campaign / ad set / ad on every row.
 *
 * The ad's "URL parameters" field in Ads Manager should be:
 *   utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
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

/** One id per event, shared by the pixel and the Conversions API for dedup. */
export function newEventId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
